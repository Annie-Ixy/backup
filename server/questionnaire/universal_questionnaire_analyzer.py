import pandas as pd
import os
import glob
from collections import defaultdict
import re
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import uuid
import json

# 加载环境变量（可选）
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv库未安装，将跳过环境变量加载")

# OpenAI配置（可选导入）
try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️  OpenAI库未安装，AI分析功能将被禁用")

# Flask应用配置
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 文件上传配置
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../uploads/questionnaire')
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'txt'}

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# 存储分析结果的内存数据结构
analysis_results = {}

class UniversalQuestionnaireAnalyzer:
    """通用问卷分析工具"""
    
    def __init__(self):
        # 单选题模式定义
        self.single_choice_patterns = {
            'binary_patterns': {
                'yes_no': {
                    'chinese': ['是', '否'],
                    'english': ['yes', 'no', 'y', 'n']
                },
                'true_false': {
                    'chinese': ['对', '错', '正确', '错误'],
                    'english': ['true', 'false', 't', 'f']
                },
                'selected_unselected': {
                    'chinese': ['已选择', '未选择', '选中', '未选中'],
                    'english': ['selected', 'not selected', 'unselected', 'checked', 'unchecked']
                },
                'agree_disagree': {
                    'chinese': ['同意', '不同意', '赞成', '反对'],
                    'english': ['agree', 'disagree', 'support', 'oppose']
                }
            },
            'satisfaction_patterns': {
                'satisfaction_basic': {
                    'chinese': ['非常满意', '满意', '一般', '不满意', '非常不满意'],
                    'english': ['very satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very dissatisfied']
                },
                'satisfaction_extended': {
                    'chinese': [
                        '极其满意', '非常满意', '比较满意', '适度满意', '既不满意也不不满意',
                        '适度不满意', '比较不满意', '非常不满意', '极其不满意'
                    ],
                    'english': [
                        'extremely satisfied', 'very satisfied', 'moderately satisfied', 'somewhat satisfied',
                        'neither satisfied nor dissatisfied', 'moderately dissatisfied', 'somewhat dissatisfied',
                        'very dissatisfied', 'extremely dissatisfied'
                    ]
                }
            },
            'rating_patterns': {
                'quality_3': {
                    'chinese': ['好', '中', '差', '优', '良', '劣'],
                    'english': ['good', 'fair', 'poor', 'excellent', 'average', 'bad']
                },
                'quality_5': {
                    'chinese': ['很好', '好', '一般', '差', '很差'],
                    'english': ['very good', 'good', 'average', 'poor', 'very poor']
                },
                'frequency': {
                    'chinese': ['经常', '偶尔', '很少', '从不', '总是', '有时'],
                    'english': ['often', 'sometimes', 'rarely', 'never', 'always', 'occasionally']
                }
            }
        }
        
        # 智能关键词检测（用于识别包含关键词的长选项）
        self.smart_keywords = {
            'binary_keywords': {
                'chinese': ['是', '否', '有', '没有', '会', '不会', '用过', '没用过'],
                'english': ['yes', 'no', 'have', 'never', 'used', 'not used', 'will', 'won\'t']
            },
            'frequency_keywords': {
                'chinese': ['经常', '偶尔', '很少', '从不', '总是', '有时', '每天', '每周'],
                'english': ['often', 'sometimes', 'rarely', 'never', 'always', 'daily', 'weekly', 'occasionally']
            },
            'satisfaction_keywords': {
                'chinese': ['满意', '不满意', '喜欢', '不喜欢', '好', '不好'],
                'english': ['satisfied', 'dissatisfied', 'like', 'dislike', 'good', 'bad', 'love', 'hate']
            }
        }
        
    def find_excel_files(self, directory=None):
        """查找目录中的Excel文件"""
        if directory is None:
            directory = os.path.dirname(os.path.abspath(__file__))
        
        excel_patterns = ['*.xlsx', '*.xls', '*.csv']
        excel_files = []
        
        for pattern in excel_patterns:
            files = glob.glob(os.path.join(directory, pattern))
            excel_files.extend(files)
        
        return excel_files
    
    def select_file_interactive(self):
        """交互式选择文件"""
        print("=" * 60)
        print("通用问卷分析工具")
        print("=" * 60)
        
        excel_files = self.find_excel_files()
        
        if not excel_files:
            print("当前目录未找到Excel或CSV文件")
            
            # 让用户输入文件路径
            file_path = input("请输入文件完整路径: ").strip().strip('"')
            if os.path.exists(file_path):
                return file_path
            else:
                print("文件不存在")
                return None
        
        print(f"发现 {len(excel_files)} 个数据文件:")
        for i, file in enumerate(excel_files, 1):
            filename = os.path.basename(file)
            print(f"{i:2d}. {filename}")
        
        if len(excel_files) == 1:
            print(f"\n自动选择唯一文件: {os.path.basename(excel_files[0])}")
            return excel_files[0]
        
        choice = input(f"\n请选择文件 (1-{len(excel_files)}): ").strip()
        
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(excel_files):
                return excel_files[idx]
            else:
                print("无效选择")
                return None
        except ValueError:
            print("输入格式错误")
            return None
    
    def read_data_file(self, file_path):
        """读取数据文件（支持Excel和CSV）"""
        try:
            print(f"正在读取文件: {os.path.basename(file_path)}")
            
            if file_path.endswith('.csv'):
                # 尝试不同的编码格式
                for encoding in ['utf-8', 'gbk', 'gb2312', 'latin1']:
                    try:
                        df = pd.read_csv(file_path, encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    raise Exception("无法识别CSV文件编码格式")
            else:
                df = pd.read_excel(file_path)
            
            print("=" * 50)
            print("文件读取成功！")
            print("=" * 50)
            print(f"数据行数: {len(df)}")
            print(f"数据列数: {len(df.columns)}")
            
            return df
            
        except Exception as e:
            print(f"读取文件时出错：{str(e)}")
            return None
    
    def is_numeric_scale(self, column_data, unique_values):
        """判断是否为数值型量表题"""
        # 方法1：pandas数据类型判断
        if column_data.dtype in ['int64', 'float64', 'int32', 'float32']:
            return True
        
        # 方法2：检查字符串是否都是数字
        if column_data.dtype == 'object':
            try:
                for value in unique_values:
                    if pd.notna(value):
                        float(str(value))  # 尝试转换为数字
                return True
            except (ValueError, TypeError):
                return False
        
        return False

    def preprocess_option_text(self, option):
        """预处理选项文本"""
        if pd.isna(option):
            return ""
        
        text = str(option).lower().strip()
        # 移除标点符号和连接词
        text = re.sub(r'[，。！？、；：""''（）【】\s\-_]', '', text)
        text = re.sub(r'\b(nor|and|or)\b', '', text)
        text = re.sub(r'(也不|和|或者)', '', text)
        
        return text

    def check_pattern_match(self, processed_values, pattern_data):
        """检查选项是否匹配特定模式（精确匹配）"""
        all_options = []
        
        # 合并中英文选项
        if 'chinese' in pattern_data:
            all_options.extend([self.preprocess_option_text(opt) for opt in pattern_data['chinese']])
        if 'english' in pattern_data:
            all_options.extend([self.preprocess_option_text(opt) for opt in pattern_data['english']])
        
        # 检查是否所有选项都在预定义模式中
        for value in processed_values:
            if value not in all_options:
                return False
                
        return True

    def check_smart_keywords(self, unique_values):
        """智能关键词检测 - 识别包含关键词的长选项"""
        # 预处理选项
        processed_values = [self.preprocess_option_text(v) for v in unique_values]
        
        # 检查每个关键词类别
        for keyword_type, keyword_data in self.smart_keywords.items():
            total_keywords = []
            
            # 收集所有关键词
            if 'chinese' in keyword_data:
                total_keywords.extend([self.preprocess_option_text(kw) for kw in keyword_data['chinese']])
            if 'english' in keyword_data:
                total_keywords.extend([self.preprocess_option_text(kw) for kw in keyword_data['english']])
            
            # 检查是否所有选项都精确匹配关键词
            all_match = True
            for value in processed_values:
                if value not in total_keywords:
                    all_match = False
                    break
            
            if all_match:
                return True, f"智能关键词检测-{keyword_type}"
        
        return False, "无关键词匹配"

    def match_single_choice_pattern(self, unique_values, unique_count):
        """匹配单选题模式（简化版）"""
        # 步骤1：预处理选项
        processed_values = [self.preprocess_option_text(v) for v in unique_values]
        
        # 步骤2：优先进行精确模式匹配
        for pattern_type, patterns in self.single_choice_patterns.items():
            for pattern_name, pattern_data in patterns.items():
                if self.check_pattern_match(processed_values, pattern_data):
                    return True, f"精确匹配-{pattern_type}-{pattern_name}"
        
        # 步骤3：智能关键词检测
        is_keyword_match, keyword_reason = self.check_smart_keywords(unique_values)
        if is_keyword_match:
            return True, keyword_reason
        
        # 步骤4：检查选项数量范围（1-10个即判定为单选题）
        if 1 <= unique_count <= 10:
            return True, f"选项数量特征({unique_count}个选项在1-10范围内)"
        
        return False, f"选项数量超出范围(需要1-10个，实际{unique_count}个)"
    
    def identify_all_question_types(self, df):
        """识别所有题型 - 新的三步判断法"""
        print("=" * 70)
        print("智能问卷分析 - 题型识别 (新逻辑)")
        print("=" * 70)
        
        # 初始化结果数据结构
        all_fields = df.columns.tolist()
        field_types = []
        
        # 初始化各题型列表
        scale_questions = []
        single_choice = []
        open_ended = []
        
        print(f"\n🔍 开始三步题型判断 (共 {len(all_fields)} 个字段)...")
        print("📊 判断顺序：1.量表题(数值型) → 2.单选题(固定选项) → 3.开放题(其余)")
        
        # 对每个字段进行三步判断
        for column in all_fields:
            column_data = df[column]
            unique_values = column_data.dropna().unique()
            unique_count = len(unique_values)
            
            # 准备字段信息
            field_info = {
                'column': column,
                'unique_count': unique_count,
                'data_type': str(column_data.dtype)
            }
            
            # 第一步：量表题识别（数值型）
            if self.is_numeric_scale(column_data, unique_values):
                field_info['type'] = 'scale'
                field_info['unique_values'] = sorted(unique_values) if unique_count <= 20 else unique_values[:10]
                scale_questions.append(field_info)
                print(f"      {column} -> 📊 量表题 (数值型，{unique_count}个不同值)")
                
            # 第二步：单选题识别（固定选项）
            else:
                is_single, reason = self.match_single_choice_pattern(unique_values, unique_count)
                if is_single:
                    field_info['type'] = 'single'
                    field_info['unique_values'] = list(unique_values)
                    field_info['match_reason'] = reason
                    single_choice.append(field_info)
                    print(f"      {column} -> ⚪ 单选题 ({reason}，{unique_count}个选项)")
                
                # 第三步：开放题识别（其余所有）
                else:
                    field_info['type'] = 'open'
                    field_info['reject_reason'] = reason
                    open_ended.append(field_info)
                    print(f"      {column} -> ✏️ 开放题 ({reason}，{unique_count}个不同值)")
            
            # 添加到结果列表
            field_types.append(field_info)
        
        # 输出识别结果
        self.print_new_question_type_results(scale_questions, single_choice, open_ended)
        
        return {
            'field_types': field_types,
            'scale_questions': scale_questions,
            'single_choice': single_choice,
            'open_ended': open_ended,
            'summary': {
                'total_fields': len(all_fields),
                'scale_questions': len(scale_questions),
                'single_choice': len(single_choice),
                'open_ended': len(open_ended)
            }
        }
    
    def print_new_question_type_results(self, scale_questions, single_choice, open_ended):
        """输出新的题型识别结果"""
        
        print(f"\n📊 量表题 ({len(scale_questions)} 个) - 数值型数据:")
        print("-" * 60)
        if scale_questions:
            for i, q in enumerate(scale_questions[:10], 1):
                print(f"{i:2d}. {q['column']}")
                print(f"     数据类型: {q['data_type']}, 不同值: {q['unique_count']}个")
                if q['unique_count'] <= 10:
                    print(f"     取值范围: {q['unique_values']}")
            if len(scale_questions) > 10:
                print(f"     ... 还有 {len(scale_questions)-10} 个量表题")
        else:
            print("   未发现量表题")
        
        print(f"\n⚪ 单选题 ({len(single_choice)} 个) - 固定选项:")
        print("-" * 60)
        if single_choice:
            for i, q in enumerate(single_choice[:10], 1):
                print(f"{i:2d}. {q['column']}")
                print(f"     匹配原因: {q.get('match_reason', '通用特征')}")
                print(f"     选项数: {q['unique_count']}个")
                if q['unique_count'] <= 5:
                    print(f"     选项内容: {list(q['unique_values'])}")
            if len(single_choice) > 10:
                print(f"     ... 还有 {len(single_choice)-10} 个单选题")
        else:
            print("   未发现单选题")
        
        print(f"\n✏️ 开放题 ({len(open_ended)} 个) - 其余题型:")
        print("-" * 60)
        if open_ended:
            for i, q in enumerate(open_ended[:10], 1):
                print(f"{i:2d}. {q['column']}")
                print(f"     排除原因: {q.get('reject_reason', '无法归类')}")
                print(f"     不同值: {q['unique_count']}个")
            if len(open_ended) > 10:
                print(f"     ... 还有 {len(open_ended)-10} 个开放题")
        else:
            print("   未发现开放题")
        
        # 统计摘要
        total_fields = len(scale_questions) + len(single_choice) + len(open_ended)
        
        print(f"\n📈 新逻辑统计摘要:")
        print("-" * 60)
        print(f"   总字段数: {total_fields} 个")
        print(f"   量表题: {len(scale_questions)} 个 ({len(scale_questions)/total_fields*100:.1f}%) - 数值型")
        print(f"   单选题: {len(single_choice)} 个 ({len(single_choice)/total_fields*100:.1f}%) - 固定选项")
        print(f"   开放题: {len(open_ended)} 个 ({len(open_ended)/total_fields*100:.1f}%) - 其余类型")
        print(f"   识别覆盖率: 100% (新逻辑不会遗漏任何字段)")
    
    def analyze_scale_question(self, df, column):
        """分析量表题，返回结构化的分析结果"""
        print(f"\n📊 量表题分析：{column}")
        print("=" * 80)
        
        data = df[column].dropna()
        
        if len(data) == 0:
            print("   无有效数据")
            return None
        
        # 准备返回结果
        result = {
            'column': column,
            'valid_samples': len(data),
            'stats': {},
            'distribution': [],
            'nps': None
        }
        
        # 基础统计
        print(f"📈 基础统计指标:")
        print(f"   有效样本数: {len(data)}")
        try:
            mean_value = float(data.mean())
            std_value = float(data.std())
            min_value = float(data.min())
            max_value = float(data.max())
            median_value = float(data.median())
            
            print(f"   平均分: {mean_value:.2f}")
            print(f"   标准差: {std_value:.2f}")
            print(f"   最小值: {min_value}")
            print(f"   最大值: {max_value}")
            print(f"   中位数: {median_value:.2f}")
            
            result['stats'] = {
                'mean': mean_value,
                'std': std_value,
                'min': min_value,
                'max': max_value,
                'median': median_value
            }
        except:
            print("   数据类型不支持数值统计")
            return None
        
        # 分布分析
        print(f"\n📊 分数分布:")
        value_counts = data.value_counts().sort_index()
        total = len(data)
        
        for score, count in value_counts.items():
            percentage = (count / total) * 100
            bar = "█" * int(percentage / 2)
            print(f"   {str(score):>8s}: {count:3d}人 ({percentage:5.1f}%) {bar}")
            
            # 添加到结果中
            result['distribution'].append({
                'score': float(score) if isinstance(score, (int, float)) else str(score),
                'count': int(count),
                'percentage': float(percentage)
            })
        
        # NPS分析（如果是0-10量表）
        try:
            if data.min() >= 0 and data.max() <= 10:
                print(f"\n🎯 NPS分析 (Net Promoter Score):")
                promoters = len(data[data >= 9])
                passives = len(data[(data >= 7) & (data <= 8)])
                detractors = len(data[data <= 6])
                
                nps = ((promoters - detractors) / total) * 100
                
                print(f"   推荐者 (9-10分): {promoters}人 ({promoters/total*100:.1f}%)")
                print(f"   中性者 (7-8分):  {passives}人 ({passives/total*100:.1f}%)")
                print(f"   批评者 (0-6分):  {detractors}人 ({detractors/total*100:.1f}%)")
                print(f"   NPS得分: {nps:.1f}")
                
                rating = ""
                if nps >= 50:
                    rating = "优秀"
                    print(f"   评价: 🌟 优秀")
                elif nps >= 0:
                    rating = "良好"
                    print(f"   评价: 👍 良好")
                else:
                    rating = "需要改进"
                    print(f"   评价: 👎 需要改进")
                    
                result['nps'] = {
                    'score': float(nps),
                    'promoters': int(promoters),
                    'promoters_percentage': float(promoters/total*100),
                    'passives': int(passives),
                    'passives_percentage': float(passives/total*100),
                    'detractors': int(detractors),
                    'detractors_percentage': float(detractors/total*100),
                    'rating': rating
                }
        except:
            pass  # 跳过非数值型数据的NPS分析
            
        return result
    
    def is_option_selected(self, value):
        """判断选项是否被选择（支持多种标记方式）"""
        if pd.isna(value):
            return False
        
        value_str = str(value).strip().lower()
        
        # 各种"选择"的标记方式
        selected_markers = [
            'selected', 'yes', 'y', '1', '是', '选中', '√', 'true', 
            '选择', '勾选', 'checked', 'choose', 'pick'
        ]
        
        return value_str in selected_markers
    
    def analyze_multiple_choice_question(self, df, question_stem, options):
        """分析多选题"""
        print(f"\n🔘 多选题分析：{question_stem}")
        print("=" * 80)
        
        total_responses = len(df)
        option_stats = []
        
        print(f"📊 各选项选择情况:")
        
        for opt in options:
            column = opt['full_column']
            option_text = opt['option']
            
            if column in df.columns:
                # 计算选择该选项的人数（使用通用判断函数）
                selected = df[column].apply(self.is_option_selected)
                count = selected.sum()
                percentage = (count / total_responses) * 100
                
                option_stats.append({
                    'option': option_text,
                    'count': count,
                    'percentage': percentage
                })
        
        # 按选择人数排序
        option_stats.sort(key=lambda x: x['count'], reverse=True)
        
        for i, stat in enumerate(option_stats, 1):
            bar = "█" * int(stat['percentage'] / 2)  # 每2%一个字符
            print(f"   {i:2d}. {stat['option'][:60]}")
            print(f"       {stat['count']:3d}人 ({stat['percentage']:5.1f}%) {bar}")
            print()
        
        print(f"📈 总结:")
        if option_stats:
            most_selected = option_stats[0]
            least_selected = option_stats[-1]
            print(f"   最受关注: {most_selected['option'][:40]} ({most_selected['percentage']:.1f}%)")
            print(f"   最少选择: {least_selected['option'][:40]} ({least_selected['percentage']:.1f}%)")
            print(f"   平均选择率: {sum(s['percentage'] for s in option_stats) / len(option_stats):.1f}%")
    
    def filter_questions_interactive(self, df, question_types):
        """交互式字段筛选功能（不再区分元数据/问题字段，全部字段都可选）"""
        print("\n" + "=" * 70)
        print("智能字段筛选功能")
        print("=" * 70)
        
        all_fields = df.columns.tolist()
        print(f"📋 可用字段: {len(all_fields)} 个")
        for field in all_fields[:10]:  # 显示前10个
            print(f"   • {field}")
        if len(all_fields) > 10:
            print(f"   • ... 还有 {len(all_fields)-10} 个")
        
        print("\n请选择筛选方式:")
        print("1. 按题型筛选")
        print("2. 按字段名筛选 (如 Q1, 姓名, 年龄)")
        print("3. 手动选择字段")
        print("4. 跳过筛选，分析所有字段")
        
        choice = input("\n请输入选择 (1-4): ").strip()
        
        if choice == "1":
            return self.filter_by_question_type(df, question_types)
        elif choice == "2":
            return self.filter_by_field_name(df, question_types)
        elif choice == "3":
            return self.filter_by_manual_selection(df, question_types)
        elif choice == "4":
            print("跳过筛选，将分析所有字段")
            return df, question_types
        else:
            print("无效选择，跳过筛选")
            return df, question_types
    
    def filter_by_question_type(self, df, question_types):
        """按题型筛选 - 简化为三种题型：量表题、单选题和开放题"""
        print("\n可选题型:")
        print("1. 量表题") 
        print("2. 单选题")
        print("3. 开放题")
        
        type_choice = input("请选择题型 (1-3): ").strip()
        
        selected_columns = []
        filtered_types = {}
        
        if type_choice == "1" and question_types['scale_questions']:
            selected_columns = [q['column'] for q in question_types['scale_questions']]
            filtered_types['scale_questions'] = question_types['scale_questions']
            print(f"已选择 {len(question_types['scale_questions'])} 个量表题")
            
        elif type_choice == "2" and question_types['single_choice']:
            selected_columns = [q['column'] for q in question_types['single_choice']]
            filtered_types['single_choice'] = question_types['single_choice']
            print(f"已选择 {len(question_types['single_choice'])} 个单选题")
            
        elif type_choice == "3" and question_types['open_ended']:
            selected_columns = [q['column'] for q in question_types['open_ended']]
            filtered_types['open_ended'] = question_types['open_ended']
            print(f"已选择 {len(question_types['open_ended'])} 个开放题")
            
        elif type_choice == "4":
            print("新逻辑中已移除其他题型，所有字段都会被分类为量表题、单选题或开放题")
            
        else:
            print("无效选择或该题型无问题")
            return df, question_types
        
        # 筛选列
        final_columns = [col for col in selected_columns if col in df.columns]
        
        filtered_df = df[final_columns]
        print(f"筛选后数据: {len(filtered_df)} 行 x {len(filtered_df.columns)} 列")
        print(f"问题字段: {len(selected_columns)} 个")
        
        # 重新生成field_types
        filtered_types['field_types'] = [ft for ft in question_types['field_types'] if ft['column'] in final_columns]
        filtered_types['summary'] = {
            'total_fields': len(final_columns),
            'scale_questions': len(filtered_types.get('scale_questions', [])),
            'single_choice': len(filtered_types.get('single_choice', [])),
            'open_ended': len(filtered_types.get('open_ended', []))
        }
        
        return filtered_df, filtered_types
    
    def filter_by_field_name(self, df, question_types):
        """按字段名筛选（用户输入字段名，逗号分隔）"""
        field_names = input("请输入字段名 (用逗号分隔，如 Q1,姓名,年龄): ").strip()
        if not field_names:
            print("未输入字段名")
            return df, question_types
        names = [q.strip() for q in field_names.split(',')]
        selected_columns = [col for col in df.columns if col in names]
        if not selected_columns:
            print("未找到匹配的字段")
            return df, question_types
        filtered_df = df[selected_columns]
        print(f"\n筛选结果:")
        print(f"  • 总字段数: {len(selected_columns)} 个")
        print(f"  • 筛选后数据: {len(filtered_df)} 行 x {len(filtered_df.columns)} 列")
        filtered_types = self.identify_all_question_types(filtered_df)
        return filtered_df, filtered_types
    
    def filter_by_manual_selection(self, df, question_types):
        """手动选择字段（全部字段都可选）"""
        all_fields = df.columns.tolist()
        print("\n可用字段:")
        for i, col in enumerate(all_fields, 1):
            print(f"F{i:2d}. {col}")
        print("\n选择方式:")
        print("  • 字段使用 F1,F2... 表示")
        print("  • 可混合选择，如: F1,F3,F5")
        selection = input(f"\n请输入选择内容: ").strip()
        if not selection:
            print("未选择字段")
            return df, question_types
        selected_columns = []
        selection_items = [item.strip() for item in selection.split(',')]
        try:
            for item in selection_items:
                item = item.strip().upper()
                if item.startswith('F'):
                    idx = int(item[1:]) - 1
                    if 0 <= idx < len(all_fields):
                        selected_columns.append(all_fields[idx])
        except ValueError:
            print("输入格式错误")
            return df, question_types
        if not selected_columns:
            print("无效的选择")
            return df, question_types
        final_columns = [col for col in selected_columns if col in df.columns]
        filtered_df = df[final_columns]
        print(f"\n筛选结果:")
        print(f"  • 字段数: {len(final_columns)} 个")
        print(f"  • 筛选后数据: {len(filtered_df)} 行 x {len(filtered_df.columns)} 列")
        filtered_types = self.identify_all_question_types(filtered_df)
        return filtered_df, filtered_types
    
    def run_analysis(self):
        """运行完整分析流程"""
        # 1. 选择文件
        file_path = self.select_file_interactive()
        if not file_path:
            return
        
        # 2. 读取数据
        df = self.read_data_file(file_path)
        if df is None:
            return
        
        # 3. 题型分析（直接对所有字段）
        question_types = self.identify_all_question_types(df)
        
        # 4. 字段筛选（可选，全部字段都可选，不再区分元数据/问题字段）
        print("\n第四步：字段筛选")
        filtered_df, filtered_types = self.filter_questions_interactive(df, question_types)
        
        # 5. 进行基础分析
        print(f"\n" + "=" * 80)
        print("数据分析结果")
        print("=" * 80)
        
        # 分析量表题（限制前2个）
        scale_questions = filtered_types.get('scale_questions', [])
        for q in scale_questions[:2]:
            self.analyze_scale_question(filtered_df, q['column'])
        
        print(f"\n✅ 分析完成！")
        print(f"📁 文件: {os.path.basename(file_path)}")
        print(f"📊 数据: {len(filtered_df)} 行 × {len(filtered_df.columns)} 列")
        print(f"🎯 识别: {len(filtered_types.get('scale_questions', []))} 量表题, "
              f"{len(filtered_types.get('single_choice', []))} 单选题, "
              f"{len(filtered_types.get('open_ended', []))} 开放题")
        
        return filtered_df, filtered_types

    def analyze_single_field(self, df, field, question_types):
        """分析单个字段"""
        # 获取字段类型
        field_type = None
        field_info = None
        
        # 检查字段类型
        if question_types.get('scale_questions'):
            for q in question_types['scale_questions']:
                if q['column'] == field:
                    field_type = 'scale'
                    field_info = q
                    break
                    
        if not field_type and question_types.get('single_choice'):
            for q in question_types['single_choice']:
                if q['column'] == field:
                    field_type = 'single'
                    field_info = q
                    break
                    
        if not field_type and question_types.get('open_ended'):
            for q in question_types['open_ended']:
                if q['column'] == field:
                    field_type = 'open'
                    field_info = q
                    break
        
        results = {
            'field': field,
            'type': field_type,
            'analysis': {}
        }
        
        # 根据字段类型进行相应的分析
        if field_type == 'scale':
            # 量表题分析
            scale_analysis = self.analyze_scale_question(df, field)
            results['analysis'] = {
                'mean': scale_analysis['mean'],
                'median': scale_analysis['median'],
                'mode': scale_analysis['mode'],
                'distribution': scale_analysis['distribution']
            }
            
        elif field_type == 'single':
            # 单选题分析
            choice_analysis = self.analyze_multiple_choice_question(df, field, field_info)
            results['analysis'] = {
                'options': choice_analysis['options'],
                'counts': choice_analysis['counts'],
                'percentages': choice_analysis['percentages']
            }
            
        elif field_type == 'open':
            # 开放题分析
            open_ended_values = df[field].dropna().tolist()
            results['analysis'] = {
                'response_count': len(open_ended_values),
                'sample_responses': open_ended_values[:5] if open_ended_values else []
            }
            
        return results

def main():
    """主函数"""
    analyzer = UniversalQuestionnaireAnalyzer()
    return analyzer.run_analysis()

# Note: Flask配置已在文件开头完成，避免重复定义

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_file_content(file_path, file_name):
    """解析文件内容为结构化数据"""
    ext = os.path.splitext(file_name)[1].lower()
    
    if ext == '.csv':
        # 尝试不同的编码格式
        for encoding in ['utf-8', 'gbk', 'gb2312', 'latin1']:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise Exception("无法识别CSV文件编码格式")
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
    elif ext == '.txt':
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        data = []
        for i, line in enumerate(lines):
            if line.strip():
                data.append({
                    'id': i + 1,
                    'content': line.strip(),
                    'timestamp': datetime.now().isoformat()
                })
        return data
    else:
        raise Exception(f"不支持的文件格式: {ext}")
    
    return df.to_dict('records')

def analyze_with_openai(content, prompt):
    """使用OpenAI进行分析"""
    if not OPENAI_AVAILABLE:
        return "OpenAI库未安装，无法进行AI分析"
    
    try:
        response = openai_client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-4'),
            messages=[
                {"role": "system", "content": "你是一个专业的数据分析师。"},
                {"role": "user", "content": f"{prompt}\n\n{content}"}
            ],
            max_tokens=2000,
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"AI分析失败: {str(e)}"

# 注意：upload-questionnaire 路由已在 main.py 中定义，这里不再重复定义以避免冲突

@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    """问卷智能分析"""
    try:
        data = request.json
        analysis_id = data.get('analysisId')
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        analysis_data = analysis_results[analysis_id]
        parsed_data = analysis_data['parsedData']
        
        if not parsed_data:
            return jsonify({'error': '文件内容为空'}), 400
        
        # 开始分析
        analysis_data['status'] = 'analyzing'
        
        analyzer = UniversalQuestionnaireAnalyzer()
        df = pd.DataFrame(parsed_data)
        
        # 执行详细分析
        analysis_result = {}
        
        # 识别所有题型 - 对每个字段进行题型分类
        question_types = analyzer.identify_all_question_types(df)
        
        # 分析量表题 - 处理所有被识别为量表题的字段
        scale_questions = []
        for q in question_types.get('scale_questions', []):
            scale_analysis = analyzer.analyze_scale_question(df, q['column'])
            if scale_analysis:  # 确保分析结果不为空
                scale_questions.append(scale_analysis)
        
        # 分析单选题 - 处理所有被识别为单选题的字段
        single_choice = []
        for q in question_types.get('single_choice', []):
            single_analysis = {
                'column': q['column'], 
                'unique_count': q['unique_count'],
                'unique_values': q['unique_values']
            }
            single_choice.append(single_analysis)
        
        # 分析开放题 - 处理所有被识别为开放题的字段
        open_ended = []
        for q in question_types.get('open_ended', []):
            open_analysis = {
                'column': q['column'], 
                'unique_count': q['unique_count'],
                'sample_responses': df[q['column']].dropna().tolist()[:5]
            }
            open_ended.append(open_analysis)
        
        # 保存分析结果
        analysis_result['question_types'] = question_types
        analysis_result['scale_questions'] = scale_questions
        analysis_result['single_choice'] = single_choice
        analysis_result['open_ended'] = open_ended
        analysis_result['summary'] = {
            'totalFields': len(question_types['field_types']),
            'scaleQuestions': len(scale_questions),
            'singleChoice': len(single_choice),
            'openEnded': len(open_ended)
        }
        
        # 更新分析结果
        analysis_data['analysis'] = analysis_result
        analysis_data['status'] = 'completed'
        analysis_data['completedTime'] = datetime.now().isoformat()
        analysis_results[analysis_id] = analysis_data
        
        return jsonify({
            'success': True,
            'analysisId': analysis_id,
            'results': analysis_result
        })
    
    except Exception as e:
        return jsonify({'error': f'智能分析失败: {str(e)}'}), 500

@app.route('/statistics', methods=['POST'])
def get_statistics():
    """获取统计分析结果"""
    try:
        data = request.get_json()
        analysis_id = data.get('analysisId')
        selected_fields = data.get('selectedFields', [])
        question_types = data.get('questionTypes', {})
        
        if not analysis_id or not selected_fields:
            return jsonify({'error': '缺少必要参数'}), 400
            
        # 获取数据文件路径
        file_info = analysis_results.get(analysis_id)
        if not file_info:
            return jsonify({'error': '找不到对应的分析数据'}), 404
            
        file_path = file_info['file_path']
        if not os.path.exists(file_path):
            return jsonify({'error': '数据文件不存在'}), 404
            
        # 读取数据
        analyzer = UniversalQuestionnaireAnalyzer()
        df = analyzer.read_data_file(file_path)
        if df is None:
            return jsonify({'error': '读取数据文件失败'}), 500
            
        # 对每个字段进行分析
        results = []
        for field in selected_fields:
            field_result = analyzer.analyze_single_field(df, field, question_types)
            results.append(field_result)
            
        return jsonify({
            'results': results
        })
        
    except Exception as e:
        print(f"统计分析出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/trend-analysis', methods=['POST'])
def trend_analysis():
    """趋势分析"""
    try:
        data = request.json
        analysis_id = data.get('analysisId')
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        analysis_data = analysis_results[analysis_id]
        parsed_data = analysis_data['parsedData']
        analysis = analysis_data['analysis']
        
        if not parsed_data or not analysis:
            return jsonify({'error': '请先完成文本分析'}), 400
        
        # 执行趋势分析
        trends = {
            'timeSeries': [],
            'trendSummary': '趋势分析完成',
            'recommendations': ['建议1', '建议2', '建议3']
        }
        
        # 更新趋势结果
        analysis_data['trends'] = trends
        analysis_results[analysis_id] = analysis_data
        
        return jsonify({
            'success': True,
            'analysisId': analysis_id,
            'trends': trends
        })
    
    except Exception as e:
        return jsonify({'error': f'趋势分析失败: {str(e)}'}), 500

@app.route('/analysis-results/<analysis_id>', methods=['GET'])
def get_analysis_results(analysis_id):
    """获取分析结果"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析结果不存在'}), 404
        
        result = analysis_results[analysis_id]
        return jsonify({
            'success': True,
            'result': result
        })
    
    except Exception as e:
        return jsonify({'error': '获取分析结果失败'}), 500

@app.route('/analysis-history', methods=['GET'])
def get_analysis_history():
    """获取分析历史"""
    try:
        history = []
        for result in analysis_results.values():
            history.append({
                'id': result['id'],
                'fileName': result['fileName'],
                'uploadTime': result['uploadTime'],
                'completedTime': result.get('completedTime'),
                'status': result['status'],
                'totalRecords': len(result['parsedData']) if result['parsedData'] else 0,
                'hasAnalysis': bool(result['analysis']),
                'hasStatistics': bool(result['statistics']),
                'hasTrends': bool(result['trends'])
            })
        
        return jsonify({
            'success': True,
            'history': history
        })
    
    except Exception as e:
        return jsonify({'error': '获取历史记录失败'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'Universal Questionnaire Analyzer'
    })

def run_server():
    """启动Flask服务器"""
    print("=" * 60)
    print("启动通用问卷分析API服务器")
    print("=" * 60)
    print(f"服务器地址: http://localhost:9000")
    print(f"上传目录: {UPLOAD_FOLDER}")
    print(f"支持格式: {', '.join(ALLOWED_EXTENSIONS)}")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=9000, debug=True)

if __name__ == "__main__":
    print("选择运行模式:")
    print("1. 交互式问卷分析")
    print("2. 启动API服务器")
    
    choice = input("请选择 (1-2): ").strip()
    
    if choice == "1":
        questionnaire_data, question_types = main()
    elif choice == "2":
        run_server()
    else:
        print("无效选择")