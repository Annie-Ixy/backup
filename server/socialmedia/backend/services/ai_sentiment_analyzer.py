# -*- coding: utf-8 -*-
"""
AI情感分析服务
使用OpenAI GPT-4进行深度情感分析和舆情总结
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
from openai import OpenAI
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

logger = logging.getLogger(__name__)

class AISentimentAnalyzer:
    """AI情感分析器 - 使用单例模式避免重复初始化"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AISentimentAnalyzer, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化OpenAI客户端（只在第一次创建实例时执行）"""
        if self._initialized:
            return
            
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4')
        self.max_tokens = int(os.getenv('OPENAI_MAX_TOKENS', 2000))
        self.temperature = float(os.getenv('OPENAI_TEMPERATURE', 0.3))
        
        if not self.api_key:
            logger.warning("OpenAI API密钥未配置，AI分析功能将不可用")
            self.client = None
        else:
            self.client = OpenAI(api_key=self.api_key)
            logger.info("OpenAI客户端初始化成功")
            
        AISentimentAnalyzer._initialized = True
    
    def is_available(self) -> bool:
        """检查AI分析服务是否可用"""
        return self.client is not None
    
    def analyze_extreme_negative(self, text: str, ai_sentiment: str) -> bool:
        """
        检测是否为极端负面评论
        
        Args:
            text: 评论文本
            ai_sentiment: AI情感分析结果
            
        Returns:
            是否为极端负面评论
        """
        try:
            # 只对负面评论进行极端负面检测
            if ai_sentiment != 'negative':
                return False
            
            # 1. 基础规则检测
            rule_based_score = self._rule_based_extreme_detection(text)
            
            # 2. AI深度检测（仅对可能的极端负面进行）
            if rule_based_score > 0.3 and self.is_available():  # 阈值过滤
                ai_extreme_score = self._ai_extreme_detection(text)
                final_score = (rule_based_score + ai_extreme_score) / 2
                return final_score >= 0.6  # 调整阈值：降低至0.6以更好地识别极端负面
            
            # 如果AI不可用，仅使用规则检测
            return rule_based_score >= 0.6  # 纯规则阈值：调整至0.6以匹配AI+规则的判断
            
        except Exception as e:
            logger.error(f"极端负面检测失败: {e}")
            return False
    
    def _rule_based_extreme_detection(self, text: str) -> float:
        """基于规则的极端负面检测"""
        try:
            score = 0.0
            text_lower = text.lower()
            

            # 检测多个感叹号/问号
            exclamation_count = text.count('!') + text.count('?') + text.count('！') + text.count('？')
            if exclamation_count >= 2:
                score += 0.1
                logger.debug(f"检测到多个感叹号/问号: {exclamation_count}个")
            
            # 检测侮辱性词汇（中英文）
            insult_keywords = [
                # 中文侮辱词汇
                '垃圾', '傻逼', '坑爹', '骗子', '黑心', '恶心', '坑人', '草', '妈的',
                '狗屎', '操', '卧槽', '尼玛', '滚', '死', '脑残', '白痴', '弱智', 
                '蠢货', '废物', '渣渣', '智障', '二逼', '煞笔', '傻叉', '贱', 
                '低级', '恶劣', '下流', '无耻', '可耻', '丢人', '糟糕', '破烂',
                '混蛋', '王八蛋', '狗东西', '畜生', '禽兽', '人渣', '败类',
                '神经病', '有病', '缺德', '恶毒', '阴险', '卑鄙', '龌龊',
                
                # 英文侮辱词汇
                'shit', 'fuck', 'damn', 'stupid', 'idiot', 'garbage', 'trash', 'scam',
                'asshole', 'bitch', 'bastard', 'crap', 'suck', 'moron', 'jerk',
                'loser', 'pathetic', 'disgusting', 'awful', 'terrible', 'horrible',
                'worthless', 'useless', 'ridiculous', 'absurd', 'nonsense', 'bullshit',
                'dumb', 'retarded', 'crazy', 'insane', 'sick', 'twisted', 'evil'
            ]
            for keyword in insult_keywords:
                if keyword in text_lower:
                    score += 0.3
                    logger.debug(f"检测到侮辱性词汇: {keyword}")
                    break
            
            # 检测威胁性语言
            threat_keywords = [
                # 中文威胁词汇
                '投诉', '曝光', '举报', '起诉', '报警', '媒体', '监管', '工商', '法院',
                '告发', '检举', '揭发', '揭露', '告状', '上诉', '申诉', '控告',
                '律师', '法律', '诉讼', '赔偿', '维权', '打官司', '法庭', '仲裁',
                '消费者协会', '消协', '12315', '记者', '新闻', '电视台', '报社',
                '网络', '微博', '朋友圈', '公开', '公布', '传播', '扩散', '转发',
                '封杀', '抵制', '黑名单', '拉黑', '删除', '屏蔽', '查封', '关闭',
                '威胁', '恐吓', '警告', '后果', '严重', '负责', '追究', '惩罚',
                
                # 英文威胁词汇
                'sue', 'lawsuit', 'report', 'expose', 'media', 'police', 'court',
                'lawyer', 'legal', 'prosecution', 'complain', 'complaint', 'authority',
                'government', 'department', 'agency', 'investigation', 'expose',
                'publish', 'broadcast', 'journalist', 'reporter', 'news', 'press',
                'social media', 'facebook', 'twitter', 'instagram', 'youtube',
                'boycott', 'blacklist', 'ban', 'block', 'delete', 'remove', 'shut down',
                'threaten', 'warning', 'consequence', 'serious', 'responsible', 'punishment'
            ]
            for keyword in threat_keywords:
                if keyword in text_lower:
                    score += 0.3
                    logger.debug(f"检测到威胁性语言: {keyword}")
                    break
            
            # 检测强烈负面情绪词汇
            extreme_negative_words = [
                # 中文极端负面情绪词汇
                '恶劣', '恶心', '愤怒', '气死', '崩溃', '绝望', '愤慨', '痛恨', '厌恶',
                '暴怒', '狂怒', '发疯', '抓狂', '疯狂', '失望', '沮丧', '难过',
                '心碎', '痛苦', '煎熬', '折磨', '受罪', '悲惨', '凄惨', '惨不忍睹',
                '无语', 'speechless', '震惊', '惊讶', '不敢相信', '无法接受',
                '后悔', '遗憾', '可惜', '白费', '浪费', '亏', '损失', '倒霉',
                '糟糕', '糟透', '完蛋', '毁了', '砸了', '废了', '完了', '死定了',
                '受够了', '忍无可忍', '极限', '爆发', '彻底', '完全', '彻底失望',
                '心寒', '心凉', '寒心', '心死', '死心', '放弃', '算了', '不要了',
                
                # 英文极端负面情绪词汇
                'terrible', 'horrible', 'awful', 'disgusting', 'furious', 'hate', 'despise',
                'outrageous', 'unacceptable', 'intolerable', 'unbearable', 'devastating',
                'shocking', 'appalling', 'disgusting', 'revolting', 'sickening',
                'frustrated', 'annoyed', 'irritated', 'pissed', 'mad', 'angry', 'rage',
                'disappointed', 'heartbroken', 'devastated', 'crushed', 'destroyed',
                'hopeless', 'desperate', 'miserable', 'suffering', 'painful', 'agony',
                'nightmare', 'disaster', 'catastrophe', 'failure', 'ruined', 'wasted',
                'regret', 'sorry', 'unfortunate', 'unlucky', 'bad luck', 'curse',
                'enough', 'fed up', 'sick of', 'tired of', 'done with', 'give up', 'junk'
            ]
            extreme_count = sum(1 for word in extreme_negative_words if word in text_lower)
            if extreme_count >= 1:
                score += 0.3
                logger.debug(f"检测到多个极端负面词汇: {extreme_count}个")
            
            # 检测服务相关负面词汇
            service_negative_words = [
                # 中文服务负面词汇
                '服务差', '态度差', '不耐烦', '不礼貌', '粗鲁', '傲慢', '冷淡',
                '不专业', '不负责', '敷衍', '推脱', '踢皮球', '拖延', '效率低',
                '回复慢', '不回复', '联系不上', '找不到人', '客服差', '售后差',
                '不解决问题', '解决不了', '处理不当', '态度恶劣', '欺骗客户',
                '虚假承诺', '说一套做一套', '言而无信', '不守信用', '骗钱',
                
                # 英文服务负面词汇
                'poor service', 'bad service', 'terrible service', 'rude', 'unprofessional',
                'unhelpful', 'slow response', 'no response', 'ignore', 'dismissive',
                'arrogant', 'condescending', 'incompetent', 'irresponsible', 'unreliable',
                'misleading', 'deceptive', 'dishonest', 'fraudulent', 'scam', 'cheat'
            ]
            
            # 统计服务负面词汇
            service_count = sum(1 for word in service_negative_words if word in text_lower)
            
            if service_count >= 1:
                score += 0.2
                logger.debug(f"检测到服务相关负面词汇: {service_count}个")
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.error(f"规则检测失败: {e}")
            return 0.0
    
    def _ai_extreme_detection(self, text: str) -> float:
        """AI深度极端负面检测"""
        try:
            if not self.is_available():
                return 0.0
            
            prompt = f"""
判断以下评论的极端负面程度（返回0-1的数字分数）：

评估维度：
1. 是否包含严重侮辱或威胁（0.4分）
2. 是否表达极端愤怒或仇恨（0.3分）
3. 是否可能造成品牌严重损害（0.3分）

评论：{text}

只返回0-1的数字分数，不要其他解释。
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的文本情感极端程度评估专家。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0.1
            )
            
            score_text = response.choices[0].message.content.strip()
            
            # 尝试解析分数
            try:
                score = float(score_text)
                return max(0.0, min(1.0, score))  # 确保在0-1范围内
            except ValueError:
                logger.warning(f"AI返回的分数格式不正确: {score_text}")
                return 0.0
                
        except Exception as e:
            logger.error(f"AI极端负面检测失败: {e}")
            return 0.0
    
    def analyze_single_text(self, text: str) -> Dict[str, Any]:
        """
        单条文本情感分析
        
        Args:
            text: 待分析的文本
            
        Returns:
            分析结果字典
        """
        if not self.is_available():
            logger.error("OpenAI服务不可用")
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'error': 'OpenAI服务不可用'
            }
        
        if not text or len(text.strip()) == 0:
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'error': '文本为空'
            }
        
        try:
            prompt = f"""
