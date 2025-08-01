import os
import pandas as pd
import time
from pathlib import Path
import re
import random
import sys
import logging
from collections import defaultdict, Counter
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity

# httpx导入（可选）
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

# OpenAI导入（可选）
try:
    from openai import OpenAI, RateLimitError, APIConnectionError, APIError, AuthenticationError, PermissionDeniedError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    # 定义替代异常类，避免未导入OpenAI时的错误
    class RateLimitError(Exception):
        pass
    class APIConnectionError(Exception):
        pass
    class APIError(Exception):
        pass
    class AuthenticationError(Exception):
        pass
    class PermissionDeniedError(Exception):
        pass

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api_processing.log", encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger()

# 导入universal_questionnaire_analyzer模块
try:
    from universal_questionnaire_analyzer import UniversalQuestionnaireAnalyzer
    logger.info("✅ 成功导入 UniversalQuestionnaireAnalyzer")
except ImportError as e:
    logger.error(f"❌ 无法导入 UniversalQuestionnaireAnalyzer: {e}")
    logger.error("请确保 universal_questionnaire_analyzer.py 文件在同一目录下")
    sys.exit(1)

# 加载.env文件中的环境变量（可选）
def load_env_variables():
    """加载环境变量，支持多种方式"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        logger.info("✅ 成功通过dotenv加载环境变量")
        return True
    except ImportError:
        logger.warning("⚠️ python-dotenv库未安装，尝试手动加载.env文件")
        
        # 手动加载.env文件
        env_file = Path(__file__).parent / '.env'
        if env_file.exists():
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ[key.strip()] = value.strip()
                logger.info("✅ 成功手动加载.env文件")
                return True
            except Exception as e:
                logger.error(f"❌ 手动加载.env文件失败: {e}")
        else:
            logger.warning("⚠️ 未找到.env文件")
        
        return False

# 加载环境变量
load_env_variables()


class QuestionnaireTranslationClassifier:
    """问卷翻译分类器 - 翻译内容并生成分类标签，使用UniversalQuestionnaireAnalyzer进行问题识别"""
    
    def __init__(self):
        # 初始化问卷分析器
        self.analyzer = UniversalQuestionnaireAnalyzer()
        
        # 新增：参考标签相关属性
        self.reference_tags = []
        self.use_reference_mode = False
        
        # 检查OpenAI是否可用
        if not OPENAI_AVAILABLE:
            logger.warning("⚠️ OpenAI库未安装，翻译和分类功能将被禁用")
            self.client = None
            return
        
        # 检查必要的环境变量
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("⚠️ 未找到OPENAI_API_KEY环境变量，OpenAI功能将被禁用")
            self.client = None
            return
        
        # 设置代理配置（自动读取.env）
        proxy_url = os.getenv("PROXY_URL")
        if proxy_url:
            os.environ['http_proxy'] = proxy_url
            os.environ['https_proxy'] = proxy_url
            logger.info(f"🌐 已设置代理: {proxy_url}")
        else:
            logger.warning("未检测到 PROXY_URL 环境变量，未设置代理")
        
        # 创建自定义 HTTP 客户端 - 增强连接稳定性
        if HTTPX_AVAILABLE:
            if proxy_url:
                http_client = httpx.Client(
                    transport=httpx.HTTPTransport(retries=5),
                    timeout=httpx.Timeout(120.0),
                    proxies={"all://": proxy_url}
                )
            else:
                http_client = httpx.Client(
                    transport=httpx.HTTPTransport(retries=5),
                    timeout=httpx.Timeout(120.0)
                )
        else:
            logger.warning("⚠️ httpx库未安装，将使用默认HTTP客户端")
            http_client = None
        
        # 设置OpenAI API - 添加更多重试机制
        try:
            self.client = OpenAI(
                api_key=os.getenv("OPENAI_API_KEY"),
                base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                http_client=http_client,
                max_retries=5  # 添加客户端级别的重试
            )
            logger.info("✅ OpenAI客户端初始化成功")
        except Exception as e:
            logger.error(f"❌ OpenAI客户端初始化失败: {e}")
            logger.warning("⚠️ OpenAI功能将被禁用    city")
            self.client = OpenAI(
                api_key=os.getenv("OPENAI_API_KEY"),
                base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
                http_client=http_client,
                max_retries=5  # 添加客户端级别的重试
            )
            # self.client = None
    
    def set_reference_tags(self, reference_tags):
        """
        设置参考标签
        Args:
            reference_tags: 参考标签列表
            [
                {
                    'name': '服务质量',
                    'definition': '服务响应速度和效率相关问题',
                    'examples': ['响应慢', '服务态度', '处理效率']
                }
            ]
        """
        self.reference_tags = reference_tags
        self.use_reference_mode = True
        logger.info(f"📋 已设置 {len(reference_tags)} 个参考标签")
        for tag in reference_tags:
            logger.info(f"  - {tag['name']}: {tag['definition']}")
    
    def assign_tags_based_on_reference(self, translated_texts, retry_count=0):
        """
        基于参考标签对翻译后的文本进行标签分配
        
        Args:
            translated_texts: 已翻译的文本列表
            retry_count: 重试次数
        
        Returns:
            标签分配结果列表: ["标签1,标签2", "标签3", ...]
        """
        if not translated_texts or all(not text.strip() for text in translated_texts):
            return [""] * len(translated_texts)
        
        if not self.reference_tags:
            logger.warning("⚠️ 未设置参考标签，使用原有方法")
            return self._rule_based_tag_assignment(translated_texts)
        
        if not self.client:
            logger.warning("⚠️ OpenAI客户端不可用，使用规则匹配方法")
            return self._rule_based_tag_assignment(translated_texts)
        
        # 构建参考标签信息
        reference_info = self._build_reference_tags_prompt()
        
        # 构建批量文本
        text_list = "\n".join([f"{idx+1}. {text}" for idx, text in enumerate(translated_texts) if text.strip()])
        
        prompt = f"""
        请根据以下参考标签体系，为每个中文文本分配最合适的标签。
        
        参考标签体系：
        {reference_info}
        
        打标要求：
        1. 严格保持原文顺序和编号
        2. 每行输出格式为"编号. 标签名称1,标签名称2,标签名称3"
        3. 只能输出上述参考标签体系中的【标签名称】（冒号前面的部分），不要输出示例关键词
        4. 每个文本分配1-3个最相关的标签名称
        5. 如果文本与所有参考标签都不匹配，输出"其他"
        6. 只输出标签分配结果，不要其他说明
        
        重要提醒：请输出标签名称（如"用户满意"），不要输出示例关键词（如"很满意"）！
        
        示例输出：
        1. 用户满意,产品体验
        2. 技术支持
        3. 其他
        
        待分配标签的文本：
        {text_list}
        
        标签分配结果：
        """
        
        try:
            model = os.getenv("OPENAI_MODEL")
            if not model:
                logger.error("未找到OPENAI_MODEL环境变量")
                return self._rule_based_tag_assignment(translated_texts)
            
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是专业的文本分类专家，严格按照给定的标签体系进行分类。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=100 * len(translated_texts)
            )
            
            # 解析结果
            results = [""] * len(translated_texts)
            content = response.choices[0].message.content
            content = content.strip() if content else ""
            
            if content:
                for line in content.split('\n'):
                    match = re.match(r'(\d+)\.\s*(.+)', line)
                    if match:
                        idx = int(match.group(1)) - 1
                        if idx < len(translated_texts):
                            tags = match.group(2).strip()
                            results[idx] = tags
            
            return results
            
        except Exception as e:
            logger.error(f"❌ 基于参考标签的打标失败: {e}")
            if retry_count < 3:
                logger.warning(f"🔄 重试第 {retry_count + 1} 次...")
                time.sleep(2 ** retry_count)
                return self.assign_tags_based_on_reference(translated_texts, retry_count + 1)
            else:
                logger.warning("⚠️ 多次重试失败，使用规则匹配方法")
                return self._rule_based_tag_assignment(translated_texts)
    
    def _build_reference_tags_prompt(self):
        """
        构建参考标签的提示信息
        """
        reference_info = ""
        for i, tag in enumerate(self.reference_tags, 1):
            reference_info += f"{i}. {tag['name']}: {tag['definition']}\n"
            if tag.get('examples'):
                examples = ', '.join(tag['examples'])
                reference_info += f"   示例关键词: {examples}\n"
        
        return reference_info
    
    def _rule_based_tag_assignment(self, translated_texts):
        """
        基于规则的标签分配（当AI不可用时的回退方法）
        """
        results = []
        
        # 构建关键词映射
        tag_keywords = {}
        for tag in self.reference_tags:
            keywords = [tag['name']] + tag.get('examples', [])
            # 添加定义中的关键词
            if tag.get('definition'):
                definition_words = tag['definition'].split()
                keywords.extend(definition_words)
            tag_keywords[tag['name']] = keywords
        
        for text in translated_texts:
            if not text.strip():
                results.append("")
                continue
            
            # 匹配得分
            tag_scores = {}
            for tag_name, keywords in tag_keywords.items():
                score = 0
                for keyword in keywords:
                    if keyword in text:
                        score += 1
                tag_scores[tag_name] = score
            
            # 选择得分最高的标签名称
            if tag_scores:
                max_score = max(tag_scores.values())
                if max_score > 0:
                    matched_tags = [tag_name for tag_name, score in tag_scores.items() if score == max_score]
                    results.append(",".join(matched_tags[:3]))  # 最多3个标签名称
                else:
                    results.append("其他")
            else:
                results.append("其他")
        
        return results
    
    def _need_translation(self, texts):
        """
        判断是否需要翻译（简单的中英文检测）
        """
        sample_text = ' '.join(texts[:5])  # 取前5个文本样本
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', sample_text))
        english_chars = len(re.findall(r'[a-zA-Z]', sample_text))
        
        # 如果英文字符比中文字符多，认为需要翻译
        return english_chars > chinese_chars
    
    def _batch_translate_texts(self, texts, column_name, batch_size=50):
        """
        纯翻译功能，不涉及打标
        """
        translations = []
        
        batches = [texts[i:i+batch_size] for i in range(0, len(texts), batch_size)]
        
        for batch_idx, batch in enumerate(batches):
            logger.info(f"🔄 翻译批次 {batch_idx + 1}/{len(batches)}")
            batch_translations = self._translate_batch(batch, column_name)
            translations.extend(batch_translations)
            
            # 批次间等待
            if batch_idx < len(batches) - 1:
                time.sleep(1.0)
        
        return translations
    
    def _translate_batch(self, texts, column_name):
        """
        批量翻译单个批次
        """
        text_list = "\n".join([f"{idx+1}. {text}" for idx, text in enumerate(texts) if text.strip()])
        
        prompt = f"""
        请将以下英文内容翻译成中文，保持原文顺序和编号。
        
        要求：
        1. 严格保持原文顺序和编号
        2. 每行输出格式为"编号. 翻译内容"
        3. 只输出翻译结果，不要其他说明
        
        {column_name}内容：
        {text_list}
        
        翻译结果：
        """
        
        try:
            model = os.getenv("OPENAI_MODEL")
            if not model:
                logger.error("未找到OPENAI_MODEL环境变量")
                return texts
            
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是专业的翻译助手，专注于准确翻译。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=100 * len(texts)
            )
            
            # 解析翻译结果
            results = [""] * len(texts)
            content = response.choices[0].message.content
            content = content.strip() if content else ""
            
            if content:
                for line in content.split('\n'):
                    match = re.match(r'(\d+)\.\s*(.+)', line)
                    if match:
                        idx = int(match.group(1)) - 1
                        if idx < len(texts):
                            translation = match.group(2).strip()
                            results[idx] = translation
            
            return results
            
        except Exception as e:
            logger.error(f"❌ 翻译失败: {e}")
            return texts  # 翻译失败时返回原文
    
    def _assign_to_reference_topics(self, sub_tags_list, main_topics):
        """
        将标签分配到参考主题
        """
        topic_assignments = []
        
        for tags_str in sub_tags_list:
            if not tags_str or tags_str.strip() == "其他":
                topic_assignments.append("其他")
                continue
            
            # 分割标签
            tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
            
            # 直接使用标签作为主题（因为标签就是从参考标签中选择的）
            matched_topics = [tag for tag in tags if tag in main_topics]
            
            if matched_topics:
                topic_assignments.append("、".join(matched_topics))
            else:
                topic_assignments.append("其他")
        
        return topic_assignments
    
    def find_column(self, df, keywords):
        """
        根据关键词列表查找匹配的列名
        """
        for col in df.columns:
            for keyword in keywords:
                if re.search(keyword, col, re.IGNORECASE):
                    return col
        return None
    
    def batch_translate_and_tag(self, texts, column_name, source_lang="英文", target_lang="中文", batch_size=15, retry_count=0):
        """
        批量翻译并生成多个标签，一次API调用完成两个任务
        返回格式：[("翻译内容", "标签1,标签2,标签3"), ...]
        """
        if not texts or all(not text.strip() for text in texts):
            return [("", "")] * len(texts)
        
        # 检查OpenAI客户端是否可用
        if not self.client:
            logger.warning("⚠️ OpenAI客户端不可用，返回原始文本")
            return [(text, "") for text in texts]
        
        # 如果启用了参考标签模式，分别处理翻译和打标
        if self.use_reference_mode and self.reference_tags:
            logger.info("🏷️  使用参考标签模式进行分别处理")
            
            # 第一步：翻译
            if self._need_translation(texts):
                logger.info("📝 开始翻译...")
                translations = self._batch_translate_texts(texts, column_name, batch_size)
            else:
                translations = texts  # 如果是中文，直接使用原文
            
            # 第二步：基于参考标签打标
            logger.info("🏷️  基于参考标签打标...")
            tags = self.assign_tags_based_on_reference(translations, retry_count)
            
            # 组合结果
            results = []
            for translation, tag in zip(translations, tags):
                results.append((translation, tag))
            
            return results
        
        # 原有的一体化处理逻辑
        # 构建批量提示
        text_list = "\n".join([f"{idx+1}. {text}" for idx, text in enumerate(texts) if text.strip()])
        
        prompt = f"""
        请将以下{source_lang}内容列表翻译成{target_lang}并生成多个相关的主题标签。
        要求：
        1. 严格保持原文顺序和编号
        2. 每行输出格式为"编号. 翻译内容 | 标签1,标签2,标签3"
        3. 每个回答生成2-3个相关标签，用逗号分隔
        4. 标签要具体、细分，涵盖不同角度
        5. 只输出结果列表，不要包含其他说明
        
        示例格式：
        1. 服务很慢 | 服务速度,响应时间,用户体验
        2. 界面复杂 | 界面设计,操作复杂,易用性
        3. 价格太高 | 价格问题,性价比,成本控制
        
        {column_name}内容列表：
        {text_list}
        
        翻译和标签结果列表：
        """
        
        try:
            logger.debug(f"发送翻译+标签请求，批次大小: {len(texts)}")
            model = os.getenv("OPENAI_MODEL")
            if not model:
                logger.error("未找到OPENAI_MODEL环境变量")
                return [("MODEL_ERROR", "")] * len(texts)
                
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是高效的批量翻译标签助手，专注于保持顺序的准确翻译和分类。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=150 * len(texts)  # 动态token分配
            )
            logger.info(f"response: {response}")
            
            # 解析批量结果
            results = [("", "")] * len(texts)
            content = response.choices[0].message.content
            content = content.strip() if content else ""
            
            if content:
                # 解析格式：1. 翻译内容 | 标签\n2. 翻译内容 | 标签...
                for line in content.split('\n'):
                    match = re.match(r'(\d+)\.\s*(.*?)(?:\s*\|\s*(.*))?$', line)
                    if match:
                        idx = int(match.group(1)) - 1
                        if idx < len(texts):
                            translation = match.group(2).strip() if match.group(2) else ""
                            tag = match.group(3).strip() if match.group(3) else ""
                            results[idx] = (translation, tag)
            
            return results
        
        except RateLimitError as e:
            # 速率限制错误处理
            retry_count += 1
            if retry_count > 3:
                logger.error(f"⚠️ 批量翻译标签连续3次遇到速率限制错误，跳过此批次")
                return [("RATE_LIMIT_ERROR", "")] * len(texts)
            
            wait_time = min(60, 10 * retry_count) + random.uniform(0, 5)  # 限制最大等待时间
            logger.warning(f"⏳ 批量翻译标签遇到速率限制错误: {e}, 将在 {wait_time:.1f} 秒后重试 (尝试 #{retry_count})")
            time.sleep(wait_time)
            return self.batch_translate_and_tag(texts, column_name, source_lang, target_lang, batch_size, retry_count)
        
        except APIConnectionError as e:
            # 网络连接错误处理
            retry_count += 1
            if retry_count > 3:
                logger.error(f"⚠️ 批量翻译标签连续3次遇到网络连接错误，跳过此批次")
                return [("NETWORK_ERROR", "")] * len(texts)
            
            wait_time = min(120, 15 * retry_count) + random.uniform(0, 10)  # 限制最大等待时间
            logger.warning(f"🌐 批量翻译标签遇到网络连接问题: {e}, 将在 {wait_time:.1f} 秒后重试 (尝试 #{retry_count})")
            time.sleep(wait_time)
            return self.batch_translate_and_tag(texts, column_name, source_lang, target_lang, batch_size, retry_count)
        
        except Exception as network_error:
            # 处理可能的httpx相关异常
            if 'httpx' in str(type(network_error)).lower() or 'connect' in str(network_error).lower():
                retry_count += 1
                if retry_count > 3:
                    logger.error(f"⚠️ 批量翻译标签连续3次遇到网络连接错误，跳过此批次")
                    return [("NETWORK_ERROR", "")] * len(texts)
                
                wait_time = min(120, 15 * retry_count) + random.uniform(0, 10)
                logger.warning(f"🌐 批量翻译标签遇到网络连接问题: {network_error}, 将在 {wait_time:.1f} 秒后重试 (尝试 #{retry_count})")
                time.sleep(wait_time)
                return self.batch_translate_and_tag(texts, column_name, source_lang, target_lang, batch_size, retry_count)
            else:
                # 其他未知异常
                raise
        
        except (AuthenticationError, PermissionDeniedError) as e:
            logger.error(f"❌ API认证失败: {e}")
            return [("AUTH_ERROR", "")] * len(texts)
        
        except APIError as e:
            # 其他API错误
            logger.error(f"⚠️ 批量翻译标签遇到API错误: {e}")
            return [("API_ERROR", "")] * len(texts)
        
        except Exception as e:
            # 跳过之前已处理的网络异常
            if 'httpx' in str(type(e)).lower() or 'connect' in str(e).lower():
                pass  # 已在上面处理
            else:
                logger.error(f"⚠️ 批量翻译标签遇到未知错误: {e}")
                return [("UNKNOWN_ERROR", "")] * len(texts)
    
    def extract_all_tags(self, all_tags_list):
        """
        从所有标签中提取唯一的标签列表
        """
        all_tags = []
        for tags_str in all_tags_list:
            if tags_str and tags_str.strip():
                # 分割多个标签
                tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
                all_tags.extend(tags)
        
        # 统计标签频率
        tag_counts = Counter(all_tags)
        unique_tags = list(tag_counts.keys())
        
        logger.info(f"📊 提取到 {len(unique_tags)} 个唯一标签")
        logger.info(f"🏷️  标签频率统计（前10个）: {dict(tag_counts.most_common(10))}")
        
        return unique_tags, tag_counts
    
    def generate_main_topics(self, unique_tags, tag_counts, num_topics=5):
        """
        使用AI生成一级主题标签
        """
        if not unique_tags:
            return []
        
        # 检查OpenAI客户端是否可用
        if not self.client:
            logger.warning("⚠️ OpenAI客户端不可用，使用回退方法生成主题")
            return self.fallback_topic_generation(unique_tags, num_topics)
        
        # 选择频率最高的标签作为输入
        top_tags = [tag for tag, count in tag_counts.most_common(min(20, len(tag_counts)))]
        tags_text = ", ".join(top_tags)
        
        prompt = f"""
        请根据以下二级标签，生成{num_topics}个一级主题标签（大分类）。
        
        二级标签列表：
        {tags_text}
        
        要求：
        1. 生成{num_topics}个一级主题，每个主题用2-4个词描述
        2. 一级主题要能涵盖相关的二级标签
        3. 主题之间要有区分度，避免重复
        4. 只输出主题列表，每行一个主题
        
        示例：
        服务质量
        产品设计
        价格策略
        用户体验
        技术支持
        
        一级主题：
        """
        
        try:
            model = os.getenv("OPENAI_MODEL")
            if not model:
                logger.error("未找到OPENAI_MODEL环境变量")
                return self.fallback_topic_generation(unique_tags, num_topics)
                
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是专业的主题分类专家，擅长将细分类别归纳为更高层次的主题。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            content = response.choices[0].message.content
            content = content.strip() if content else ""
            topics = [topic.strip() for topic in content.split('\n') if topic.strip()]
            
            # 清理和验证主题
            cleaned_topics = []
            for topic in topics:
                # 移除可能的编号和多余字符
                topic = re.sub(r'^\d+[\.\)]?\s*', '', topic)
                topic = topic.strip()
                if topic and len(topic) <= 10:  # 限制主题长度
                    cleaned_topics.append(topic)
            
            logger.info(f"🎯 生成 {len(cleaned_topics)} 个一级主题: {cleaned_topics}")
            
            # 打印生成的主题标签
            logger.info("📋 生成的一级主题标签:")
            for i, topic in enumerate(cleaned_topics[:num_topics], 1):
                logger.info(f"  {i}. {topic}")
            
            return cleaned_topics[:num_topics]
            
        except Exception as e:
            logger.error(f"❌ 生成一级主题失败: {e}")
            # 回退到简单的聚类方法
            return self.fallback_topic_generation(unique_tags, num_topics)
    
    def fallback_topic_generation(self, unique_tags, num_topics):
        """
        回退的主题生成方法（基于关键词聚类）
        """
        if len(unique_tags) < num_topics:
            return unique_tags[:num_topics]
        
        try:
            # 使用TF-IDF向量化标签
            vectorizer = TfidfVectorizer(max_features=100, stop_words=None)
            tag_vectors = vectorizer.fit_transform(unique_tags)
            
            # K-means聚类
            kmeans = KMeans(n_clusters=num_topics, random_state=42, n_init="auto")
            clusters = kmeans.fit_predict(tag_vectors)
            
            # 为每个聚类选择代表性标签
            topics = []
            for i in range(num_topics):
                cluster_tags = [tag for tag, cluster_id in zip(unique_tags, clusters) if cluster_id == i]
                if cluster_tags:
                    # 选择最长的标签作为主题（通常更具体）
                    topic = max(cluster_tags, key=len)
                    topics.append(topic)
            
            logger.info(f"🔄 使用聚类方法生成主题: {topics}")
            return topics
            
        except Exception as e:
            logger.error(f"❌ 聚类方法也失败: {e}")
            # 最后的回退：选择最频繁的标签
            return unique_tags[:num_topics]
    
    def assign_tags_to_topics(self, all_tags_list, main_topics):
        """
        将二级标签分配到一级主题
        返回：每个回答的主题分配结果（支持多个主题用"、"分隔）
        """
        if not main_topics:
            return [""] * len(all_tags_list)
        
        # 为每个回答分配主题
        topic_assignments = []
        
        for tags_str in all_tags_list:
            if not tags_str or not tags_str.strip():
                topic_assignments.append("")
                continue
            
            # 分割二级标签
            sub_tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
            
            # 计算与每个主题的相似度，支持多个主题
            matched_topics = []
            topic_scores = {}
            
            for topic in main_topics:
                score = 0
                for sub_tag in sub_tags:
                    # 检查标签是否包含主题关键词
                    if any(keyword in sub_tag for keyword in topic.split()):
                        score += 1
                    # 检查主题是否包含标签关键词
                    if any(keyword in topic for keyword in sub_tag.split()):
                        score += 1
                
                topic_scores[topic] = score
            
            # 选择得分最高的主题（支持多个）
            if topic_scores:
                max_score = max(topic_scores.values())
                if max_score > 0:
                    # 选择所有得分等于最高分的主题
                    matched_topics = [topic for topic, score in topic_scores.items() if score == max_score]
                else:
                    # 如果没有匹配，使用第一个主题
                    matched_topics = [main_topics[0]] if main_topics else []
            
            # 用"、"连接多个主题
            topic_assignments.append("、".join(matched_topics))
        
        return topic_assignments
    
    def validate_api_connection(self):
        """验证API连接是否正常"""
        logger.info("验证API连接...")
        
        # 检查OpenAI客户端是否可用
        if not self.client:
            logger.warning("⚠️ OpenAI客户端不可用，跳过API连接测试")
            return True  # 无需验证时返回True
        
        # 检查API密钥
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("未找到OPENAI_API_KEY环境变量")
            return False
        
        logger.info(f"API密钥: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else '***'}")
        
        # 检查模型设置
        model = os.getenv("OPENAI_MODEL")
        if not model:
            logger.error("未找到OPENAI_MODEL环境变量")
            return False
        logger.info(f"使用模型: {model}")
        
        # 检查代理设置
        http_proxy = os.getenv("http_proxy")
        https_proxy = os.getenv("https_proxy")
        logger.info(f"HTTP代理: {http_proxy}")
        logger.info(f"HTTPS代理: {https_proxy}")
        
        # 测试网络连接（简化版，只测试基本连通性）
        logger.info("测试网络连接...")
        try:
            import urllib.request
            import urllib.error
            
            # 测试代理连接
            if http_proxy:
                proxies = {}
                if http_proxy:
                    proxies['http'] = http_proxy
                if https_proxy:
                    proxies['https'] = https_proxy
                proxy_handler = urllib.request.ProxyHandler(proxies)
                opener = urllib.request.build_opener(proxy_handler)
                urllib.request.install_opener(opener)
            
            # 测试访问Google（不需要认证）
            response = urllib.request.urlopen('https://www.google.com', timeout=10)
            logger.info(f"网络连接测试成功: HTTP {response.getcode()}")
        except Exception as e:
            logger.warning(f"网络连接测试失败: {e}")
            logger.warning("继续尝试API连接测试...")
            # 不返回False，继续尝试API测试
        
        try:
            test_text = "Hello, world"
            logger.info(f"发送测试请求: '{test_text}'")
            
            model = os.getenv("OPENAI_MODEL")
            if not model:
                logger.error("未找到OPENAI_MODEL环境变量")
                return False
                
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": f"Translate to Chinese: {test_text}"}
                ],
                max_tokens=20,
                timeout=30  # 设置30秒超时
            )
            
            result = response.choices[0].message.content
            result = result.strip() if result else ""
            logger.info(f"API连接测试成功: 输入 '{test_text}' -> 输出 '{result}'")
            return True
            
        except RateLimitError as e:
            logger.error(f"API速率限制: {e}")
            return False
            
        except APIConnectionError as e:
            logger.error(f"API连接错误: {e}")
            logger.error("请检查网络连接和代理设置")
            return False
            
        except AuthenticationError as e:
            logger.error(f"API认证失败: {e}")
            logger.error("请检查API密钥是否正确")
            return False
            
        except Exception as e:
            logger.error(f"API连接测试失败: {e}")
            logger.error("可能的原因：")
            logger.error("1. API密钥无效或过期")
            logger.error("2. 网络连接问题")
            logger.error("3. OpenAI服务中断")
            logger.error("4. 使用了错误的API端点")
            return False
    
    def process_table(self, input_path=None, output_path=None):
        """处理表格：翻译内容并生成分类标签，支持CSV和Excel格式"""
        
        # 如果没有提供输入文件路径，使用交互式选择
        if input_path is None:
            input_path = self.analyzer.select_file_interactive()
            if not input_path:
                logger.error("❌ 未选择输入文件")
                return False
        
        # 获取文件扩展名
        input_ext = Path(input_path).suffix.lower()
        
        # 验证API连接（如果OpenAI可用）
        if self.client:
            if not self.validate_api_connection():
                logger.error("❌ API连接验证失败，无法继续处理")
                return False
        else:
            logger.warning("⚠️ OpenAI客户端不可用，将跳过翻译和标签功能，直接处理文件")
        
        # 读取输入文件
        df = self.analyzer.read_data_file(input_path)
        if df is None:
            logger.error("❌ 文件读取失败")
            return False
        
        # 智能识别问题类型
        question_types = self.analyzer.identify_all_question_types(df)
        
        # 查找开放题（用于翻译和标签生成）
        open_ended_questions = question_types.get('open_ended', [])
        
        logger.info(f"🔍 识别到的开放题数量: {len(open_ended_questions)}")
        logger.info(f"🔍 开放题详情: {open_ended_questions}")
        
        if not open_ended_questions:
            logger.warning("⚠️ 未发现开放题，尝试使用传统方法查找列")
            # 回退到传统方法
            reason_keywords = ['原因', 'reason', '评分原因', 'rating reason', 'feedback', '意见原因']
            suggestion_keywords = ['建议', 'suggestion', 'advice', 'recommendation', '提议', '改进建议']
            
            reason_col = self.find_column(df, reason_keywords)
            suggestion_col = self.find_column(df, suggestion_keywords)
            
            logger.info(f"🔍 传统方法找到的列: reason_col={reason_col}, suggestion_col={suggestion_col}")
            
            if not reason_col and not suggestion_col:
                logger.error("❌ 未找到可处理的文本列")
                return False
            
            # 只处理找到的列
            columns_to_process = []
            if reason_col:
                columns_to_process.append(reason_col)
            if suggestion_col:
                columns_to_process.append(suggestion_col)
        else:
            # 使用识别到的开放题
            logger.info(f"✅ 发现 {len(open_ended_questions)} 个开放题")
            columns_to_process = [q['column'] for q in open_ended_questions]
            
            # 处理所有开放题
            logger.info(f"🎯 将处理所有 {len(columns_to_process)} 个开放题")
        
        logger.info(f"🔍 最终将处理以下列: {', '.join(columns_to_process)}")
        
        # 如果没有提供输出路径，自动生成
        if output_path is None:
            input_name = Path(input_path).stem
            output_path = str(Path(input_path).parent / f"{input_name}_processed.xlsx")
            logger.info(f"💾 自动生成输出路径: {output_path}")
        
        # 获取输出文件扩展名
        output_ext = Path(output_path).suffix.lower()
        
        # 为每个要处理的列创建新列（仅在OpenAI可用时）
        column_indices = {}
        new_columns = {}
        
        if self.client:
            for col in columns_to_process:
                col_idx = list(df.columns).index(col)
                column_indices[col] = col_idx
                
                # 创建新列名（支持双层标签体系）
                cn_col = f"{col}-CN"
                sub_tags_col = f"{col}二级标签"  # 多个细分标签
                main_topic_col = f"{col}一级主题"  # 大主题分类
                
                new_columns[col] = {
                    'cn_col': cn_col,
                    'sub_tags_col': sub_tags_col,
                    'main_topic_col': main_topic_col,
                    'index': col_idx
                }
                
                # 插入新列
                df.insert(col_idx + 1, cn_col, "")
                df.insert(col_idx + 2, sub_tags_col, "")
                df.insert(col_idx + 3, main_topic_col, "")
                
                logger.info(f"📍 {cn_col} 插入在 {col} 后面 (索引 {col_idx+1})")
                logger.info(f"📍 {sub_tags_col} 插入在 {cn_col} 后面 (索引 {col_idx+2})")
                logger.info(f"📍 {main_topic_col} 插入在 {sub_tags_col} 后面 (索引 {col_idx+3})")
        
        # 初始化处理时间统计
        start_time = time.time()
        total_rows = len(df)
        
        # 如果OpenAI不可用，创建简化的输出文件
        if not self.client:
            logger.info("🔄 OpenAI不可用，创建简化的输出文件...")
            
            # 直接保存原始数据
            try:
                if output_ext == '.csv':
                    df.to_csv(output_path, index=False, encoding='utf-8-sig')
                elif output_ext in ['.xlsx', '.xls']:
                    df.to_excel(output_path, index=False)
                else:
                    raise ValueError(f"不支持的输出文件格式: {output_ext}。请使用.csv或.xlsx文件")
                
                total_time = time.time() - start_time
                logger.info(f"✅ 简化处理完成！共处理 {len(df)} 行，耗时 {total_time:.2f} 秒")
                logger.info(f"💾 结果已保存至: {output_path}")
                logger.info("💡 由于OpenAI不可用，未进行翻译和分类处理")
                return True
                
            except Exception as e:
                logger.error(f"❌ 保存简化结果失败: {e}")
                return False
        
        # 批量处理参数（大幅增加批处理大小以提高效率）
        BATCH_SIZE = 50  # 增加批量大小
        
        # 处理所有列
        all_results = {}
        
        logger.info(f"📊 开始处理 {len(columns_to_process)} 个列")
        
        for col in columns_to_process:
            logger.info(f"\n🚀 开始批量处理列: {col}")
            
            # 准备文本数据
            texts = df[col].fillna('').astype(str).tolist()
            logger.info(f"📋 列 {col} 的文本数据量: {len(texts)}")
            logger.info(f"📋 前5个文本示例: {texts[:5]}")
            
            translations = []
            sub_tags = []
            
            # 批量处理（翻译+二级标签）
            batches = [texts[i:i+BATCH_SIZE] 
                       for i in range(0, len(texts), BATCH_SIZE)]
            logger.info(f"📊 分成 {len(batches)} 个批次处理，批次大小: {BATCH_SIZE}")
            
            for batch_idx, batch in enumerate(batches):
                # 动态调整批处理大小（如果文本过长）
                max_text_len = max(len(text) for text in batch)
                current_batch_size = min(BATCH_SIZE, 5) if max_text_len > 500 else BATCH_SIZE
                
                logger.info(f"🔄 处理批次 {batch_idx + 1}/{len(batches)}")
                logger.info(f"📋 批次大小: {len(batch)}, 最大文本长度: {max_text_len}")
                logger.info(f"📋 当前批次大小: {current_batch_size}")
                
                # 处理当前批次（翻译+二级标签）
                logger.info(f"🚀 即将调用 batch_translate_and_tag 方法")
                results = self.batch_translate_and_tag(batch, col, batch_size=current_batch_size)
                logger.info(f"✅ batch_translate_and_tag 调用完成，返回结果数量: {len(results)}")
                
                # 分离翻译和二级标签
                batch_translations = [result[0] for result in results]
                batch_sub_tags = [result[1] for result in results]
                
                translations.extend(batch_translations)
                sub_tags.extend(batch_sub_tags)
                
                # 进度报告
                processed = min((batch_idx + 1) * BATCH_SIZE, total_rows)
                elapsed = time.time() - start_time
                rows_per_min = processed / (elapsed / 60) if elapsed > 0 else 0
                remaining = (len(batches) - batch_idx - 1) * (elapsed / (batch_idx + 1)) / 60 if batch_idx > 0 else 0
                
                logger.info(f"🔄 {col}处理进度: {processed}/{total_rows} 行 ({processed/total_rows*100:.1f}%) | "
                            f"速度: {rows_per_min:.1f} 行/分钟 | 预计剩余: {remaining:.1f} 分钟")
                
                # 批次间等待
                wait_time = 2.0 + random.uniform(0, 1.0)
                time.sleep(wait_time)
            
            # 保存结果
            all_results[col] = {
                'translations': translations,
                'sub_tags': sub_tags
            }
            
            # 更新DataFrame（翻译和二级标签）
            col_info = new_columns[col]
            df.iloc[:, col_info['index'] + 1] = translations
            df.iloc[:, col_info['index'] + 2] = sub_tags
        
        # 生成一级主题并分配
        logger.info(f"\n🎯 开始生成一级主题标签...")
        
        for col in columns_to_process:
            logger.info(f"\n📊 处理列 {col} 的主题生成...")
            
            # 提取所有二级标签
            sub_tags_list = all_results[col]['sub_tags']
            unique_tags, tag_counts = self.extract_all_tags(sub_tags_list)
            
            if not unique_tags:
                logger.warning(f"⚠️ 列 {col} 没有有效的二级标签，跳过主题生成")
                continue
            
            # 生成一级主题
            if self.use_reference_mode and self.reference_tags:
                # 使用参考标签作为主题
                main_topics = [tag['name'] for tag in self.reference_tags]
                logger.info(f"🏷️  使用参考标签作为主题: {main_topics}")
                
                # 将二级标签分配到参考主题
                topic_assignments = self._assign_to_reference_topics(sub_tags_list, main_topics)
            else:
                # 使用AI生成主题
                num_topics = min(5, len(unique_tags))  # 根据标签数量动态调整主题数
                main_topics = self.generate_main_topics(unique_tags, tag_counts, num_topics)
                
                if not main_topics:
                    logger.warning(f"⚠️ 列 {col} 主题生成失败")
                    continue
                
                # 将二级标签分配到一级主题
                topic_assignments = self.assign_tags_to_topics(sub_tags_list, main_topics)
            
            # 更新DataFrame（一级主题）
            col_info = new_columns[col]
            df.iloc[:, col_info['index'] + 3] = topic_assignments
            
            # 显示主题分配统计
            topic_counts = Counter(topic_assignments)
            logger.info(f"📈 主题分配统计: {dict(topic_counts)}")
            
            # 保存主题信息到结果中
            all_results[col]['main_topics'] = main_topics
            all_results[col]['topic_assignments'] = topic_assignments
        
        # 保存结果
        try:
            if output_ext == '.csv':
                df.to_csv(output_path, index=False, encoding='utf-8-sig')
            elif output_ext in ['.xlsx', '.xls']:
                df.to_excel(output_path, index=False)
            else:
                raise ValueError(f"不支持的输出文件格式: {output_ext}。请使用.csv或.xlsx文件")
            
            # 计算总耗时
            total_time = time.time() - start_time
            logger.info(f"\n✅ 处理完成！共处理 {total_rows} 行，耗时 {total_time/60:.1f} 分钟")
            logger.info(f"💾 结果已保存至: {output_path}")
            logger.info(f"✨ 新增列位置: ")
            
            for col in columns_to_process:
                col_info = new_columns[col]
                logger.info(f"  - {col_info['cn_col']} 在 {col} 后面")
                logger.info(f"  - {col_info['sub_tags_col']} 在 {col_info['cn_col']} 后面")
                logger.info(f"  - {col_info['main_topic_col']} 在 {col_info['sub_tags_col']} 后面")
            
            # 显示API使用统计
            total_api_calls = sum(len(all_results[col]['translations']) // BATCH_SIZE for col in columns_to_process)
            logger.info(f"📊 API调用次数: {total_api_calls} (相比逐行处理减少约 {100 * (1 - total_api_calls/(total_rows*len(columns_to_process))):.0f}%)")
            
            # 错误统计
            all_translations = []
            all_sub_tags = []
            for col in columns_to_process:
                all_translations.extend(all_results[col]['translations'])
                all_sub_tags.extend(all_results[col]['sub_tags'])
            
            error_stats = {
                "RATE_LIMIT_ERROR": sum(1 for x in all_translations + all_sub_tags if "RATE_LIMIT" in x),
                "NETWORK_ERROR": sum(1 for x in all_translations + all_sub_tags if "NETWORK" in x),
                "API_ERROR": sum(1 for x in all_translations + all_sub_tags if "API_ERROR" in x),
                "UNKNOWN_ERROR": sum(1 for x in all_translations + all_sub_tags if "UNKNOWN" in x),
                "AUTH_ERROR": sum(1 for x in all_translations + all_sub_tags if "AUTH" in x)
            }
            
            if any(error_stats.values()):
                logger.warning("⚠️ 处理过程中出现错误:")
                for error_type, count in error_stats.items():
                    if count > 0:
                        logger.warning(f"  - {error_type}: {count} 处")
                logger.warning("建议检查日志文件 'api_processing.log' 获取详细错误信息")
            
        except Exception as e:
            logger.error(f"❌ 保存结果失败: {e}")
            return False
        
        # 处理成功，返回True
        return True

    def process_table_with_reference_tags(self, input_path, reference_tags, output_path=None):
        """
        基于参考标签重新打标的主方法
        """
        # 设置参考标签
        self.set_reference_tags(reference_tags)
        
        # 调用原有的处理方法，但使用参考标签模式
        return self.process_table(input_path, output_path)

    def translate_only(self, input_path, output_path, open_ended_fields):
        """只进行翻译，不进行AI分类 - 为后续的标准打标或参考标签打标做准备"""
        try:
            logger.info(f"🔧 开始只翻译处理: {input_path} -> {output_path}")
            logger.info(f"📋 待翻译的开放题字段: {open_ended_fields}")
            
            # 读取输入文件
            df = self.analyzer.read_data_file(input_path)
            if df is None:
                logger.error("❌ 文件读取失败")
                return False
            
            # 验证API连接（如果OpenAI可用）
            if self.client:
                if not self.validate_api_connection():
                    logger.error("❌ API连接验证失败，无法继续处理")
                    return False
            else:
                logger.warning("⚠️ OpenAI客户端不可用，将直接复制文件")
                # 如果没有OpenAI，直接复制文件
                df.to_excel(output_path, index=False)
                return True
            
            # 为每个开放题字段创建翻译列
            for col in open_ended_fields:
                if col in df.columns:
                    col_idx = list(df.columns).index(col)
                    cn_col = f"{col}-CN"
                    
                    # 插入新列
                    df.insert(col_idx + 1, cn_col, "")
                    logger.info(f"📍 {cn_col} 插入在 {col} 后面 (索引 {col_idx+1})")
            
            # 批量翻译处理
            BATCH_SIZE = 50
            total_rows = len(df)
            
            for col in open_ended_fields:
                if col not in df.columns:
                    continue
                    
                logger.info(f"\n🚀 开始翻译列: {col}")
                cn_col = f"{col}-CN"
                
                # 准备文本数据
                texts = df[col].fillna('').astype(str).tolist()
                logger.info(f"📋 列 {col} 的文本数据量: {len(texts)}")
                
                translations = []
                
                # 使用已有的批量翻译方法
                translations = self._batch_translate_texts(texts, col, BATCH_SIZE)
                
                # 更新DataFrame
                df[cn_col] = translations
                logger.info(f"✅ 列 {col} 翻译完成")
            
            # 保存结果
            df.to_excel(output_path, index=False)
            logger.info(f"✅ 翻译结果已保存: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 翻译处理失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def standard_labeling_only(self, input_path, output_path):
        """只进行标准AI分类，基于已翻译的数据"""
        try:
            logger.info(f"🔧 开始标准AI分类处理: {input_path} -> {output_path}")
            
            # 读取已翻译的文件
            df = self.analyzer.read_data_file(input_path)
            if df is None:
                logger.error("❌ 文件读取失败")
                return False
            
            # 验证API连接（如果OpenAI可用）
            if self.client:
                if not self.validate_api_connection():
                    logger.error("❌ API连接验证失败，无法继续处理")
                    return False
            else:
                logger.warning("⚠️ OpenAI客户端不可用，将直接复制文件")
                df.to_excel(output_path, index=False)
                return True
            
            # 识别已翻译的-CN字段
            cn_columns = [col for col in df.columns if col.endswith('-CN')]
            logger.info(f"🔍 发现 {len(cn_columns)} 个已翻译的-CN字段: {cn_columns}")
            
            if not cn_columns:
                logger.error("❌ 未找到已翻译的-CN字段")
                return False
            
            # 为每个-CN字段添加分类列
            for cn_col in cn_columns:
                original_col = cn_col.replace('-CN', '')
                
                # 找到-CN列的位置
                cn_col_idx = list(df.columns).index(cn_col)
                
                # 创建分类列
                sub_tags_col = f"{original_col}二级标签"
                main_topic_col = f"{original_col}一级主题"
                
                # 插入新列
                df.insert(cn_col_idx + 1, sub_tags_col, "")
                df.insert(cn_col_idx + 2, main_topic_col, "")
                
                logger.info(f"📍 为 {cn_col} 添加分类列: {sub_tags_col}, {main_topic_col}")
            
            # 批量分类处理
            BATCH_SIZE = 50
            
            for cn_col in cn_columns:
                original_col = cn_col.replace('-CN', '')
                sub_tags_col = f"{original_col}二级标签"
                main_topic_col = f"{original_col}一级主题"
                
                logger.info(f"\n🚀 开始为 {cn_col} 进行AI分类")
                
                # 准备已翻译的文本数据
                texts = df[cn_col].fillna('').astype(str).tolist()
                logger.info(f"📋 已翻译文本数据量: {len(texts)}")
                
                sub_tags = []
                main_topics = []
                
                # 批量分类
                batches = [texts[i:i+BATCH_SIZE] for i in range(0, len(texts), BATCH_SIZE)]
                logger.info(f"📊 分成 {len(batches)} 个批次分类，批次大小: {BATCH_SIZE}")
                
                for batch_idx, batch in enumerate(batches):
                    logger.info(f"🔄 分类批次 {batch_idx + 1}/{len(batches)}")
                    
                    # 批量翻译+分类 (使用已有方法)
                    batch_results = self.batch_translate_and_tag(batch, original_col, "中文", "中文", 15)
                    
                    # 提取结果 - batch_translate_and_tag 返回 [(translation, tags), ...]
                    for translation, tags in batch_results:
                        # 将标签分割为二级标签，并生成简化的一级主题
                        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()] if tags else []
                        
                        # 二级标签：使用所有生成的标签
                        sub_tags.append(','.join(tag_list))
                        
                        # 一级主题：使用第一个标签作为主要主题，如果没有标签则为空
                        main_topic = tag_list[0] if tag_list else ''
                        main_topics.append(main_topic)
                    
                    # 添加延迟避免API限制
                    if batch_idx < len(batches) - 1:
                        time.sleep(1)
                
                # 更新DataFrame
                df[sub_tags_col] = sub_tags
                df[main_topic_col] = main_topics
                logger.info(f"✅ {cn_col} AI分类完成")
            
            # 保存结果
            df.to_excel(output_path, index=False)
            logger.info(f"✅ 标准AI分类结果已保存: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 标准AI分类处理失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False


if __name__ == "__main__":
    # 主程序入口
    logger.info("=" * 80)
    logger.info("🚀 问卷翻译分类器启动")
    logger.info("=" * 80)
    
    try:
        # 创建翻译分类器实例
        classifier = QuestionnaireTranslationClassifier()
        
        # 检查命令行参数
        if len(sys.argv) > 1:
            input_file = sys.argv[1]
            output_file = sys.argv[2] if len(sys.argv) > 2 else None
            logger.info(f"📁 输入文件: {input_file}")
            if output_file:
                logger.info(f"💾 输出文件: {output_file}")
            classifier.process_table(input_file, output_file)
        else:
            # 交互式模式
            logger.info("🎯 交互式模式 - 请选择要处理的文件")
            classifier.process_table()
        
        logger.info("=" * 80)
        logger.info("✨ 程序执行完成")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"\n❌ 处理过程中发生严重错误: {e}")
        logger.error("💡 建议检查:")
        logger.error("1. OpenAI API密钥是否正确")
        logger.error("2. 网络连接是否正常")
        logger.error("3. 输入文件格式是否正确")
        logger.error("4. universal_questionnaire_analyzer.py 文件是否存在")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1) 