请分析以下文本的情感倾向，只返回JSON格式的结果：

文本: "{text}"

请返回以下格式的JSON:
{{
    "sentiment": "positive|negative|neutral",
    "confidence": 0.0-1.0的数值,
    "reasoning": "分析reasoning"
}}

其中sentiment必须是以下三个值之一：
- positive: 积极正面的情感
- negative: 消极负面的情感  
- neutral: 中性情感

confidence表示分析的置信度，范围0.0-1.0。
"""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的情感分析助手，请仅返回JSON格式的分析结果。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=self.temperature
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # 清理可能的代码块包裹
            if result_text.startswith('```json'):
                result_text = result_text.replace('```json', '').replace('```', '').strip()
            elif result_text.startswith('```'):
                result_text = result_text.replace('```', '').strip()
            
            # 尝试解析JSON
            try:
                import json
                result = json.loads(result_text)
                
                # 验证结果格式
                sentiment = result.get('sentiment', '').lower()
                if sentiment not in ['positive', 'negative', 'neutral']:
                    sentiment = 'neutral'
                
                confidence = float(result.get('confidence', 0.0))
                confidence = max(0.0, min(1.0, confidence))  # 确保在0-1范围内
                
                return {
                    'sentiment': sentiment,
                    'confidence': confidence,
                    'reasoning': result.get('reasoning', ''),
                    'error': None
                }
                
            except json.JSONDecodeError:
                logger.error(f"无法解析AI响应: {result_text}")
                return {
                    'sentiment': 'neutral',
                    'confidence': 0.0,
                    'error': f'AI响应格式错误: {result_text}'
                }
                
        except Exception as e:
            logger.error(f"AI情感分析失败: {e}")
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'error': str(e)
            }

    def analyze_sentiment_batch(self, texts: List[str], max_batch_size: int = 5) -> List[Dict[str, Any]]:
        """
        批量情感分析
        
        Args:
            texts: 文本列表
            max_batch_size: 批次大小（降低以减少成本和提高稳定性）
            
        Returns:
            分析结果列表
        """
        if not self.is_available():
            logger.error("OpenAI服务不可用")
            return [{'sentiment': 'neutral', 'confidence': 0.0, 'error': 'OpenAI服务不可用'} for _ in texts]
        
        results = []
        
        # 分批处理，对每条文本单独分析以提高准确性
        for i, text in enumerate(texts):
            logger.info(f"处理第 {i+1}/{len(texts)} 条文本")
            result = self.analyze_single_text(text)
            results.append(result)
            
            # 简单的API限流，避免过快调用
            import time
            time.sleep(0.5)  # 每次调用间隔0.5秒
        
        return results
    
    def analyze_texts_for_upload(self, texts: List[str]) -> Dict[str, Any]:
        """
        专门用于文件上传时的批量文本情感分析
        
        Args:
            texts: 文本列表
            
        Returns:
            包含分析结果和统计信息的字典
        """
        if not self.is_available():
            logger.warning("OpenAI服务不可用，跳过AI情感分析")
            return {
                'results': [{'sentiment': 'neutral', 'confidence': 0.0, 'error': 'OpenAI服务不可用'} for _ in texts],
                'stats': {
                    'total': len(texts),
                    'success': 0,
                    'positive': 0,
                    'negative': 0,
                    'neutral': 0,
                    'failed': len(texts)
                },
                'available': False
            }
        
        logger.info(f"🤖 开始AI情感分析，共 {len(texts)} 条文本")
        print(f"🤖 开始AI情感分析，共 {len(texts)} 条文本")
        
        # 批量分析
        results = []
        stats = {
            'total': len(texts),
            'success': 0,
            'positive': 0,
            'negative': 0,
            'neutral': 0,
            'failed': 0
        }
        
        for i, text in enumerate(texts):
            if i % 10 == 0:  # 每10条输出一次进度
                logger.info(f"AI分析进度: {i+1}/{len(texts)}")
                print(f"🔄 AI分析进度: {i+1}/{len(texts)}")
            
            result = self.analyze_single_text(text)
            results.append(result)
            
            # 统计结果
            if result.get('error'):
                stats['failed'] += 1
            else:
                stats['success'] += 1
                sentiment = result.get('sentiment', 'neutral')
                if sentiment in ['positive', 'negative', 'neutral']:
                    stats[sentiment] += 1
                else:
                    stats['neutral'] += 1
            
            # API限流
            import time
            time.sleep(0.3)  # 稍微降低间隔时间
        
        # 输出最终统计
        success_msg = f"🤖 AI情感分析完成: 成功{stats['success']}条，总共{stats['total']}条，其中positive {stats['positive']}条，negative {stats['negative']}条，neutral {stats['neutral']}条"
        logger.info(success_msg)
        print(success_msg)
        
        if stats['failed'] > 0:
            error_msg = f"⚠️ AI分析失败 {stats['failed']} 条"
            logger.warning(error_msg)
            print(error_msg)
        
        return {
            'results': results,
            'stats': stats,
            'available': True
        }
    
    def _analyze_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """分析单个批次"""
        try:
            # 构建提示词
            prompt = self._build_sentiment_prompt(texts)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的情感分析专家，擅长分析社交媒体内容的情感倾向。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            # 解析响应
            analysis_text = response.choices[0].message.content
            return self._parse_sentiment_response(analysis_text, texts)
            
        except Exception as e:
            logger.error(f"批量情感分析失败: {e}")
            return [{"sentiment": "unknown", "confidence": 0.0, "keywords": []} for _ in texts]
    
    def _build_sentiment_prompt(self, texts: List[str]) -> str:
        """构建情感分析提示词"""
        numbered_texts = []
        for i, text in enumerate(texts, 1):
            # 限制单个文本长度
            truncated_text = text[:200] + "..." if len(text) > 200 else text
            numbered_texts.append(f"{i}. {truncated_text}")
        
        return f"""
请对以下{len(texts)}条社交媒体评论进行情感分析。对每条评论，请提供：
1. 情感倾向：positive（正面）、negative（负面）、neutral（中性）
2. 置信度：0-1之间的数值
3. 关键情感词汇：最多3个

评论内容：
{chr(10).join(numbered_texts)}

请按以下JSON格式返回结果：
{{
  "analyses": [
    {{
      "index": 1,
      "sentiment": "positive/negative/neutral",
      "confidence": 0.85,
      "keywords": ["关键词1", "关键词2"],
      "reason": "简短分析原因"
    }}
  ]
}}
"""
    
    def _parse_sentiment_response(self, response_text: str, original_texts: List[str]) -> List[Dict[str, Any]]:
        """解析情感分析响应"""
        try:
            import json
            # 尝试提取JSON部分
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx >= 0 and end_idx > start_idx:
                json_text = response_text[start_idx:end_idx]
                data = json.loads(json_text)
                
                results = []
                analyses = data.get('analyses', [])
                
                for i, text in enumerate(original_texts):
                    if i < len(analyses):
                        analysis = analyses[i]
                        results.append({
                            "sentiment": analysis.get("sentiment", "neutral"),
                            "confidence": float(analysis.get("confidence", 0.5)),
                            "keywords": analysis.get("keywords", []),
                            "reason": analysis.get("reason", ""),
                            "original_text": text[:100] + "..." if len(text) > 100 else text
                        })
                    else:
                        results.append({
                            "sentiment": "neutral",
                            "confidence": 0.5,
                            "keywords": [],
                            "reason": "分析失败",
                            "original_text": text[:100] + "..." if len(text) > 100 else text
                        })
                
                return results
        
        except Exception as e:
            logger.error(f"解析情感分析响应失败: {e}")
        
        # 如果解析失败，返回默认结果
        return [{"sentiment": "neutral", "confidence": 0.5, "keywords": [], "reason": "解析失败"} for _ in original_texts]
    
    def generate_comprehensive_chart_summary(self, sentiment_stats: Dict[str, Any],
                                           chart_data: Dict[str, Any],
                                           sentiment_trends: Dict[str, Any],
                                           channel_sentiment: Dict[str, Any],
                                           hourly_analysis: Dict[str, Any],
                                           sample_comments: Dict[str, List[str]]) -> str:
        """
        生成基于图表数据的综合分析总结
        
        Args:
            sentiment_stats: 情感统计数据
            chart_data: 图表数据(饼图、趋势图、渠道图、时间分布图)
            sentiment_trends: 情感趋势数据
            channel_sentiment: 渠道情感分布
            hourly_analysis: 24小时情感分布
            sample_comments: 样本评论
            
        Returns:
            AI生成的综合图表分析报告
        """
        if not self.is_available():
            return self._generate_fallback_chart_summary(sentiment_stats, chart_data, sentiment_trends)
        
        try:
            prompt = self._build_comprehensive_chart_prompt(
                sentiment_stats, chart_data, sentiment_trends, 
                channel_sentiment, hourly_analysis, sample_comments
            )
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你必须只用不超过3句话回答。不能有标题、分段、列表。只给出最重要的结论。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,  # 进一步减少token数
                temperature=0.3
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"生成综合图表分析失败: {e}")
            return self._generate_fallback_chart_summary(sentiment_stats, chart_data, sentiment_trends)
    
    def generate_sentiment_summary(self, sentiment_stats: Dict[str, Any], 
                                 sample_comments: Dict[str, List[str]],
                                 time_trends: Dict[str, Any] = None,
                                 channel_stats: Dict[str, Any] = None) -> str:
        """
        生成情感分析总结报告
        
        Args:
            sentiment_stats: 情感统计数据
            sample_comments: 样本评论
            time_trends: 时间趋势数据
            channel_stats: 渠道统计数据
            
        Returns:
            AI生成的总结报告
        """
        if not self.is_available():
            return self._generate_fallback_summary(sentiment_stats)
        
        try:
            prompt = self._build_summary_prompt(sentiment_stats, sample_comments, time_trends, channel_stats)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的舆情分析专家，擅长生成清晰、准确的舆情分析报告。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"生成情感总结失败: {e}")
            return self._generate_fallback_summary(sentiment_stats)
    
    def _build_summary_prompt(self, sentiment_stats: Dict[str, Any], 
                            sample_comments: Dict[str, List[str]],
                            time_trends: Dict[str, Any] = None,
                            channel_stats: Dict[str, Any] = None) -> str:
        """构建总结报告提示词"""
        
        # 基础统计信息
        total = sentiment_stats.get('total_comments', 0)
        positive_rate = sentiment_stats.get('positive_rate', 0)
        negative_rate = sentiment_stats.get('negative_rate', 0)
        neutral_rate = sentiment_stats.get('neutral_rate', 0)
        
        # 样本评论
        positive_samples = sample_comments.get('positive', [])[:3]
        negative_samples = sample_comments.get('negative', [])[:3]
        
        prompt = f"""
请基于以下数据生成一份专业的舆情分析报告：

## 数据概览
- 总评论数：{total}条
- 正面情感：{positive_rate:.1f}%
- 负面情感：{negative_rate:.1f}%
- 中性情感：{neutral_rate:.1f}%

## 样本评论
### 正面评论样本：
{chr(10).join([f"- {comment[:100]}..." for comment in positive_samples]) if positive_samples else "暂无"}

### 负面评论样本：
{chr(10).join([f"- {comment[:100]}..." for comment in negative_samples]) if negative_samples else "暂无"}

## 渠道分布
{self._format_channel_stats(channel_stats) if channel_stats else "暂无渠道数据"}

请生成一份包含以下内容的分析报告：
1. **总体情感趋势**：简要概述整体情感分布
2. **关键发现**：重点关注的问题和亮点
3. **风险提醒**：需要注意的负面情感和潜在风险
4. **建议措施**：基于分析结果的具体建议

要求：
- 语言简洁专业，条理清晰
- 突出重点数据和趋势
- 提供可执行的建议
- 总字数控制在500字以内
"""
        return prompt
    
    def _format_channel_stats(self, channel_stats: Dict[str, Any]) -> str:
        """格式化渠道统计信息"""
        if not channel_stats:
            return "暂无渠道数据"
        
        lines = []
        for channel, stats in channel_stats.items():
            if isinstance(stats, dict):
                lines.append(f"- {channel}: {sum(stats.values())}条评论")
        
        return chr(10).join(lines) if lines else "暂无渠道数据"
    
    def _generate_fallback_summary(self, sentiment_stats: Dict[str, Any]) -> str:
        """生成备用总结（当AI不可用时）"""
        total = sentiment_stats.get('total_comments', 0)
        positive_rate = sentiment_stats.get('positive_rate', 0)
        negative_rate = sentiment_stats.get('negative_rate', 0)
        neutral_rate = sentiment_stats.get('neutral_rate', 0)
        
        return f"""
## 舆情分析总结

### 总体情感分布
本次分析共处理 {total} 条评论，情感分布如下：
- 正面情感：{positive_rate:.1f}%
- 负面情感：{negative_rate:.1f}%  
- 中性情感：{neutral_rate:.1f}%

### 关键发现
{'负面情感占比较高，需要重点关注' if negative_rate > 40 else '情感分布相对均衡'}

### 建议措施
- 密切监控负面评论，及时响应用户关切
- 分析负面评论的具体原因，制定改进措施
- 加强正面内容的传播和推广

*注：AI分析服务当前不可用，以上为基础统计分析结果*
"""


    
    def _build_comprehensive_chart_prompt(self, sentiment_stats: Dict[str, Any],
                                         chart_data: Dict[str, Any],
                                         sentiment_trends: Dict[str, Any],
                                         channel_sentiment: Dict[str, Any],
                                         hourly_analysis: Dict[str, Any],
                                         sample_comments: Dict[str, List[str]]) -> str:
        """构建综合图表分析提示词"""
        
        # 提取关键数据
        total = sentiment_stats.get('total_comments', 0)
        positive_rate = sentiment_stats.get('positive_rate', 0)
        negative_rate = sentiment_stats.get('negative_rate', 0)
        neutral_rate = sentiment_stats.get('neutral_rate', 0)
        
        # 图表数据分析
        pie_data = chart_data.get('pie_data', [])
        trend_data = chart_data.get('trend_data', {})
        channel_data = chart_data.get('channel_data', {})
        hourly_data = chart_data.get('hourly_data', {})
        
        # 构建简化提示词
        prompt = f"""
数据：{total}条评论，正面{positive_rate:.1f}%，负面{negative_rate:.1f}%，中性{neutral_rate:.1f}%。{self._format_trend_data(trend_data)}。

用2-3句话分析：整体情感倾向和主要发现，给出一个建议。
"""
        return prompt
    
    def _format_trend_data(self, trend_data: Dict[str, Any]) -> str:
        """格式化趋势数据"""
        if not trend_data:
            return "- 暂无趋势数据"
        
        dates = trend_data.get('dates', [])
        positive = trend_data.get('positive', [])
        negative = trend_data.get('negative', [])
        
        if not dates or len(dates) < 2:
            return "- 数据点不足，无法分析趋势"
        
        # 简单的趋势分析
        pos_trend = "上升" if positive[-1] > positive[0] else "下降"
        neg_trend = "上升" if negative[-1] > negative[0] else "下降"
        
        return f"""- 时间跨度：{dates[0]} 至 {dates[-1]}
- 正面情感趋势：{pos_trend}
- 负面情感趋势：{neg_trend}"""
    
    def _format_channel_data(self, channel_data: Dict[str, Any]) -> str:
        """格式化渠道数据"""
        if not channel_data:
            return "- 暂无渠道数据"
        
        channels = channel_data.get('channels', [])
        if not channels:
            return "- 暂无渠道数据"
        
        return f"- 涉及渠道：{', '.join(channels[:5])}{'等' if len(channels) > 5 else ''}"
    
    def _format_hourly_data(self, hourly_data: Dict[str, Any]) -> str:
        """格式化小时数据"""
        if not hourly_data:
            return "- 暂无时间分布数据"
        
        hours = hourly_data.get('hours', [])
        positive = hourly_data.get('positive', [])
        
        if not hours or not positive:
            return "- 暂无时间分布数据"
        
        # 找到活跃时段
        max_idx = positive.index(max(positive)) if positive else 0
        peak_hour = hours[max_idx] if max_idx < len(hours) else 0
        
        return f"- 最活跃时段：{peak_hour}:00-{peak_hour+1}:00"
    
    def _generate_fallback_chart_summary(self, sentiment_stats: Dict[str, Any],
                                       chart_data: Dict[str, Any],
                                       sentiment_trends: Dict[str, Any]) -> str:
        """生成fallback图表综合总结"""
        try:
            total = sentiment_stats.get('total_comments', 0)
            positive_count = sentiment_stats.get('positive_count', 0)
            negative_count = sentiment_stats.get('negative_count', 0)
            neutral_count = sentiment_stats.get('neutral_count', 0)
            
            positive_rate = round((positive_count / total) * 100, 1) if total > 0 else 0
            negative_rate = round((negative_count / total) * 100, 1) if total > 0 else 0
            neutral_rate = round((neutral_count / total) * 100, 1) if total > 0 else 0
            
            # 分析图表数据
            trend_analysis = self._analyze_trend_data(chart_data.get('trend_data', {}))
            channel_analysis = self._analyze_channel_data(chart_data.get('channel_data', {}))
            
            # 判断主要情感倾向
            if positive_rate >= 40:
                sentiment_desc = "整体情感偏向积极"
            elif negative_rate >= 30:
                sentiment_desc = "需要关注负面反馈"
            else:
                sentiment_desc = "情感分布相对平衡"
            
            # 生成简洁总结
            summary = f"""基于{total}条评论分析：{sentiment_desc}（正面{positive_rate}%，负面{negative_rate}%，中性{neutral_rate}%）。{trend_analysis.replace('• ', '')} 建议{self._get_strategy_suggestion(negative_rate).lower()}。"""
            
            return summary
            
        except Exception as e:
            logger.error(f"生成fallback图表总结失败: {e}")
            return "数据分析总结生成失败，请重试。"
    
    def _analyze_trend_data(self, trend_data: Dict[str, Any]) -> str:
        """分析趋势数据"""
        if not trend_data or not trend_data.get('dates'):
            return "情感趋势稳定"
        
        dates = trend_data.get('dates', [])
        positive = trend_data.get('positive', [])
        negative = trend_data.get('negative', [])
        
        if len(dates) < 2:
            return "情感趋势稳定"
        
        # 简单趋势分析
        pos_change = positive[-1] - positive[0] if len(positive) >= 2 else 0
        neg_change = negative[-1] - negative[0] if len(negative) >= 2 else 0
        
        if pos_change > 0 and neg_change > 0:
            return "正负面情感均有上升"
        elif pos_change > 0:
            return "正面情感呈上升趋势"
        elif neg_change > 0:
            return "负面情感有所增加"
        else:
            return "情感趋势保持稳定"
    
    def _analyze_channel_data(self, channel_data: Dict[str, Any]) -> str:
        """分析渠道数据"""
        if not channel_data or not channel_data.get('channels'):
            return "• 渠道数据不足，建议收集更多平台的反馈"
        
        channels = channel_data.get('channels', [])
        return f"• 覆盖{len(channels)}个主要渠道，建议重点关注表现差异较大的平台"
    
    def _determine_sentiment_trend(self, positive_rate: float, negative_rate: float, neutral_rate: float) -> str:
        """判断情感趋势"""
        if positive_rate >= 50:
            return "整体偏向积极"
        elif negative_rate >= 50:
            return "需要关注负面情绪"
        else:
            return "情感分布较为平衡"
    
    def _get_sentiment_level(self, negative_rate: float) -> str:
        """获取情感水平"""
        if negative_rate >= 40:
            return "较高"
        elif negative_rate >= 25:
            return "中等"
        else:
            return "较低"
    
    def _get_strategy_suggestion(self, negative_rate: float) -> str:
        """获取策略建议"""
        if negative_rate >= 40:
            return "立即制定针对性应对方案"
        elif negative_rate >= 25:
            return "加强用户沟通和问题解决"
        else:
            return "保持现有策略并持续优化"