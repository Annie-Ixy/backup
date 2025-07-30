#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
问卷分析Flask后端服务
提供与前端QuestionnaireAnalysis.js兼容的API接口
"""

import os
import sys
import logging
import time
import json
import uuid
import re
import glob
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pandas as pd
import numpy as np
import traceback

# 数据库连接相关导入
try:
    import pymysql
    pymysql.install_as_MySQLdb()
    DB_AVAILABLE = True
    logger_db = logging.getLogger('database')
except ImportError:
    DB_AVAILABLE = False
    print("⚠️ pymysql库未安装，数据库功能将被禁用")

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

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 启用跨域支持

# 配置上传文件夹及子目录
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
QUESTIONNAIRE_FOLDER = UPLOAD_FOLDER / 'questionnaire'  # 原始问卷文件
# CLASSIFICATION_FOLDER = UPLOAD_FOLDER / 'classification'  # 分类处理后的文件（旧的混合流程）
# RETAG_FOLDER = UPLOAD_FOLDER / 'retag_result'  # 重新打标后的文件（旧）

# 新的分离目录结构
TRANSLATE_FOLDER = UPLOAD_FOLDER / 'translate'  # 翻译结果
TRANSLATE_AI_FOLDER = UPLOAD_FOLDER / 'translate_ai'  # 标准AI打标结果
TRANSLATE_AI_MANUAL_FOLDER = UPLOAD_FOLDER / 'translate_ai_manual'  # 标准AI打标手动编辑结果
TRANSLATE_CUSTOM_FOLDER = UPLOAD_FOLDER / 'translate_custom'  # 配置参考标签打标结果
TRANSLATE_CUSTOM_MANUAL_FOLDER = UPLOAD_FOLDER / 'translate_custom_manual'  # 配置参考标签打标手动编辑结果

# 创建目录（如果不存在）
UPLOAD_FOLDER.mkdir(exist_ok=True)
QUESTIONNAIRE_FOLDER.mkdir(exist_ok=True)
# CLASSIFICATION    _FOLDER.mkdir(exist_ok=True)
# RETAG_FOLDER.mkdir(exist_ok=True)
TRANSLATE_FOLDER.mkdir(exist_ok=True)
TRANSLATE_AI_FOLDER.mkdir(exist_ok=True)
TRANSLATE_AI_MANUAL_FOLDER.mkdir(exist_ok=True)
TRANSLATE_CUSTOM_FOLDER.mkdir(exist_ok=True)
TRANSLATE_CUSTOM_MANUAL_FOLDER.mkdir(exist_ok=True)

# 配置允许的文件类型
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'txt'}

# 存储分析结果的临时数据结构
analysis_results = {}

# 数据库连接配置
DB_CONFIG = {
    'host': os.getenv('TIDB_HOST') or '10.51.32.12',
    'port': int(os.getenv('TIDB_PORT') or 4000),
    'user': os.getenv('TIDB_USER') or 'root',
    'password': os.getenv('TIDB_PASSWORD') or 'Z8OiMjawmSSqgRFs',
    'database': 'mkt',
    'charset': 'utf8mb4',
    'ssl_disabled': False
}

def get_database_connection():
    """获取数据库连接"""
    if not DB_AVAILABLE:
        return None, "数据库功能未启用，请安装pymysql"
    
    # 检查必要的配置信息
    if not DB_CONFIG['user'] or not DB_CONFIG['password']:
        return None, f"数据库连接配置不完整: user={DB_CONFIG['user']}, password={'*' * len(DB_CONFIG['password']) if DB_CONFIG['password'] else 'None'}"
    
    try:
        # 打印连接信息（隐藏密码）
        logger.info(f"🔗 尝试连接数据库: {DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        connection = pymysql.connect(**DB_CONFIG)
        logger.info("✅ 数据库连接成功")
        return connection, None
    except Exception as e:
        error_msg = f"数据库连接失败: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return None, error_msg

def test_database_connection():
    """测试数据库连接"""
    connection, error = get_database_connection()
    if error:
        return False, error
    
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        connection.close()
        return True, "数据库连接测试成功"
    except Exception as e:
        return False, f"数据库连接测试失败: {str(e)}"

# 数据导入相关工具函数
def extract_question_code(question_text):
    """从问题文本中提取编号"""
    match = re.match(r'^(Q\d+)', question_text)
    return match.group(1) if match else ''

def extract_survey_name_from_filename(filename):
    """从文件名提取问卷名称"""
    # 示例: "简单问卷3_retag_manual_20250716_152339.xlsx"
    match = re.match(r'^(.+?)_retag_manual_', filename)
    if match:
        return match.group(1)
    return filename.replace('.xlsx', '')

def determine_question_type(question_text):
    """判断问题类型"""
    question_lower = question_text.lower()
    
    if 'scale' in question_lower or 'rate' in question_lower or '打分' in question_text:
        return 'scale'
    elif 'choice' in question_lower or '选择' in question_text:
        return 'single'
    else:
        return 'open'

def safe_get_value(row, column_name):
    """安全地从行中获取值"""
    if column_name in row and pd.notna(row[column_name]):
        value = str(row[column_name]).strip()
        return value if value else ''
    return ''

def parse_column_structure(df):
    """解析Excel列结构，识别问题列"""
    column_info = {
        'question_columns': [],      # 基础问题列
        'translation_columns': [],   # 翻译列(-CN)
        'label_columns': [],        # 标签列(标签)
        'category_columns': [],     # 分类列(一级主题、二级主题)
        'other_columns': []         # 其他列(如ID)
    }
    
    for col in df.columns:
        if col == 'ID':
            column_info['other_columns'].append(col)
        elif col.endswith('-CN'):
            column_info['translation_columns'].append(col)
        elif col.endswith('标签'):
            column_info['label_columns'].append(col)
        elif col.endswith(('一级主题', '二级主题')):
            column_info['category_columns'].append(col)
        elif not col.endswith(('-CN', '标签', '一级主题', '二级主题')):
            column_info['question_columns'].append(col)
    
    logger.info(f"🔍 识别到 {len(column_info['question_columns'])} 个问题列")
    return column_info

def transform_data_to_records(df, column_info, analysis_id, survey_name, survey_topic=''):
    """将DataFrame转换为数据库记录格式"""
    records = []
    question_columns = column_info['question_columns']
    
    for index, row in df.iterrows():
        # 获取回答者ID
        respondent_id = safe_get_value(row, 'ID')
        
        for question_col in question_columns:
            # 构建相关列名
            translation_col = f"{question_col}-CN"
            label_col = f"{question_col}标签"
            primary_category_col = f"{question_col}一级主题"
            secondary_category_col = f"{question_col}二级主题"
            
            # 提取数据
            record = {
                'analysis_id': analysis_id,
                'respondent_id': respondent_id,
                'survey_name': survey_name,
                'survey_topic': survey_topic,
                'question_code': extract_question_code(question_col),
                'question': question_col,
                'question_type': determine_question_type(question_col),
                'respondent_row': index + 1,
                'user_answer': safe_get_value(row, question_col),
                'translation': safe_get_value(row, translation_col),
                'labels': safe_get_value(row, label_col),
                'primary_category': safe_get_value(row, primary_category_col),
                'secondary_category': safe_get_value(row, secondary_category_col)
            }
            
            records.append(record)
    
    return records

def validate_records(records):
    """验证记录的完整性和合理性"""
    validation_result = {
        'valid': True,
        'warnings': [],
        'errors': [],
        'statistics': {}
    }
    
    if not records:
        validation_result['valid'] = False
        validation_result['errors'].append('没有可导入的记录')
        return validation_result
    
    # 检查必填字段
    required_fields = ['analysis_id', 'survey_name', 'question', 'respondent_row']
    for i, record in enumerate(records):
        for field in required_fields:
            if not record.get(field):
                validation_result['errors'].append(f"记录 {i+1}: 缺少必填字段 '{field}'")
    
    # 统计信息
    validation_result['statistics'] = {
        'total_records': len(records),
        'unique_respondents': len(set(r['respondent_id'] for r in records if r['respondent_id'])),
        'unique_questions': len(set(r['question_code'] for r in records if r['question_code'])),
        'records_with_labels': len([r for r in records if r.get('labels')])
    }
    
    # 设置验证结果
    if validation_result['errors']:
        validation_result['valid'] = False
    
    return validation_result

def convert_pandas_types(obj):
    """递归转换pandas和numpy类型为Python原生类型，用于JSON序列化"""
    if isinstance(obj, dict):
        return {k: convert_pandas_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_pandas_types(item) for item in obj]
    elif isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif pd.isna(obj):
        return None
    else:
        return obj

def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_extension(filename):
    """获取文件扩展名"""
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

def secure_chinese_filename(filename):
    """安全地处理中文文件名"""
    # 移除路径分隔符和其他不安全字符
    filename = filename.replace('/', '_').replace('\\', '_')
    filename = filename.replace('..', '_')
    # 保留文件名中的中文字符
    return filename

def extract_file_info(file_path):
    """
    从文件路径中提取基础文件名和时间戳
    支持多种格式，能够正确处理复杂的文件命名：
    - 原始文件：简单问卷3_20250714_180649.xlsx -> ('简单问卷3', '20250714_180649')
    - 翻译文件：简单问卷3_translate_20250714_180649.xlsx -> ('简单问卷3', '20250714_180649')
    - 标准打标：简单问卷3_translate_ai_20250714_180649.xlsx -> ('简单问卷3', '20250714_180649')
    - 配置打标：简单问卷3_translate_custom_20250714_180649.xlsx -> ('简单问卷3', '20250714_180649')
    - 手动编辑：简单问卷3_translate_ai_manual_20250714_180649.xlsx -> ('简单问卷3', '20250714_180649')
    """
    filename = Path(file_path).stem  # 不含扩展名的文件名
    
    import re
    
    # 定义处理类型标识符，按长度排序（长模式优先匹配）
    processing_types = [
        'translate_ai',     # 标准AI打标（完整版） - 必须在ai之前
        'translate_custom', # 配置参考标签打标 - 必须在custom之前  
        'manual',           # 手动编辑（最后一步）
        'translate',        # 翻译处理 - 必须在ai和custom之前
        'custom',           # 配置打标（简化版）
        'ai',               # 标准AI打标（简化版） - 必须在最后
    ]
    
    # 尝试匹配复杂文件格式：基础名称_[处理类型]_时间戳
    # 构建动态正则表达式
    types_pattern = '|'.join(processing_types)
    
    # 匹配格式：基础名称_处理类型1_处理类型2_..._时间戳
    pattern = rf'^(.+)_(?:{types_pattern})(?:_(?:{types_pattern}))*_(\d{{8}}_\d{{6}})$'
    match = re.match(pattern, filename)
    if match:
        base_name = match.group(1)  # 基础文件名
        timestamp = match.group(2)  # 时间戳
        logger.debug(f"🔍 复杂格式解析: {filename} -> 基础名称: {base_name}, 时间戳: {timestamp}")
        return base_name, timestamp
    
    # 尝试匹配简单文件格式：基础名称_时间戳
    match = re.match(r'^(.+)_(\d{8}_\d{6})$', filename)
    if match:
        base_name = match.group(1)  # 基础文件名
        timestamp = match.group(2)  # 时间戳
        logger.debug(f"🔍 简单格式解析: {filename} -> 基础名称: {base_name}, 时间戳: {timestamp}")
        return base_name, timestamp
    
    # 如果不匹配任何预期格式，返回完整文件名和当前时间戳
    current_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    logger.warning(f"⚠️ 无法解析文件名格式: {filename}，使用完整文件名作为基础名称")
    return filename, current_timestamp

@app.route('/upload-questionnaire', methods=['POST'])
def upload_questionnaire():
    """上传问卷数据文件"""
    try:
        logger.info("📤 收到文件上传请求")
        
        if 'file' not in request.files:
            return jsonify({'error': '没有文件被上传'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': '不支持的文件格式，请上传CSV、Excel或TXT文件'}), 400
        
        # 安全地保存文件到questionnaire子目录，保留中文字符
        original_filename = secure_chinese_filename(file.filename or 'unknown_file')
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 提取文件名（不含扩展名）和扩展名
        file_stem = Path(original_filename).stem  # 文件名（不含扩展名）
        file_extension = Path(original_filename).suffix  # 扩展名
        
        # 新的命名格式：原始文件名_时间戳.扩展名
        unique_filename = f"{file_stem}_{timestamp}{file_extension}"
        file_path = QUESTIONNAIRE_FOLDER / unique_filename
        
        file.save(str(file_path))
        logger.info(f"✅ 原始问卷文件保存成功: {file_path}")
        
        # 生成分析ID
        analysis_id = str(uuid.uuid4())
        
        # 读取文件内容并分析字段
        try:
            try:
                from universal_questionnaire_analyzer import UniversalQuestionnaireAnalyzer
                logger.info("✅ 成功导入 UniversalQuestionnaireAnalyzer")
            except ImportError as e:
                logger.error(f"❌ 导入 UniversalQuestionnaireAnalyzer 失败: {e}")
                return jsonify({'error': f'导入分析模块失败: {str(e)}'}), 500
            
            analyzer = UniversalQuestionnaireAnalyzer()
            df = analyzer.read_data_file(str(file_path))
            
            if df is None:
                return jsonify({'error': '无法读取文件内容'}), 400
            
            # 识别问题类型
            logger.info(f"🔍 开始识别题型，共{len(df.columns)}个字段")
            logger.info(f"📋 字段列表: {df.columns.tolist()}")
            
            question_types = analyzer.identify_all_question_types(df)
            
            # 输出识别结果用于调试
            logger.info(f"📊 题型识别完成:")
            logger.info(f"  - 量表题: {len(question_types.get('scale_questions', []))} 个")
            logger.info(f"  - 单选题: {len(question_types.get('single_choice', []))} 个")
            logger.info(f"  - 开放题: {len(question_types.get('open_ended', []))} 个")
            
            # 存储分析信息
            analysis_results[analysis_id] = {
                'file_path': str(file_path),
                'filename': unique_filename,  # 使用完整的文件名
                'dataframe': df,
                'question_types': question_types,
                'upload_time': datetime.now().isoformat()
            }
            
            # 转换数据结构以匹配前端期望
            def transform_question_types(question_types):
                """转换后端数据结构为前端期望的格式 - 适应新的字段级题型识别"""
                logger.info(f"🔄 开始转换数据结构")
                logger.info(f"原始数据keys: {list(question_types.keys())}")
                
                # 先输出原始数据的内容
                logger.info(f"原始数据内容详情:")
                for key, value in question_types.items():
                    logger.info(f"  {key}: {type(value)} - {len(value) if isinstance(value, (list, dict)) else 'N/A'}")
                
                transformed = {
                    'scaleQuestions': [],
                    'singleChoice': [],
                    'openEnded': [],
                    'field_types': [],  # 所有字段的题型信息
                    'summary': {
                        'breakdown': {}
                    }
                }
                
                # 处理所有字段类型
                field_types = question_types.get('field_types', [])
                logger.info(f"字段类型原始数据: {len(field_types)} 个")
                transformed['field_types'] = field_types
                
                # 处理量表题
                scale_questions = question_types.get('scale_questions', [])
                logger.info(f"量表题原始数据: {len(scale_questions)} 个")
                transformed['scaleQuestions'] = scale_questions
                
                # 处理单选题
                single_choice = question_types.get('single_choice', [])
                logger.info(f"单选题原始数据: {len(single_choice)} 个")
                transformed['singleChoice'] = single_choice
                
                # 处理开放题
                open_ended = question_types.get('open_ended', [])
                logger.info(f"开放题原始数据: {len(open_ended)} 个")
                transformed['openEnded'] = open_ended
                
                # 新逻辑中无其他题型，所有字段都被分类为量表题、单选题或开放题
                logger.info(f"新逻辑已覆盖所有字段，无其他题型")
                
                # 添加统计信息
                transformed['summary']['breakdown'] = {
                    'total_fields': len(field_types),
                    'scaleQuestions': len(scale_questions),
                    'singleChoice': len(single_choice),
                    'openEnded': len(open_ended)
                }
                
                logger.info(f"✅ 转换完成，统计信息: {transformed['summary']['breakdown']}")
                
                # 输出转换后的数据结构用于调试
                logger.info(f"转换后的数据结构:")
                for key, value in transformed.items():
                    if key != 'summary':
                        logger.info(f"  {key}: {len(value) if isinstance(value, list) else type(value)}")
                
                return transformed
            
            # 返回上传信息
            response_data = {
                'analysisId': analysis_id,
                'filename': unique_filename,  # 使用完整的文件名
                'fileSize': file_path.stat().st_size,
                'rowCount': len(df),
                'columnCount': len(df.columns),
                'questionTypes': convert_pandas_types(transform_question_types(question_types)),
                'columns': df.columns.tolist()
            }
            
            logger.info(f"✅ 文件分析完成，分析ID: {analysis_id}")
            return jsonify(response_data)
            
        except Exception as e:
            logger.error(f"❌ 文件分析失败: {e}")
            return jsonify({'error': f'文件分析失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"❌ 上传处理失败: {e}")
        return jsonify({'error': f'上传处理失败: {str(e)}'}), 500

@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    """分析问卷数据 - 处理所有字段"""
    try:
        logger.info("🔍 收到分析请求")
        
        data = request.get_json()
        analysis_id = data.get('analysisId')
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        analysis_info = analysis_results[analysis_id]
        df = analysis_info['dataframe']
        
        # 使用所有字段进行分析
        all_fields = df.columns.tolist()
        logger.info(f"📊 开始分析所有字段，共 {len(all_fields)} 个字段")
        
        # 执行完整的分析流程
        try:
            # 第一步：使用classification处理
            logger.info("🔧 第一步：使用classification处理")
            
            try:
                from classification import QuestionnaireTranslationClassifier
                logger.info("✅ 成功导入 QuestionnaireTranslationClassifier")
            except ImportError as e:
                logger.error(f"❌ 导入 QuestionnaireTranslationClassifier 失败: {e}")
                return jsonify({'error': f'导入 classification 模块失败: {str(e)}'}), 500
            
            classifier = QuestionnaireTranslationClassifier()
            input_file = analysis_info['file_path']
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            classification_output = Path(input_file).parent / f"classification_{timestamp}.xlsx"
            
            success = classifier.process_table(input_file, str(classification_output))
            
            if not success:
                return jsonify({'error': 'classification处理失败'}), 500
            
            logger.info(f"✅ classification处理完成: {classification_output}")
            
            # 第二步：使用universal_questionnaire_analyzer分析
            logger.info("🔍 第二步：使用universal_questionnaire_analyzer分析")
            
            try:
                from universal_questionnaire_analyzer import UniversalQuestionnaireAnalyzer
                logger.info("✅ 成功导入 UniversalQuestionnaireAnalyzer")
            except ImportError as e:
                logger.error(f"❌ 导入 UniversalQuestionnaireAnalyzer 失败: {e}")
                return jsonify({'error': f'导入分析模块失败: {str(e)}'}), 500
            
            analyzer = UniversalQuestionnaireAnalyzer()
            processed_df = analyzer.read_data_file(str(classification_output))
            
            if processed_df is None:
                return jsonify({'error': '无法读取处理后的文件'}), 500
            
            # 使用所有可用字段
            available_fields = processed_df.columns.tolist()
            logger.info(f"✅ 使用所有可用字段进行分析，共 {len(available_fields)} 个字段")
            
            # 识别问题类型
            question_types = analyzer.identify_all_question_types(processed_df)
            
            # 生成分析报告 - 使用新的字段级题型识别结果
            analysis_result = {
                'summary': {
                    'total_responses': len(processed_df),
                    'total_fields': len(processed_df.columns),
                    'scale_questions': len(question_types['scale_questions']),
                    'single_choice': len(question_types['single_choice']),
                    'open_ended': len(question_types['open_ended']),
                    'processing_time': datetime.now().isoformat()
                },
                'field_types': question_types['field_types'],  # 所有字段的题型信息
                'scale_questions': question_types['scale_questions'],
                'single_choice': question_types['single_choice'],
                'open_ended': question_types['open_ended']
            }
            
            # 为每个字段添加样本数据
            for field_info in analysis_result['field_types']:
                field = field_info['column']
                field_data = processed_df[field]
                # 过滤NaN值
                field_data_clean = field_data.dropna() if hasattr(field_data, 'dropna') else field_data[pd.notna(field_data)]
                
                # 获取样本数据
                if len(field_data_clean) > 0:
                    if hasattr(field_data_clean, 'head'):
                        sample_data = field_data_clean.head(5).tolist()
                    else:
                        sample_data = field_data_clean[:5].tolist()
                    
                    field_info['sample_data'] = sample_data
                    field_info['response_count'] = len(field_data_clean)
            
            # 存储分析结果
            analysis_results[analysis_id]['analysis_result'] = analysis_result
            analysis_results[analysis_id]['processed_file'] = str(classification_output)
            
            logger.info(f"✅ 分析完成，分析ID: {analysis_id}")
            return jsonify({
                'results': convert_pandas_types(analysis_result),
                'analysisId': analysis_id
            })
            
        except Exception as e:
            logger.error(f"❌ 分析过程失败: {e}")
            return jsonify({'error': f'分析过程失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"❌ 分析请求处理失败: {e}")
        return jsonify({'error': f'分析请求处理失败: {str(e)}'}), 500

@app.route('/translate-open-questions', methods=['POST'])
def translate_open_questions():
    """翻译开放题字段 - 为后续的标准打标或参考标签打标做准备"""
    try:
        logger.info("🔍 收到开放题翻译请求")
        
        data = request.get_json()
        analysis_id = data.get('analysisId')
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        analysis_info = analysis_results[analysis_id]
        input_file = analysis_info['file_path']
        question_types = analysis_info.get('question_types', {})
        
        logger.info(f"📊 开始翻译开放题字段，文件: {input_file}")
        
        # 获取开放题字段列表
        open_ended_fields = []
        if 'open_ended' in question_types:
            for q in question_types['open_ended']:
                if isinstance(q, dict) and 'column' in q:
                    open_ended_fields.append(q['column'])
        
        if not open_ended_fields:
            return jsonify({'error': '没有找到开放题字段'}), 400
        
        logger.info(f"🔍 识别到 {len(open_ended_fields)} 个开放题字段: {open_ended_fields}")
        
        try:
            # 导入classification模块进行翻译
            try:
                from classification import QuestionnaireTranslationClassifier
                logger.info("✅ 成功导入 QuestionnaireTranslationClassifier")
            except ImportError as e:
                logger.error(f"❌ 导入 QuestionnaireTranslationClassifier 失败: {e}")
                return jsonify({'error': f'导入 classification 模块失败: {str(e)}'}), 500
            
            classifier = QuestionnaireTranslationClassifier()
            
            # 生成翻译输出文件路径
            base_name, original_timestamp = extract_file_info(input_file)
            translate_output = TRANSLATE_FOLDER / f"{base_name}_translate_{original_timestamp}.xlsx"
            
            # 执行翻译（只翻译，不进行AI分类）
            logger.info(f"🔧 开始执行开放题翻译: {input_file} -> {translate_output}")
            
            success = classifier.translate_only(input_file, str(translate_output), open_ended_fields)
            
            if not success:
                return jsonify({'error': '开放题翻译处理失败'}), 500
            
            logger.info(f"✅ 开放题翻译完成: {translate_output}")
            
            # 读取翻译后的文件
            translated_df = pd.read_excel(str(translate_output))
            
            # 生成翻译结果
            result = {
                'summary': {
                    'total_responses': len(translated_df),
                    'translated_fields': len(open_ended_fields),
                    'open_ended_fields': open_ended_fields,
                    'processing_time': datetime.now().isoformat(),
                    'output_file': str(translate_output)
                },
                'translated_data': [],
                'open_ended_fields': open_ended_fields,
                'available_for_labeling': True
            }
            
            # 准备翻译后的数据预览（前10行）
            for col in translated_df.columns:
                result['translated_data'].append({
                    'field': col,
                    'values': translated_df[col].head(10).fillna('').astype(str).tolist(),
                    'is_translated': col.endswith('-CN'),
                    'is_open_ended': col.replace('-CN', '') in open_ended_fields
                })
            
            # 存储翻译结果
            analysis_results[analysis_id]['translation_result'] = result
            analysis_results[analysis_id]['translation_output'] = str(translate_output)
            
            logger.info(f"✅ 开放题翻译完成，分析ID: {analysis_id}")
            return jsonify(convert_pandas_types(result))
            
        except Exception as e:
            logger.error(f"❌ 开放题翻译失败: {e}")
            logger.error(f"❌ 异常类型: {type(e)}")
            import traceback
            logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
            return jsonify({'error': f'开放题翻译失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"❌ 翻译请求处理失败: {e}")
        return jsonify({'error': f'翻译请求处理失败: {str(e)}'}), 500

@app.route('/standard-labeling', methods=['POST'])
def handle_standard_labeling():
    """标准AI打标 - 基于翻译后的数据进行AI自动分类"""
    try:
        logger.info("🔍 收到标准AI打标请求")
        
        data = request.get_json()
        analysis_id = data.get('analysisId')
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        analysis_info = analysis_results[analysis_id]
        
        # 检查是否已完成翻译
        if 'translation_output' not in analysis_info:
            return jsonify({'error': '请先完成开放题翻译'}), 400
        
        translation_output = analysis_info['translation_output']
        if not os.path.exists(translation_output):
            return jsonify({'error': '翻译结果文件不存在'}), 400
        
        logger.info(f"📊 基于翻译文件进行标准AI打标: {translation_output}")
        
        try:
            # 导入classification模块
            try:
                from classification import QuestionnaireTranslationClassifier
                logger.info("✅ 成功导入 QuestionnaireTranslationClassifier")
            except ImportError as e:
                logger.error(f"❌ 导入 QuestionnaireTranslationClassifier 失败: {e}")
                return jsonify({'error': f'导入 classification 模块失败: {str(e)}'}), 500
            
            classifier = QuestionnaireTranslationClassifier()
            
            # 生成标准打标输出文件路径
            base_name, original_timestamp = extract_file_info(translation_output)
            standard_labeling_output = TRANSLATE_AI_FOLDER / f"{base_name}_ai_{original_timestamp}.xlsx"
            
            # 执行标准AI打标（基于已翻译的数据）
            logger.info(f"🔧 开始执行标准AI打标: {translation_output} -> {standard_labeling_output}")
            
            success = classifier.standard_labeling_only(str(translation_output), str(standard_labeling_output))
            
            if not success:
                return jsonify({'error': '标准AI打标处理失败'}), 500
            
            logger.info(f"✅ 标准AI打标完成: {standard_labeling_output}")
            
            # 读取处理后的文件
            processed_df = pd.read_excel(str(standard_labeling_output))
            
            # 获取开放题字段（用于题型识别）
            open_ended_fields = analysis_info.get('translation_result', {}).get('open_ended_fields', [])
            
            # 生成处理结果
            result = {
                'summary': {
                    'total_responses': len(processed_df),
                    'processed_fields': len(open_ended_fields),
                    'processing_time': datetime.now().isoformat(),
                    'output_file': str(standard_labeling_output),
                    'labeling_type': 'standard_ai'
                },
                'processed_data': [],
                'field_analysis': {},
                'sample_size': len(processed_df)
            }
            
            # 准备处理后的数据（完整数据）- 转换为数组格式
            for col in processed_df.columns:
                result['processed_data'].append({
                    'field': col,
                    'values': processed_df[col].fillna('').astype(str).tolist()
                })
            
            # 为每个开放题字段生成详细分析
            for field in open_ended_fields:
                if field in processed_df.columns:
                    # 分析翻译列
                    cn_field = f"{field}-CN"
                    main_topic_field = f"{field}一级主题"
                    sub_tag_field = f"{field}二级标签"
                    
                    field_analysis = {
                        'original_field': field,
                        'has_translation': cn_field in processed_df.columns,
                        'has_main_topics': main_topic_field in processed_df.columns,
                        'has_sub_tags': sub_tag_field in processed_df.columns
                    }
                    
                    # 统计主题分布
                    if main_topic_field in processed_df.columns:
                        main_topics = processed_df[main_topic_field].dropna()
                        if len(main_topics) > 0:
                            topic_counts = main_topics.value_counts().head(10)
                            field_analysis['main_topics'] = topic_counts.to_dict()
                    
                    # 统计二级标签分布
                    if sub_tag_field in processed_df.columns:
                        sub_tags = processed_df[sub_tag_field].dropna()
                        if len(sub_tags) > 0:
                            tag_counts = sub_tags.value_counts().head(10)
                            field_analysis['sub_tags'] = tag_counts.to_dict()
                    
                    result['field_analysis'][field] = field_analysis
            
            # 存储标准打标结果
            analysis_results[analysis_id]['standard_labeling_result'] = result
            analysis_results[analysis_id]['standard_labeling_output'] = str(standard_labeling_output)
            
            logger.info(f"✅ 标准AI打标完成，分析ID: {analysis_id}")
            return jsonify(convert_pandas_types(result))
            
        except Exception as e:
            logger.error(f"❌ 标准AI打标失败: {e}")
            logger.error(f"❌ 异常类型: {type(e)}")
            import traceback
            logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
            return jsonify({'error': f'标准AI打标失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"❌ 标准AI打标请求处理失败: {e}")
        return jsonify({'error': f'标准AI打标请求处理失败: {str(e)}'}), 500

# # 处理Classification分析 开始分析 (保持向后兼容)
# @app.route('/classification', methods=['POST'])
# def handle_classification():
#     """处理Classification分析"""
#     try:
#         logger.info("🔍 收到Classification处理请求")
        
#         data = request.get_json()
#         analysis_id = data.get('analysisId')
#         selected_fields = data.get('selectedFields', [])
        
#         if not analysis_id or analysis_id not in analysis_results:
#             return jsonify({'error': '无效的分析ID'}), 400
        
#         # 注意：选择字段检查被注释掉是为了允许处理所有字段
#         # if not selected_fields:
#         #     return jsonify({'error': '请选择要分析的字段'}), 400
        
#         analysis_info = analysis_results[analysis_id]
#         input_file = analysis_info['file_path']
        
#         logger.info(f"📊 开始Classification处理，文件: {input_file}")
        
#         try:
#             # 导入classification模块
#             try:
#                 from classification import QuestionnaireTranslationClassifier
#                 logger.info("✅ 成功导入 QuestionnaireTranslationClassifier")
#             except ImportError as e:
#                 logger.error(f"❌ 导入 QuestionnaireTranslationClassifier 失败: {e}")
#                 return jsonify({'error': f'导入 classification 模块失败: {str(e)}'}), 500
            
#             classifier = QuestionnaireTranslationClassifier()
            
#             # 生成输出文件路径到classification子目录
#             # 从原始文件路径提取基础信息
#             base_name, original_timestamp = extract_file_info(input_file)
#             output_file = CLASSIFICATION_FOLDER / f"{base_name}_class_{original_timestamp}.xlsx"
            
#             # 执行classification处理
#             logger.info(f"🔧 开始执行classification处理: {input_file} -> {output_file}")
#             logger.info(f"📋 输入文件存在: {Path(input_file).exists()}")
#             logger.info(f"📋 输入文件大小: {Path(input_file).stat().st_size if Path(input_file).exists() else 'N/A'} bytes")
            
#             try:
#                 logger.info("🚀 即将调用 classifier.process_table 方法")
#                 success = classifier.process_table(input_file, str(output_file))
#                 logger.info(f"🔧 classifier.process_table 返回结果: {success}")
#                 logger.info(f"📋 输出文件存在: {Path(output_file).exists()}")
#                 if Path(output_file).exists():
#                     logger.info(f"📋 输出文件大小: {Path(output_file).stat().st_size} bytes")
                
#                 if not success:
#                     logger.error("❌ classifier.process_table 返回 False")
#                     return jsonify({'error': 'Classification处理失败 - process_table返回False'}), 500
                    
#             except Exception as process_error:
#                 logger.error(f"❌ classifier.process_table 执行时发生异常: {process_error}")
#                 logger.error(f"❌ 异常类型: {type(process_error)}")
#                 import traceback
#                 logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
#                 return jsonify({'error': f'Classification处理异常: {str(process_error)}'}), 500
            
#             logger.info(f"✅ Classification处理完成: {output_file}")
            
#             # 读取处理后的文件
#             processed_df = pd.read_excel(str(output_file))
            
#             # 筛选选中的字段（如果存在）
#             available_fields = [col for col in processed_df.columns if col in selected_fields or col in [col.replace('_翻译', '') for col in selected_fields]]
#             if not available_fields:
#                 # 如果没有找到匹配的字段，使用所有字段
#                 available_fields = processed_df.columns.tolist()
            
#             # 生成处理结果
#             result = {
#                 'summary': {
#                     'total_responses': len(processed_df),
#                     'processed_fields': len(available_fields),
#                     'processing_time': datetime.now().isoformat(),
#                     'output_file': str(output_file)
#                 },
#                 'processed_data': {},
#                 'field_analysis': {},
#                 'sample_size': min(10, len(processed_df))
#             }
            
#             # 准备处理后的数据（前10行）- 转换为数组格式
#             result['processed_data'] = []
            
#             # 读取处理后的文件并识别题型
#             try:
#                 from universal_questionnaire_analyzer import UniversalQuestionnaireAnalyzer
#                 logger.info("✅ 成功导入 UniversalQuestionnaireAnalyzer")
#             except ImportError as e:
#                 logger.error(f"❌ 导入 UniversalQuestionnaireAnalyzer 失败: {e}")
#                 return jsonify({'error': f'导入分析模块失败: {str(e)}'}), 500
            
#             analyzer = UniversalQuestionnaireAnalyzer()
#             question_types = analyzer.identify_all_question_types(processed_df)
            
#             # 打印题型识别结果
#             logger.info("题型识别结果:")
#             logger.info(f"单选题: {question_types.get('single_choice', [])}")
#             logger.info(f"量表题: {question_types.get('scale_questions', [])}")
#             logger.info(f"开放题: {question_types.get('open_ended', [])}")
            
#             # 创建字段到类型的映射
#             field_type_map = {}
            
#             # 1. 处理单选题 (type: 0)
#             for q in question_types.get('single_choice', []):
#                 if isinstance(q, dict) and 'column' in q:
#                     field_type_map[q['column']] = 0
            
#             # 2. 处理量表题 (type: 1)
#             for q in question_types.get('scale_questions', []):
#                 if isinstance(q, dict) and 'column' in q:
#                     field_type_map[q['column']] = 1
            
#             # 3. 处理开放题 (type: 2)
#             for q in question_types.get('open_ended', []):
#                 if isinstance(q, dict) and 'column' in q:
#                     field_type_map[q['column']] = 2
            
#             # 新逻辑中无其他题型，所有字段都已被分类


            
#             for col in available_fields:
#                 if col in processed_df.columns:
#                     result['processed_data'].append({
#                         'field': col,
#                         'values': processed_df[col].head(10).fillna('').astype(str).tolist(),
#                         'type': field_type_map.get(col)  # 如果字段没有被分类，将返回 None
#                     })
            
#             # 为每个字段生成详细分析
#             for field in available_fields:
#                 if field in processed_df.columns:
#                     field_data = processed_df[field]
#                     field_data_clean = field_data.dropna()
                    
#                     if len(field_data_clean) > 0:
#                         # 获取样本数据
#                         sample_data = field_data_clean.head(10).tolist()
                        
#                         # 获取唯一值数量
#                         unique_count = len(field_data_clean.unique())
                        
#                         # 如果是翻译字段，尝试提取主要主题
#                         main_topics = []
#                         if '_翻译' in field or '_标签' in field:
#                             # 从数据中提取前5个最常见的值作为主题
#                             value_counts = field_data_clean.value_counts().head(5)
#                             main_topics = value_counts.index.tolist()
                        
#                         result['field_analysis'][field] = {
#                             'response_count': len(field_data_clean),
#                             'unique_values': unique_count,
#                             'sample_data': sample_data,
#                             'main_topics': main_topics
#                         }
            
#             # 存储处理结果
#             analysis_results[analysis_id]['classification_result'] = result
#             analysis_results[analysis_id]['classification_output'] = str(output_file)
            
#             logger.info(f"✅ Classification处理完成，分析ID: {analysis_id}")
#             return jsonify(convert_pandas_types(result))
            
#         except Exception as e:
#             logger.error(f"❌ Classification处理失败: {e}")
#             logger.error(f"❌ 异常类型: {type(e)}")
#             import traceback
#             logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
#             return jsonify({'error': f'Classification处理失败: {str(e)}'}), 500
            
#     except Exception as e:
#         logger.error(f"❌ Classification请求处理失败: {e}")
#         logger.error(f"❌ 异常类型: {type(e)}")
#         import traceback
#         logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
#         return jsonify({'error': f'Classification请求处理失败: {str(e)}'}), 500

@app.route('/retag-with-reference', methods=['POST'])
def retag_with_reference():
    """基于参考标签重新打标"""
    try:
        logger.info("🏷️  收到参考标签重新打标请求")
        
        data = request.get_json()
        analysis_id = data.get('analysisId')
        reference_tags = data.get('reference_tags', [])
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        if not reference_tags:
            return jsonify({'error': '请提供参考标签'}), 400
        
        # 验证参考标签格式
        for tag in reference_tags:
            if not isinstance(tag, dict) or 'name' not in tag or 'definition' not in tag:
                return jsonify({'error': '参考标签格式错误，需要包含name和definition字段'}), 400
        
        analysis_info = analysis_results[analysis_id]
        
        # 检查是否已完成翻译
        if 'translation_output' not in analysis_info:
            return jsonify({'error': '请先完成开放题翻译'}), 400
        
        translation_output = analysis_info['translation_output']
        if not os.path.exists(translation_output):
            return jsonify({'error': '翻译结果文件不存在'}), 400
        
        input_file = translation_output
        logger.info(f"📁 基于翻译文件进行参考标签打标: {input_file}")
        
        logger.info(f"📊 开始基于参考标签重新打标，文件: {input_file}")
        logger.info(f"📋 参考标签数量: {len(reference_tags)}")
        for tag in reference_tags:
            logger.info(f"  - {tag['name']}: {tag['definition']}")
        
        try:
            # 导入classification模块
            try:
                from classification import QuestionnaireTranslationClassifier
                logger.info("✅ 成功导入 QuestionnaireTranslationClassifier")
            except ImportError as e:
                logger.error(f"❌ 导入 QuestionnaireTranslationClassifier 失败: {e}")
                return jsonify({'error': f'导入 classification 模块失败: {str(e)}'}), 500
            
            classifier = QuestionnaireTranslationClassifier()
            
            # 生成输出文件路径到translate_custom子目录
            # 从翻译文件路径提取基础信息
            base_name, original_timestamp = extract_file_info(input_file)
            output_file = TRANSLATE_CUSTOM_FOLDER / f"{base_name}_custom_{original_timestamp}.xlsx"
            
            # 直接读取现有文件并进行重新打标（不重新翻译）
            logger.info(f"🔧 开始基于现有翻译进行参考标签重新打标")
            
            try:
                # 读取现有文件
                df = pd.read_excel(input_file)
                logger.info(f"📋 读取文件成功，共 {len(df)} 行，{len(df.columns)} 列")
                
                # 识别已翻译的-CN字段
                cn_columns = [col for col in df.columns if col.endswith('-CN')]
                logger.info(f"🔍 发现 {len(cn_columns)} 个已翻译的-CN字段: {cn_columns}")
                
                if not cn_columns:
                    return jsonify({'error': '未找到已翻译的-CN字段，请先进行初始分类'}), 400
                
                # 设置参考标签
                classifier.set_reference_tags(reference_tags)
                
                # 为每个-CN字段重新打标
                for cn_col in cn_columns:
                    original_col = cn_col.replace('-CN', '')
                    tag_col = f"{original_col}标签"
                    
                    logger.info(f"🏷️  正在为 {cn_col} 重新打标...")
                    
                    # 获取已翻译的中文文本
                    cn_texts = df[cn_col].fillna('').astype(str).tolist()
                    
                    # 基于参考标签打标
                    assigned_tags = classifier.assign_tags_based_on_reference(cn_texts)
                    
                    # 更新DataFrame - 只生成一个标签字段
                    df[tag_col] = assigned_tags
                    
                    logger.info(f"✅ {cn_col} 重新打标完成")
                
                # 保存结果
                df.to_excel(str(output_file), index=False)
                logger.info(f"💾 重新打标结果已保存: {output_file}")
                
                success = True
                    
            except Exception as process_error:
                logger.error(f"❌ 重新打标执行时发生异常: {process_error}")
                logger.error(f"❌ 异常类型: {type(process_error)}")
                import traceback
                logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
                return jsonify({'error': f'参考标签重新打标异常: {str(process_error)}'}), 500
            
            logger.info(f"✅ 参考标签重新打标完成: {output_file}")
            
            # 读取处理后的文件
            processed_df = pd.read_excel(str(output_file))
            
            # 生成与初始分类结果相同格式的结果
            result = {
                'summary': {
                    'total_responses': len(processed_df),
                    'processed_fields': len([col for col in processed_df.columns if col.endswith('-CN') or col.endswith('标签')]),
                    'reference_tags_count': len(reference_tags),
                    'processing_time': datetime.now().isoformat(),
                    'output_file': str(output_file)
                },
                'processed_data': [],
                'reference_tags': reference_tags,
                'sample_size': len(processed_df)
            }
            
            # 按照初始分类结果的格式生成processed_data
            for col in processed_df.columns:
                result['processed_data'].append({
                    'field': col,
                    'values': processed_df[col].fillna('').astype(str).tolist()
                })
            
            # 存储处理结果 - 使用新的字段名以区分配置参考标签打标
            analysis_results[analysis_id]['custom_labeling_result'] = result  
            analysis_results[analysis_id]['custom_labeling_output'] = str(output_file)
            
            logger.info(f"✅ 参考标签重新打标完成，分析ID: {analysis_id}")
            return jsonify(convert_pandas_types(result))
            
        except Exception as e:
            logger.error(f"❌ 参考标签重新打标失败: {e}")
            logger.error(f"❌ 异常类型: {type(e)}")
            import traceback
            logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
            return jsonify({'error': f'参考标签重新打标失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"❌ 参考标签重新打标请求处理失败: {e}")
        logger.error(f"❌ 异常类型: {type(e)}")
        import traceback
        logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
        return jsonify({'error': f'参考标签重新打标请求处理失败: {str(e)}'}), 500

@app.route('/analysis-results/<analysis_id>', methods=['GET'])
def get_analysis_results(analysis_id):
    """获取分析结果"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        result = analysis_info.get('analysis_result')
        
        if not result:
            return jsonify({'error': '分析结果不存在'}), 404
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"❌ 获取分析结果失败: {e}")
        return jsonify({'error': f'获取分析结果失败: {str(e)}'}), 500

# 统计分析
@app.route('/statistics', methods=['POST'])
def statistics():
    """统计分析接口 - 独立进行统计分析"""
    try:
        logger.info("📊 收到统计分析请求")
        
        data = request.get_json()
        analysis_id = data.get('analysisId')
        selected_fields = data.get('selectedFields', [])
        question_types = data.get('questionTypes', {})
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        if not selected_fields:
            return jsonify({'error': '请选择要分析的字段'}), 400
        
        analysis_info = analysis_results[analysis_id]
        df = analysis_info['dataframe']
        
        logger.info(f"📈 开始统计分析 {len(selected_fields)} 个字段")
        
        # 导入分析模块
        try:
            from universal_questionnaire_analyzer import UniversalQuestionnaireAnalyzer
            logger.info("✅ 成功导入 UniversalQuestionnaireAnalyzer")
        except ImportError as e:
            logger.error(f"❌ 导入 UniversalQuestionnaireAnalyzer 失败: {e}")
            return jsonify({'error': f'导入分析模块失败: {str(e)}'}), 500
        
        analyzer = UniversalQuestionnaireAnalyzer()
        
        # 筛选选中的字段
        available_fields = [col for col in selected_fields if col in df.columns]
        if not available_fields:
            return jsonify({'error': '选中的字段在数据中不存在'}), 400
        
        filtered_df = df[available_fields]
        
        # 重新识别问题类型（基于选中的字段）
        field_question_types = analyzer.identify_all_question_types(filtered_df)
        
        # 生成统计分析结果
        analysis_result = {
            'summary': {
                'totalFields': len(available_fields),
                'analyzedQuestions': len(available_fields),
                'totalResponses': len(filtered_df)
            },
            'scaleQuestions': [],
            'singleChoiceQuestions': [],
                        'multipleChoiceQuestions': [],
            'openEndedQuestions': [],
            'crossAnalysis': None
        }
        
        # 处理量表题
        scale_questions = field_question_types.get('scale_questions', [])
        for q in scale_questions:
            col = q['column']
            if col in filtered_df.columns:
                data = filtered_df[col].dropna()
                if len(data) > 0:
                    # 转换为数值
                    numeric_data = pd.to_numeric(data, errors='coerce').dropna()
                    if len(numeric_data) > 0:
                        # 基础统计
                        stats = {
                            'count': len(numeric_data),
                            'mean': float(numeric_data.mean()),
                            'std': float(numeric_data.std()),
                            'min': float(numeric_data.min()),
                            'max': float(numeric_data.max()),
                            'median': float(numeric_data.median())
                        }
                        
                        # 分布统计
                        distribution = {}
                        value_counts = numeric_data.value_counts().sort_index()
                        total = len(numeric_data)
                        for score, count in value_counts.items():
                            distribution[str(int(score))] = {
                                'count': int(count),
                                'percentage': float(count / total * 100)
                            }
                        
                        # NPS分析（适用于1-10分制）
                        nps_analysis = None
                        if stats['max'] <= 10 and stats['min'] >= 1:
                            promoters = len(numeric_data[numeric_data >= 9])
                            passives = len(numeric_data[(numeric_data >= 7) & (numeric_data <= 8)])
                            detractors = len(numeric_data[numeric_data <= 6])
                            
                            nps_score = (promoters - detractors) / total * 100
                            
                            nps_analysis = {
                                'promoters': {'count': promoters, 'percentage': promoters / total * 100},
                                'passives': {'count': passives, 'percentage': passives / total * 100},
                                'detractors': {'count': detractors, 'percentage': detractors / total * 100},
                                'nps': nps_score,
                                'evaluation': '优秀' if nps_score > 50 else '良好' if nps_score > 0 else '需改进'
                            }
                        
                        analysis_result['scaleQuestions'].append({
                            'column': col,
                            'statistics': stats,
                            'distribution': distribution,
                            'npsAnalysis': nps_analysis
                        })
        
        # 处理单选题
        single_choice = field_question_types.get('single_choice', [])
        for q in single_choice:
            col = q['column']
            if col in filtered_df.columns:
                data = filtered_df[col].dropna()
                if len(data) > 0:
                    value_counts = data.value_counts()
                    total = len(data)
                    
                    options = []
                    for option, count in value_counts.items():
                        options.append({
                            'option': str(option),
                            'count': int(count),
                            'percentage': float(count / total * 100)
                        })
                    
                    most_selected = options[0] if options else None
                    
                    analysis_result['singleChoiceQuestions'].append({
                        'column': col,
                        'validResponses': total,
                        'totalOptions': len(options),
                        'options': options,
                        'mostSelected': most_selected
                    })
        
        # 处理开放题
        open_ended = field_question_types.get('open_ended', [])
        for q in open_ended:
            col = q['column']
            if col in filtered_df.columns:
                data = filtered_df[col].dropna()
                if len(data) > 0:
                    # 基础统计
                    avg_length = data.astype(str).str.len().mean()
                    unique_count = len(data.unique())
                    uniqueness_ratio = unique_count / len(data)
                    
                    # 提取关键词（简单的词频统计）
                    text_data = ' '.join(data.astype(str))
                    words = text_data.split()
                    word_freq = pd.Series(words).value_counts().head(10)
                    
                    top_keywords = []
                    for word, count in word_freq.items():
                        if len(word) > 1:  # 过滤单字符
                            top_keywords.append({'word': word, 'count': int(count)})
                    
                    # 示例回答
                    sample_responses = data.head(5).tolist()
                    
                    analysis_result['openEndedQuestions'].append({
                        'column': col,
                        'validResponses': len(data),
                        'statistics': {
                            'averageLength': avg_length,
                            'uniqueCount': unique_count,
                            'uniquenessRatio': uniqueness_ratio
                        },
                        'topKeywords': top_keywords[:8],
                        'sampleResponses': sample_responses
                    })
        

        # 处理多选题
        multiple_choice = field_question_types.get('multiple_choice', {})
        for question_stem, options in multiple_choice.items():
            # 提取所有选项的列名
            option_columns = [opt['full_column'] for opt in options if opt['full_column'] in filtered_df.columns]
            
            if option_columns:
                # 创建多选题分析结果
                multi_question = {
                    'column': question_stem,  # 与单选题保持一致，使用column而不是questionStem
                    'totalOptions': len(option_columns),
                    'validResponses': len(filtered_df),  # 与单选题保持一致，使用validResponses而不是totalResponses
                    'options': []
                }
                
                # 计算总响应数（至少选择了一个选项的行数）
                respondents = 0
                for i, row in filtered_df[option_columns].iterrows():
                    if row.notna().any():
                        respondents += 1
                
                multi_question['validResponses'] = respondents if respondents > 0 else len(filtered_df)
                
                # 处理每个选项
                for opt_info in options:
                    col = opt_info['full_column']
                    if col in filtered_df.columns:
                        # 获取选项文本
                        option_text = opt_info['option']
                        
                        # 统计选择该选项的人数
                        try:
                            # 尝试将列转换为布尔值（针对0/1编码的多选题）
                            data = filtered_df[col].fillna(0).astype(int).astype(bool)
                            selected_count = data.sum()
                        except:
                            # 如果失败，则按非空值计数
                            selected_count = filtered_df[col].notna().sum()
                        
                        # 计算百分比
                        percentage = (selected_count / multi_question['validResponses'] * 100) if multi_question['validResponses'] > 0 else 0
                        
                        # 添加选项分析 - 与单选题保持一致的格式
                        multi_question['options'].append({
                            'option': option_text,
                            'count': int(selected_count),
                            'percentage': float(percentage)
                        })
                
                # 添加最多选择的选项 - 与单选题保持一致
                if multi_question['options']:
                    # 排序选项（按选择数量降序）
                    sorted_options = sorted(multi_question['options'], key=lambda x: x['count'], reverse=True)
                    multi_question['mostSelected'] = sorted_options[0]
                    
                    # 保留summary字段，但确保格式一致
                    multi_question['summary'] = {
                        'mostSelected': sorted_options[0],
                        'leastSelected': sorted_options[-1],
                        'averageSelectionRate': sum(opt['percentage'] for opt in multi_question['options']) / len(multi_question['options'])
                    }
                
                # 添加到结果集
                analysis_result['multipleChoiceQuestions'].append(multi_question)
        
        # 存储分析结果
        analysis_results[analysis_id]['statistics_result'] = analysis_result
        
        logger.info(f"✅ 统计分析完成，分析ID: {analysis_id}")
        return jsonify({
            'results': convert_pandas_types(analysis_result),
            'analysisId': analysis_id
        })
        
    except Exception as e:
        logger.error(f"❌ 统计分析失败: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'统计分析失败: {str(e)}'}), 500

@app.route('/export/<analysis_id>', methods=['GET'])
def export_results(analysis_id):
    """导出分析结果"""
    try:
        format_type = request.args.get('format', 'csv')
        
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        processed_file = analysis_info.get('processed_file')
        
        if not processed_file or not os.path.exists(processed_file):
            return jsonify({'error': '处理后的文件不存在'}), 404
        
        # 返回处理后的文件
        return send_file(
            processed_file,
            as_attachment=True,
            download_name=f"analysis_{analysis_id}.{format_type}"
        )
        
    except Exception as e:
        logger.error(f"❌ 导出失败: {e}")
        return jsonify({'error': f'导出失败: {str(e)}'}), 500

# @app.route('/download-classification/<analysis_id>', methods=['GET'])
# def download_classification(analysis_id):
#     """下载Classification处理后的文件"""
#     try:
#         if analysis_id not in analysis_results:
#             return jsonify({'error': '分析ID不存在'}), 404
        
#         analysis_info = analysis_results[analysis_id]
#         classification_output = analysis_info.get('classification_output')
        
#         if not classification_output or not os.path.exists(classification_output):
#             return jsonify({'error': 'Classification处理结果文件不存在'}), 404
        
#         # 使用实际文件名而不是硬编码的名称
#         actual_filename = Path(classification_output).name
        
#         return send_file(
#             classification_output,
#             as_attachment=True,
#             download_name=actual_filename,
#             mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
#         )
        
#     except Exception as e:
#         logger.error(f"❌ 下载Classification结果失败: {e}")
#         return jsonify({'error': f'下载Classification结果失败: {str(e)}'}), 500

@app.route('/get-ai-tags-for-editing/<analysis_id>', methods=['GET'])
def get_ai_tags_for_editing(analysis_id):
    """获取标准AI打标后的可编辑标签数据"""
    try:
        logger.info(f"🔍 收到标准AI打标编辑请求，analysis_id: {analysis_id}")
        
        if analysis_id not in analysis_results:
            logger.error(f"❌ 分析ID {analysis_id} 不存在于analysis_results中")
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        
        # 专门读取标准AI打标文件
        standard_labeling_output = analysis_info.get('standard_labeling_output')
        manual_ai_output = analysis_info.get('manual_ai_output')  # 手动修改后的AI打标文件
        
        input_file = None
        use_tag_columns = False
        
        # 优先读取手动修改后的AI打标文件，其次读取原始AI打标文件
        if manual_ai_output and os.path.exists(manual_ai_output):
            input_file = manual_ai_output
            use_tag_columns = False  # AI打标使用一级主题和二级标签
            logger.info(f"📁 读取手动修改后的AI打标文件: {input_file}")
        elif standard_labeling_output and os.path.exists(standard_labeling_output):
            input_file = standard_labeling_output
            use_tag_columns = False  # AI打标使用一级主题和二级标签
            logger.info(f"📁 读取标准AI打标文件: {input_file}")
        else:
            return jsonify({'error': '没有找到标准AI打标结果文件'}), 404
        
        return _process_tags_for_editing(analysis_id, input_file, use_tag_columns, "AI打标")
        
    except Exception as e:
        logger.error(f"❌ 获取AI打标编辑数据失败: {e}")
        return jsonify({'error': f'获取AI打标编辑数据失败: {str(e)}'}), 500

@app.route('/get-custom-tags-for-editing/<analysis_id>', methods=['GET'])
def get_custom_tags_for_editing(analysis_id):
    """获取参考标签打标后的可编辑标签数据"""
    try:
        logger.info(f"🔍 收到参考标签打标编辑请求，analysis_id: {analysis_id}")
        
        if analysis_id not in analysis_results:
            logger.error(f"❌ 分析ID {analysis_id} 不存在于analysis_results中")
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        
        # 专门读取参考标签打标文件
        custom_labeling_output = analysis_info.get('custom_labeling_output')
        manual_custom_output = analysis_info.get('manual_custom_output')  # 手动修改后的参考标签文件
        
        input_file = None
        use_tag_columns = True
        
        # 优先读取手动修改后的参考标签文件，其次读取原始参考标签文件
        if manual_custom_output and os.path.exists(manual_custom_output):
            input_file = manual_custom_output
            use_tag_columns = True  # 参考标签使用标签列
            logger.info(f"📁 读取手动修改后的参考标签文件: {input_file}")
        elif custom_labeling_output and os.path.exists(custom_labeling_output):
            input_file = custom_labeling_output
            use_tag_columns = True  # 参考标签使用标签列
            logger.info(f"📁 读取参考标签打标文件: {input_file}")
        else:
            # 尝试在translate_custom目录中搜索备用文件
            logger.warning(f"⚠️ 未找到参考标签文件，尝试搜索备用文件")
            try:
                custom_files = list(TRANSLATE_CUSTOM_FOLDER.glob(f"*{analysis_id.split('-')[0]}*_translate_custom_*.xlsx"))
                if custom_files:
                    latest_custom_file = max(custom_files, key=os.path.getmtime)
                    input_file = str(latest_custom_file)
                    use_tag_columns = True
                    # 更新analysis_results中的路径
                    analysis_results[analysis_id]['custom_labeling_output'] = str(latest_custom_file)
                    logger.info(f"🔧 找到备用参考标签文件: {input_file}")
                else:
                    return jsonify({'error': '没有找到参考标签打标结果文件，请先执行参考标签打标'}), 404
            except Exception as search_error:
                logger.error(f"❌ 搜索备用文件失败: {search_error}")
                return jsonify({'error': '没有找到参考标签打标结果文件'}), 404
        
        return _process_tags_for_editing(analysis_id, input_file, use_tag_columns, "参考标签打标")
        
    except Exception as e:
        logger.error(f"❌ 获取参考标签编辑数据失败: {e}")
        return jsonify({'error': f'获取参考标签编辑数据失败: {str(e)}'}), 500

def _process_tags_for_editing(analysis_id, input_file, use_tag_columns, edit_type):
    """处理标签编辑数据的通用函数"""
    try:
        analysis_info = analysis_results[analysis_id]
        
        # 读取文件
        df = pd.read_excel(input_file)
        logger.info(f"📊 读取到的{edit_type}文件列数: {len(df.columns)}")
        logger.info(f"📊 文件列名: {list(df.columns)}")
        
        # 获取开放题字段
        open_ended_fields = []
        if 'question_types' in analysis_info:
            question_types = analysis_info['question_types']
            open_ended_list = question_types.get('open_ended', [])
            for q in open_ended_list:
                if isinstance(q, dict) and 'column' in q:
                    open_ended_fields.append(q['column'])
        
        logger.info(f"📊 开放题字段: {open_ended_fields}")
        
        # 构建开放题字段的编辑数据结构
        open_questions = []
        
        for open_field in open_ended_fields:
            question_data = {
                'original_field': open_field,
                'cn_field': open_field + '-CN',
                'level1_theme_field': open_field + '一级主题',
                'level2_tag_field': open_field + '二级标签',
                'reference_tag_field': open_field + '标签',
                'available_columns': []
            }
            
            # 检查各列是否存在
            if open_field in df.columns:
                question_data['available_columns'].append(open_field)
            if question_data['cn_field'] in df.columns:
                question_data['available_columns'].append(question_data['cn_field'])
            if question_data['level1_theme_field'] in df.columns:
                question_data['available_columns'].append(question_data['level1_theme_field'])
            if question_data['level2_tag_field'] in df.columns:
                question_data['available_columns'].append(question_data['level2_tag_field'])
            if question_data['reference_tag_field'] in df.columns:
                question_data['available_columns'].append(question_data['reference_tag_field'])
            
            # 调试日志：输出每个问题的字段信息
            logger.info(f"📊 {edit_type}问题 '{open_field}' 的字段检查:")
            logger.info(f"   - 原字段: {open_field} -> {'存在' if open_field in df.columns else '不存在'}")
            logger.info(f"   - CN字段: {question_data['cn_field']} -> {'存在' if question_data['cn_field'] in df.columns else '不存在'}")
            logger.info(f"   - 一级主题字段: {question_data['level1_theme_field']} -> {'存在' if question_data['level1_theme_field'] in df.columns else '不存在'}")
            logger.info(f"   - 二级标签字段: {question_data['level2_tag_field']} -> {'存在' if question_data['level2_tag_field'] in df.columns else '不存在'}")
            logger.info(f"   - 参考标签字段: {question_data['reference_tag_field']} -> {'存在' if question_data['reference_tag_field'] in df.columns else '不存在'}")
            
            # 只有当至少有原字段时才添加
            if open_field in df.columns:
                open_questions.append(question_data)
        
        if not open_questions:
            logger.error(f"❌ 没有找到可编辑的开放题字段")
            return jsonify({'error': '没有找到可编辑的开放题字段'}), 400
        
        # 准备编辑数据
        edit_data = []
        for index, row in df.iterrows():
            row_data = {
                'id': index,
                'questions': {}
            }
            
            # 为每个开放题字段准备数据
            for question in open_questions:
                question_data = {
                    'original_text': str(row[question['original_field']]) if pd.notna(row[question['original_field']]) else '',
                    'cn_text': str(row[question['cn_field']]) if question['cn_field'] in df.columns and pd.notna(row[question['cn_field']]) else '',
                    'level1_themes': [],
                    'level2_tags': [],
                    'reference_tags': []
                }
                
                # 处理一级主题
                if question['level1_theme_field'] in df.columns:
                    theme_str = str(row[question['level1_theme_field']]) if pd.notna(row[question['level1_theme_field']]) else ''
                    if theme_str:
                        if ',' in theme_str:
                            question_data['level1_themes'] = [tag.strip() for tag in theme_str.split(',') if tag.strip()]
                        else:
                            question_data['level1_themes'] = [theme_str.strip()] if theme_str.strip() else []
                
                # 处理二级标签
                if question['level2_tag_field'] in df.columns:
                    tags_str = str(row[question['level2_tag_field']]) if pd.notna(row[question['level2_tag_field']]) else ''
                    if tags_str:
                        question_data['level2_tags'] = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
                
                # 处理参考标签
                if question['reference_tag_field'] in df.columns:
                    ref_tags_str = str(row[question['reference_tag_field']]) if pd.notna(row[question['reference_tag_field']]) else ''
                    if ref_tags_str:
                        question_data['reference_tags'] = [tag.strip() for tag in ref_tags_str.split(',') if tag.strip()]
                
                row_data['questions'][question['original_field']] = question_data
            
            edit_data.append(row_data)
        
        # 统计标签使用频率
        tag_statistics = {}
        for question in open_questions:
            question_stats = {}
            
            # 统计一级主题
            if question['level1_theme_field'] in df.columns:
                level1_tags = []
                for theme_str in df[question['level1_theme_field']].fillna('').astype(str):
                    if theme_str:
                        if ',' in theme_str:
                            level1_tags.extend([tag.strip() for tag in theme_str.split(',') if tag.strip()])
                        else:
                            if theme_str.strip():
                                level1_tags.append(theme_str.strip())
                
                from collections import Counter
                question_stats['level1_themes'] = dict(Counter(level1_tags))
            
            # 统计二级标签
            if question['level2_tag_field'] in df.columns:
                level2_tags = []
                for tags_str in df[question['level2_tag_field']].fillna('').astype(str):
                    if tags_str:
                        level2_tags.extend([tag.strip() for tag in tags_str.split(',') if tag.strip()])
                
                from collections import Counter
                question_stats['level2_tags'] = dict(Counter(level2_tags))
            
            # 统计参考标签
            if question['reference_tag_field'] in df.columns:
                reference_tags_list = []
                for ref_tags_str in df[question['reference_tag_field']].fillna('').astype(str):
                    if ref_tags_str:
                        reference_tags_list.extend([tag.strip() for tag in ref_tags_str.split(',') if tag.strip()])
                
                from collections import Counter
                question_stats['reference_tags'] = dict(Counter(reference_tags_list))
            
            tag_statistics[question['original_field']] = question_stats
        
        # 获取参考标签
        reference_tags = []
        if 'retag_result' in analysis_info:
            reference_tags = analysis_info['retag_result'].get('reference_tags', [])
        elif 'custom_labeling_result' in analysis_info:
            reference_tags = analysis_info['custom_labeling_result'].get('reference_tags', [])
        
        # 生成文件预览数据
        preview_data = []
        for col in df.columns:
            field_data = {
                'field': col,
                'values': df[col].fillna('').astype(str).tolist()
            }
            preview_data.append(field_data)

        result = {
            'data': edit_data,  # TagEditor格式的数据
            'processed_data': preview_data,  # 文件预览格式的数据
            'open_questions': open_questions,
            'reference_tags': reference_tags,
            'tag_statistics': tag_statistics,
            'total_rows': len(df),
            'edit_type': edit_type,  # 标识编辑类型
            'file_info': {
                'filename': os.path.basename(input_file),
                'columns': df.columns.tolist(),
                'shape': df.shape
            }
        }
        
        logger.info(f"✅ 获取{edit_type}编辑数据成功，分析ID: {analysis_id}")
        return jsonify(convert_pandas_types(result))
        
    except Exception as e:
        logger.error(f"❌ 处理{edit_type}编辑数据失败: {e}")
        import traceback
        logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
        return jsonify({'error': f'处理{edit_type}编辑数据失败: {str(e)}'}), 500

@app.route('/get-tags-for-editing/<analysis_id>', methods=['GET'])
def get_tags_for_editing(analysis_id):
    """获取可编辑的标签数据"""
    try:
        logger.info(f"🔍 收到手动编辑请求，analysis_id: {analysis_id}")
        logger.info(f"📊 当前analysis_results中的ID列表: {list(analysis_results.keys())}")
        
        if analysis_id not in analysis_results:
            logger.error(f"❌ 分析ID {analysis_id} 不存在于analysis_results中")
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        logger.info(f"📊 analysis_info的keys: {list(analysis_info.keys())}")
        
        # 优先读取手动修改后的文件，其次读取打标文件，最后使用原始分析文件
        manual_output = analysis_info.get('manual_output')
        standard_labeling_output = analysis_info.get('standard_labeling_output')
        custom_labeling_output = analysis_info.get('custom_labeling_output')
        retag_output = analysis_info.get('retag_output')  # 向后兼容
        classification_output = analysis_info.get('classification_output')  # 向后兼容
        original_output = analysis_info.get('output_file') or analysis_info.get('processed_file')  # 兼容多种字段名
        logger.info(f"📁 文件路径检查: manual_output={manual_output}, standard_labeling_output={standard_labeling_output}, custom_labeling_output={custom_labeling_output}, retag_output={retag_output}, classification_output={classification_output}, original_output={original_output}")
        
        if manual_output and os.path.exists(manual_output):
            input_file = manual_output
            use_tag_columns = True
            logger.info(f"📁 读取手动修改后的文件: {input_file}")
        elif custom_labeling_output and os.path.exists(custom_labeling_output):
            # 强制优先读取配置参考标签文件
            input_file = custom_labeling_output
            use_tag_columns = True
            logger.info(f"📁 优先读取配置参考标签打标文件: {input_file}")
        elif standard_labeling_output and os.path.exists(standard_labeling_output):
            input_file = standard_labeling_output
            use_tag_columns = False
            logger.info(f"📁 读取标准AI打标文件: {input_file}")
        elif retag_output and os.path.exists(retag_output):
            input_file = retag_output
            use_tag_columns = True
            logger.info(f"📁 读取重新打标的文件: {input_file}")
        elif classification_output and os.path.exists(classification_output):
            input_file = classification_output
            use_tag_columns = False
            logger.info(f"📁 读取分析配置文件: {input_file} (将使用一级主题列作为标签)")
        elif original_output and os.path.exists(original_output):
            input_file = original_output
            use_tag_columns = False
            logger.info(f"📁 读取原始分析文件: {input_file} (将使用一级主题列作为标签)")
        else:
            return jsonify({'error': '没有找到可用的分析结果文件'}), 404
        
        # 读取文件
        df = pd.read_excel(input_file)
        logger.info(f"📊 读取到的文件列数: {len(df.columns)}")
        logger.info(f"📊 文件列名: {list(df.columns)}")
        
        cn_columns = [col for col in df.columns if col.endswith('-CN')]
        logger.info(f"📊 CN列: {cn_columns}")
        
        # 获取开放题字段
        open_ended_fields = []
        if 'question_types' in analysis_info:
            question_types = analysis_info['question_types']
            open_ended_list = question_types.get('open_ended', [])
            for q in open_ended_list:
                if isinstance(q, dict) and 'column' in q:
                    open_ended_fields.append(q['column'])
        
        logger.info(f"📊 开放题字段: {open_ended_fields}")
        
        # 构建开放题字段的编辑数据结构
        # 为每个开放题字段找到对应的相关列（原字段、CN翻译、二级标签、一级主题）
        open_questions = []
        
        for open_field in open_ended_fields:
            question_data = {
                'original_field': open_field,
                'cn_field': open_field + '-CN',
                'level1_theme_field': open_field + '一级主题',
                'level2_tag_field': open_field + '二级标签',
                'reference_tag_field': open_field + '标签',
                'available_columns': []
            }
            
            # 检查各列是否存在
            if open_field in df.columns:
                question_data['available_columns'].append(open_field)
            if question_data['cn_field'] in df.columns:
                question_data['available_columns'].append(question_data['cn_field'])
            if question_data['level1_theme_field'] in df.columns:
                question_data['available_columns'].append(question_data['level1_theme_field'])
            if question_data['level2_tag_field'] in df.columns:
                question_data['available_columns'].append(question_data['level2_tag_field'])
            if question_data['reference_tag_field'] in df.columns:
                question_data['available_columns'].append(question_data['reference_tag_field'])
            
            # 调试日志：输出每个问题的字段信息
            logger.info(f"📊 问题 '{open_field}' 的字段检查:")
            logger.info(f"   - 原字段: {open_field} -> {'存在' if open_field in df.columns else '不存在'}")
            logger.info(f"   - CN字段: {question_data['cn_field']} -> {'存在' if question_data['cn_field'] in df.columns else '不存在'}")
            logger.info(f"   - 一级主题字段: {question_data['level1_theme_field']} -> {'存在' if question_data['level1_theme_field'] in df.columns else '不存在'}")
            logger.info(f"   - 二级标签字段: {question_data['level2_tag_field']} -> {'存在' if question_data['level2_tag_field'] in df.columns else '不存在'}")
            logger.info(f"   - 参考标签字段: {question_data['reference_tag_field']} -> {'存在' if question_data['reference_tag_field'] in df.columns else '不存在'}")
            logger.info(f"   - available_columns: {question_data['available_columns']}")
            
            # 只有当至少有原字段时才添加
            if open_field in df.columns:
                open_questions.append(question_data)
        
        logger.info(f"📊 构建的开放题字段结构: {[q['original_field'] for q in open_questions]}")
        
        if not open_questions:
            logger.error(f"❌ 没有找到可编辑的开放题字段")
            return jsonify({'error': '没有找到可编辑的开放题字段'}), 400
        
        # 准备编辑数据
        edit_data = []
        for index, row in df.iterrows():
            row_data = {
                'id': index,
                'questions': {}
            }
            
            # 为每个开放题字段准备数据
            for question in open_questions:
                question_data = {
                    'original_text': str(row[question['original_field']]) if pd.notna(row[question['original_field']]) else '',
                    'cn_text': str(row[question['cn_field']]) if question['cn_field'] in df.columns and pd.notna(row[question['cn_field']]) else '',
                    'level1_themes': [],
                    'level2_tags': [],
                    'reference_tags': []
                }
                
                # 处理一级主题
                if question['level1_theme_field'] in df.columns:
                    theme_str = str(row[question['level1_theme_field']]) if pd.notna(row[question['level1_theme_field']]) else ''
                    if theme_str:
                        # 一级主题可能是逗号分隔，也可能是单个值
                        if ',' in theme_str:
                            question_data['level1_themes'] = [tag.strip() for tag in theme_str.split(',') if tag.strip()]
                        else:
                            question_data['level1_themes'] = [theme_str.strip()] if theme_str.strip() else []
                
                # 处理二级标签
                if question['level2_tag_field'] in df.columns:
                    tags_str = str(row[question['level2_tag_field']]) if pd.notna(row[question['level2_tag_field']]) else ''
                    if tags_str:
                        question_data['level2_tags'] = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
                
                # 处理参考标签
                if question['reference_tag_field'] in df.columns:
                    ref_tags_str = str(row[question['reference_tag_field']]) if pd.notna(row[question['reference_tag_field']]) else ''
                    if ref_tags_str:
                        question_data['reference_tags'] = [tag.strip() for tag in ref_tags_str.split(',') if tag.strip()]
                
                row_data['questions'][question['original_field']] = question_data
            
            edit_data.append(row_data)
        
        # 统计标签使用频率
        tag_statistics = {}
        for question in open_questions:
            question_stats = {}
            
            # 统计一级主题
            if question['level1_theme_field'] in df.columns:
                level1_tags = []
                for theme_str in df[question['level1_theme_field']].fillna('').astype(str):
                    if theme_str:
                        if ',' in theme_str:
                            level1_tags.extend([tag.strip() for tag in theme_str.split(',') if tag.strip()])
                        else:
                            if theme_str.strip():
                                level1_tags.append(theme_str.strip())
                
                from collections import Counter
                question_stats['level1_themes'] = dict(Counter(level1_tags))
            
            # 统计二级标签
            if question['level2_tag_field'] in df.columns:
                level2_tags = []
                for tags_str in df[question['level2_tag_field']].fillna('').astype(str):
                    if tags_str:
                        level2_tags.extend([tag.strip() for tag in tags_str.split(',') if tag.strip()])
                
                from collections import Counter
                question_stats['level2_tags'] = dict(Counter(level2_tags))
            
            # 统计参考标签
            if question['reference_tag_field'] in df.columns:
                reference_tags_list = []
                for ref_tags_str in df[question['reference_tag_field']].fillna('').astype(str):
                    if ref_tags_str:
                        reference_tags_list.extend([tag.strip() for tag in ref_tags_str.split(',') if tag.strip()])
                
                from collections import Counter
                question_stats['reference_tags'] = dict(Counter(reference_tags_list))
            
            tag_statistics[question['original_field']] = question_stats
        
        # 获取参考标签
        reference_tags = []
        if 'retag_result' in analysis_info:
            reference_tags = analysis_info['retag_result'].get('reference_tags', [])
        
        # 生成文件预览数据（类似标准AI打标结果格式）
        preview_data = []
        for col in df.columns:
            field_data = {
                'field': col,
                'values': df[col].fillna('').astype(str).tolist()
            }
            preview_data.append(field_data)

        result = {
            'data': edit_data,  # TagEditor格式的数据
            'processed_data': preview_data,  # 文件预览格式的数据
            'open_questions': open_questions,
            'reference_tags': reference_tags,
            'tag_statistics': tag_statistics,
            'total_rows': len(df),
            'file_info': {
                'filename': os.path.basename(input_file),
                'columns': df.columns.tolist(),
                'shape': df.shape
            }
        }
        
        logger.info(f"✅ 获取标签编辑数据成功，分析ID: {analysis_id}")
        logger.info(f"📊 返回数据包含: TagEditor数据({len(edit_data)}行), 预览数据({len(preview_data)}列), 开放题({len(open_questions)}个)")
        return jsonify(convert_pandas_types(result))
        
    except Exception as e:
        logger.error(f"❌ 获取标签编辑数据失败: {e}")
        return jsonify({'error': f'获取标签编辑数据失败: {str(e)}'}), 500

@app.route('/save-manual-tags/<analysis_id>', methods=['POST'])
def save_manual_tags(analysis_id):
    """保存手动修改的标签"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        data = request.get_json()
        modifications = data.get('modifications', [])
        
        if not modifications:
            return jsonify({'error': '没有提供修改数据'}), 400
        
        analysis_info = analysis_results[analysis_id]
        
        # 优先读取手动修改后的文件，其次读取打标文件，最后使用原始分析文件
        manual_output = analysis_info.get('manual_output')
        standard_labeling_output = analysis_info.get('standard_labeling_output')
        custom_labeling_output = analysis_info.get('custom_labeling_output')
        retag_output = analysis_info.get('retag_output')  # 向后兼容
        classification_output = analysis_info.get('classification_output')  # 向后兼容
        original_output = analysis_info.get('output_file') or analysis_info.get('processed_file')  # 兼容多种字段名
        
        if manual_output and os.path.exists(manual_output):
            current_file = manual_output
            logger.info(f"📁 手动修改基于已有手动修改文件: {current_file}")
        elif standard_labeling_output and os.path.exists(standard_labeling_output):
            current_file = standard_labeling_output
            logger.info(f"📁 手动修改基于标准AI打标文件: {current_file}")
        elif custom_labeling_output and os.path.exists(custom_labeling_output):
            current_file = custom_labeling_output
            logger.info(f"📁 手动修改基于配置参考标签打标文件: {current_file}")
        elif retag_output and os.path.exists(retag_output):
            current_file = retag_output
            logger.info(f"📁 手动修改基于重新打标的文件: {current_file}")
        elif classification_output and os.path.exists(classification_output):
            current_file = classification_output
            logger.info(f"📁 手动修改基于分析配置文件: {current_file}")
        elif original_output and os.path.exists(original_output):
            current_file = original_output
            logger.info(f"📁 手动修改基于原始分析文件: {current_file}")
        else:
            return jsonify({'error': '没有找到可用的分析结果文件'}), 404
        
        # 读取当前文件
        df = pd.read_excel(current_file)
        
        # 记录修改历史
        if 'manual_modifications' not in analysis_info:
            analysis_info['manual_modifications'] = []
        
        # 应用修改
        for mod in modifications:
            row_id = mod.get('row_id')
            question_field = mod.get('question_field')  # 原始开放题字段名
            tag_type = mod.get('tag_type')  # 'level1_themes' 或 'level2_tags'
            new_tags = mod.get('new_tags', [])
            
            if row_id < 0 or row_id >= len(df):
                continue
            
            # 根据标签类型确定目标列
            if tag_type == 'level1_themes':
                target_column = question_field + '一级主题'
            elif tag_type == 'level2_tags':
                target_column = question_field + '二级标签'
            elif tag_type == 'reference_tags':
                target_column = question_field + '标签'
            else:
                continue
                
            if target_column not in df.columns:
                continue
            
            # 记录原始值
            old_value = str(df.iloc[row_id][target_column]) if pd.notna(df.iloc[row_id][target_column]) else ''
            
            # 应用新值
            new_value = ','.join(new_tags) if new_tags else ''
            df.iloc[row_id, df.columns.get_loc(target_column)] = new_value
            
            # 记录修改历史
            analysis_info['manual_modifications'].append({
                'row_id': row_id,
                'question_field': question_field,
                'tag_type': tag_type,
                'target_column': target_column,
                'old_value': old_value,
                'new_value': new_value,
                'timestamp': datetime.now().isoformat()
            })
        
        # 确定手动修改文件的输出路径，确保只保留最新的编辑结果
        # 首先，删除之前的手动修改文件（如果存在）
        if 'manual_output' in analysis_info and analysis_info['manual_output']:
            old_manual_file = analysis_info['manual_output']
            if os.path.exists(old_manual_file):
                try:
                    os.remove(old_manual_file)
                    logger.info(f"🗑️ 删除之前的手动修改文件: {old_manual_file}")
                except Exception as e:
                    logger.warning(f"⚠️ 删除之前的手动修改文件失败: {e}")
        
        # 生成新的手动修改文件路径，根据不同的打标类型保存到不同目录
        if standard_labeling_output and os.path.exists(standard_labeling_output):
            base_name, original_timestamp = extract_file_info(standard_labeling_output)
            manual_output = TRANSLATE_AI_MANUAL_FOLDER / f"{base_name}_ai_manual_{original_timestamp}.xlsx"
            logger.info(f"📁 基于标准AI打标文件生成手动修改文件: {manual_output}")
        elif custom_labeling_output and os.path.exists(custom_labeling_output):
            base_name, original_timestamp = extract_file_info(custom_labeling_output)
            manual_output = TRANSLATE_CUSTOM_MANUAL_FOLDER / f"{base_name}_custom_manual_{original_timestamp}.xlsx"
            logger.info(f"📁 基于配置参考标签打标文件生成手动修改文件: {manual_output}")
        elif retag_output and os.path.exists(retag_output):
            base_name, original_timestamp = extract_file_info(retag_output)
            manual_output = RETAG_FOLDER / f"{base_name}_manual_{original_timestamp}.xlsx"
            logger.info(f"📁 基于重新打标文件生成手动修改文件: {manual_output}")
        elif classification_output and os.path.exists(classification_output):
            base_name, original_timestamp = extract_file_info(classification_output)
            manual_output = CLASSIFICATION_FOLDER / f"{base_name}_manual_{original_timestamp}.xlsx"
            logger.info(f"📁 基于分析配置文件生成手动修改文件: {manual_output}")
        else:
            base_name, original_timestamp = extract_file_info(original_output)
            manual_output = RETAG_FOLDER / f"{base_name}_manual_{original_timestamp}.xlsx"
            logger.info(f"📁 基于原始分析文件生成手动修改文件: {manual_output}")
        
        # 保存修改后的文件
        df.to_excel(str(manual_output), index=False)
        
        # 更新分析结果
        analysis_info['manual_output'] = str(manual_output)
        analysis_info['manual_modification_count'] = len(modifications)
        analysis_info['manual_modification_time'] = datetime.now().isoformat()
        
        logger.info(f"✅ 手动标签修改保存成功，分析ID: {analysis_id}")
        logger.info(f"📄 修改数量: {len(modifications)}")
        logger.info(f"💾 输出文件: {manual_output}")
        
        return jsonify({
            'message': '标签修改保存成功',
            'modifications_count': len(modifications),
            'output_file': str(manual_output)
        })
        
    except Exception as e:
        logger.error(f"❌ 保存手动标签修改失败: {e}")
        return jsonify({'error': f'保存手动标签修改失败: {str(e)}'}), 500

@app.route('/batch-tag-operations/<analysis_id>', methods=['POST'])
def batch_tag_operations(analysis_id):
    """批量标签操作"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        data = request.get_json()
        operation = data.get('operation')  # 'replace', 'add', 'remove'
        tag_column = data.get('tag_column')
        target_tag = data.get('target_tag')
        replacement_tag = data.get('replacement_tag')
        affected_rows = data.get('affected_rows', [])
        
        if not operation or not tag_column:
            return jsonify({'error': '缺少必要参数'}), 400
        
        analysis_info = analysis_results[analysis_id]
        
        # 优先读取手动修改后的文件，如果不存在则读取重新打标的文件
        manual_output = analysis_info.get('manual_output')
        retag_output = analysis_info.get('retag_output')
        
        if manual_output and os.path.exists(manual_output):
            current_file = manual_output
            logger.info(f"📁 批量操作基于手动修改后的文件: {current_file}")
        elif retag_output and os.path.exists(retag_output):
            current_file = retag_output
            logger.info(f"📁 批量操作基于重新打标的文件: {current_file}")
        else:
            return jsonify({'error': '重新打标结果文件不存在'}), 404
        
        # 读取当前文件
        df = pd.read_excel(current_file)
        
        if tag_column not in df.columns:
            return jsonify({'error': f'标签列 {tag_column} 不存在'}), 400
        
        # 记录修改历史
        if 'manual_modifications' not in analysis_info:
            analysis_info['manual_modifications'] = []
        
        modification_count = 0
        
        # 执行批量操作
        for row_id in affected_rows:
            if row_id < 0 or row_id >= len(df):
                continue
            
            # 获取当前标签
            current_tags_str = str(df.iloc[row_id][tag_column]) if pd.notna(df.iloc[row_id][tag_column]) else ''
            current_tags = [tag.strip() for tag in current_tags_str.split(',') if tag.strip()]
            
            # 记录原始值
            old_value = current_tags_str
            new_tags = current_tags.copy()
            
            # 根据操作类型处理
            if operation == 'replace' and target_tag and replacement_tag:
                new_tags = [replacement_tag if tag == target_tag else tag for tag in new_tags]
                
            elif operation == 'add' and replacement_tag:
                if replacement_tag not in new_tags:
                    new_tags.append(replacement_tag)
                    
            elif operation == 'remove' and target_tag:
                new_tags = [tag for tag in new_tags if tag != target_tag]
            
            # 应用修改
            new_value = ','.join(new_tags) if new_tags else ''
            if new_value != old_value:
                df.iloc[row_id, df.columns.get_loc(tag_column)] = new_value
                modification_count += 1
                
                # 记录修改历史
                analysis_info['manual_modifications'].append({
                    'row_id': row_id,
                    'tag_column': tag_column,
                    'old_value': old_value,
                    'new_value': new_value,
                    'operation': operation,
                    'timestamp': datetime.now().isoformat()
                })
        
        # 生成或使用现有的输出文件路径
        if 'manual_output' in analysis_info and os.path.exists(analysis_info['manual_output']):
            # 如果已有手动修改文件，直接在其基础上修改
            manual_output = analysis_info['manual_output']
            logger.info(f"📁 在现有手动修改文件基础上保存: {manual_output}")
        else:
            # 生成新的手动修改文件
            base_name, original_timestamp = extract_file_info(retag_output)
            manual_output = RETAG_FOLDER / f"{base_name}_manual_{original_timestamp}.xlsx"
            logger.info(f"📁 生成新的手动修改文件: {manual_output}")
        
        # 保存修改后的文件
        df.to_excel(str(manual_output), index=False)
        
        # 更新分析结果
        analysis_info['manual_output'] = str(manual_output)
        analysis_info['manual_modification_time'] = datetime.now().isoformat()
        
        logger.info(f"✅ 批量标签操作完成，分析ID: {analysis_id}")
        logger.info(f"📄 操作: {operation}, 影响行数: {modification_count}")
        
        return jsonify({
            'message': f'批量{operation}操作完成',
            'affected_count': modification_count,
            'output_file': str(manual_output)
        })
        
    except Exception as e:
        logger.error(f"❌ 批量标签操作失败: {e}")
        return jsonify({'error': f'批量标签操作失败: {str(e)}'}), 500

@app.route('/download-standard-labeling/<analysis_id>', methods=['GET'])
def download_standard_labeling(analysis_id):
    """下载标准AI打标处理后的文件 (_standard_ 文件)"""
    try:
        logger.info(f"🔍 收到标准AI打标下载请求，analysis_id: {analysis_id}")
        
        if analysis_id not in analysis_results:
            logger.error(f"❌ 分析ID不存在: {analysis_id}")
            logger.info(f"💡 当前可用的analysis_ids: {list(analysis_results.keys())}")
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        logger.info(f"📁 analysis_info中的所有键: {list(analysis_info.keys())}")
        
        standard_output = analysis_info.get('standard_labeling_output')
        logger.info(f"📄 标准打标输出文件路径: {standard_output}")
        
        if not standard_output:
            logger.error(f"❌ standard_labeling_output字段为空")
            return jsonify({'error': '标准AI打标结果文件路径不存在'}), 404
            
        if not os.path.exists(standard_output):
            logger.error(f"❌ 文件不存在: {standard_output}")
            # 列出目录内容以便调试
            dir_path = os.path.dirname(standard_output)
            if os.path.exists(dir_path):
                files = os.listdir(dir_path)
                logger.info(f"💡 目录 {dir_path} 中的文件: {files}")
            return jsonify({'error': '标准AI打标结果文件不存在'}), 404
        
        # 使用实际文件名而不是硬编码的名称
        actual_filename = Path(standard_output).name
        logger.info(f"📥 准备下载标准AI打标文件: {actual_filename}")
        
        return send_file(
            standard_output,
            as_attachment=True,
            download_name=actual_filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"❌ 下载标准AI打标结果失败: {e}")
        import traceback
        logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
        return jsonify({'error': f'下载标准AI打标结果失败: {str(e)}'}), 500

@app.route('/download-ai-manual-result/<analysis_id>', methods=['GET'])
def download_ai_manual_result(analysis_id):
    """下载标准AI打标手动编辑后的文件 (_ai_manual_ 文件)"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        # 查找AI打标手动编辑后的文件
        ai_manual_output = analysis_info.get('manual_ai_output')
        
        if not ai_manual_output or not os.path.exists(ai_manual_output):
            return jsonify({'error': '标准AI打标手动编辑结果文件不存在'}), 404
        
        actual_filename = Path(ai_manual_output).name
        logger.info(f"📥 下载AI手动编辑文件: {actual_filename}")
        
        return send_file(
            ai_manual_output,
            as_attachment=True,
            download_name=actual_filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"❌ 下载AI手动编辑结果失败: {e}")
        return jsonify({'error': f'下载AI手动编辑结果失败: {str(e)}'}), 500

@app.route('/download-custom-labeling/<analysis_id>', methods=['GET'])
def download_custom_labeling(analysis_id):
    """下载参考标签打标处理后的文件 (_translate_custom_ 文件)"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        custom_output = analysis_info.get('custom_labeling_output')
        
        if not custom_output or not os.path.exists(custom_output):
            return jsonify({'error': '参考标签打标结果文件不存在'}), 404
        
        actual_filename = Path(custom_output).name
        logger.info(f"📥 下载参考标签打标文件: {actual_filename}")
        
        return send_file(
            custom_output,
            as_attachment=True,
            download_name=actual_filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"❌ 下载参考标签打标结果失败: {e}")
        return jsonify({'error': f'下载参考标签打标结果失败: {str(e)}'}), 500

@app.route('/download-custom-manual-result/<analysis_id>', methods=['GET'])
def download_custom_manual_result(analysis_id):
    """下载参考标签打标手动编辑后的文件 (_custom_manual_ 文件)"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        # 查找参考标签手动编辑后的文件
        custom_manual_output = analysis_info.get('manual_custom_output')
        
        if not custom_manual_output or not os.path.exists(custom_manual_output):
            return jsonify({'error': '参考标签手动编辑结果文件不存在'}), 404
        
        actual_filename = Path(custom_manual_output).name
        logger.info(f"📥 下载参考标签手动编辑文件: {actual_filename}")
        
        return send_file(
            custom_manual_output,
            as_attachment=True,
            download_name=actual_filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"❌ 下载参考标签手动编辑结果失败: {e}")
        return jsonify({'error': f'下载参考标签手动编辑结果失败: {str(e)}'}), 500

# @app.route('/download-retag/<analysis_id>', methods=['GET'])
# def download_retag(analysis_id):
#     """下载重新打标处理后的文件"""
#     try:
#         if analysis_id not in analysis_results:
#             return jsonify({'error': '分析ID不存在'}), 404
        
#         analysis_info = analysis_results[analysis_id]
#         # 优先使用新的参考标签打标输出文件
#         retag_output = analysis_info.get('custom_labeling_output')
#         if not retag_output or not os.path.exists(retag_output):
#             # 向后兼容：尝试使用旧的字段名
#             retag_output = analysis_info.get('retag_output')
#             if not retag_output or not os.path.exists(retag_output):
#                 return jsonify({'error': '重新打标结果文件不存在'}), 404
        
#         # 使用实际文件名而不是硬编码的名称
#         actual_filename = Path(retag_output).name
        
#         return send_file(
#             retag_output,
#             as_attachment=True,
#             download_name=actual_filename,
#             mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
#         )
        
#     except Exception as e:
#         logger.error(f"❌ 下载重新打标结果失败: {e}")
#         return jsonify({'error': f'下载重新打标结果失败: {str(e)}'}), 500

# @app.route('/download-final-result/<analysis_id>', methods=['GET'])
# def download_final_result(analysis_id):
#     """下载最终结果文件（手动修改后的文件）"""
#     try:
#         if analysis_id not in analysis_results:
#             return jsonify({'error': '分析ID不存在'}), 404
        
#         analysis_info = analysis_results[analysis_id]
        
#         # 优先使用手动修改后的文件
#         final_output = analysis_info.get('manual_output')
#         if final_output and os.path.exists(final_output):
#             actual_filename = Path(final_output).name
#             logger.info(f"📥 下载手动修改后的文件: {actual_filename}")
#         else:
#             # 如果没有手动修改，使用重新打标的文件
#             final_output = analysis_info.get('retag_output')
#             if final_output and os.path.exists(final_output):
#                 actual_filename = Path(final_output).name
#                 logger.info(f"📥 下载重新打标的文件: {actual_filename}")
#             else:
#                 return jsonify({'error': '最终结果文件不存在'}), 404
        
#         return send_file(
#             final_output,
#             as_attachment=True,
#             download_name=actual_filename,
#             mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
#         )
        
#     except Exception as e:
#         logger.error(f"❌ 下载最终结果失败: {e}")
#         return jsonify({'error': f'下载最终结果失败: {str(e)}'}), 500

@app.route('/get-modification-history/<analysis_id>', methods=['GET'])
def get_modification_history(analysis_id):
    """获取修改历史记录"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        modifications = analysis_info.get('manual_modifications', [])
        
        # 按时间倒序排列
        modifications.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        result = {
            'total_modifications': len(modifications),
            'modifications': modifications,
            'has_manual_changes': 'manual_output' in analysis_info
        }
        
        logger.info(f"✅ 获取修改历史成功，分析ID: {analysis_id}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"❌ 获取修改历史失败: {e}")
        return jsonify({'error': f'获取修改历史失败: {str(e)}'}), 500

@app.route('/test/analysis-history', methods=['GET'])
def get_analysis_history():
    """获取分析历史"""
    try:
        history = []
        for analysis_id, info in analysis_results.items():
            history.append({
                'analysisId': analysis_id,
                'filename': info.get('filename', 'Unknown'),
                'uploadTime': info.get('upload_time', ''),
                'hasResult': 'analysis_result' in info
            })
        
        return jsonify(history)
        
    except Exception as e:
        logger.error(f"❌ 获取分析历史失败: {e}")
        return jsonify({'error': f'获取分析历史失败: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'questionnaire-analysis-api'
    })

# 数据库相关API接口
@app.route('/test-database-connection', methods=['GET'])
def test_db_connection():
    """测试数据库连接接口"""
    try:
        success, message = test_database_connection()
        
        if success:
            return jsonify({
                'success': True,
                'message': message,
                'database': 'mkt',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'success': False,
                'error': message,
                'timestamp': datetime.now().isoformat()
            }), 500
            
    except Exception as e:
        logger.error(f"❌ 数据库连接测试异常: {e}")
        return jsonify({
            'success': False,
            'error': f'测试异常: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/import-to-database/<analysis_id>', methods=['POST'])
def import_to_database(analysis_id):
    """将问卷数据导入到数据库"""
    try:
        logger.info(f"🚀 开始导入数据到数据库，分析ID: {analysis_id}")
        
        # 检查分析ID是否存在
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        
        # 获取手动修改后的文件路径
        manual_output = analysis_info.get('manual_output')
        retag_output = analysis_info.get('retag_output')
        
        # 确定要读取的文件
        file_path = None
        if manual_output and os.path.exists(manual_output):
            file_path = manual_output
            logger.info(f"📁 使用手动修改后的文件: {file_path}")
        elif retag_output and os.path.exists(retag_output):
            file_path = retag_output
            logger.info(f"📁 使用重新打标的文件: {file_path}")
        else:
            return jsonify({'error': '未找到可导入的数据文件'}), 404
        
        # 读取Excel文件
        try:
            df = pd.read_excel(file_path)
            logger.info(f"📊 成功读取文件，共 {len(df)} 行，{len(df.columns)} 列")
        except Exception as e:
            return jsonify({'error': f'读取文件失败: {str(e)}'}), 500
        
        # 解析列结构
        column_info = parse_column_structure(df)
        
        # 提取问卷元数据
        filename = os.path.basename(file_path)
        survey_name = extract_survey_name_from_filename(filename)
        
        # 可选：从请求中获取问卷主题
        data = request.get_json() or {}
        survey_topic = data.get('survey_topic', '')
        
        # 转换数据为记录格式
        records = transform_data_to_records(df, column_info, analysis_id, survey_name, survey_topic)
        
        # 验证数据
        validation = validate_records(records)
        if not validation['valid']:
            return jsonify({
                'error': '数据验证失败',
                'details': validation['errors'],
                'warnings': validation['warnings']
            }), 400
        
        # 连接数据库
        connection, error = get_database_connection()
        if error:
            return jsonify({'error': error}), 500
        
        try:
            cursor = connection.cursor()
            
            # 检查是否已存在相同analysis_id的数据
            check_sql = "SELECT COUNT(*) FROM questionnaire_final_results WHERE analysis_id = %s"
            cursor.execute(check_sql, (analysis_id,))
            existing_count = cursor.fetchone()[0]
            
            if existing_count > 0:
                # 删除已存在的数据
                delete_sql = "DELETE FROM questionnaire_final_results WHERE analysis_id = %s"
                cursor.execute(delete_sql, (analysis_id,))
                logger.info(f"🗑️ 删除了 {existing_count} 条已存在的记录")
            
            # 批量插入新数据
            insert_sql = """
            INSERT INTO questionnaire_final_results (
                analysis_id, respondent_id, survey_name, survey_topic, question_code,
                question, question_type, respondent_row, user_answer, translation,
                labels, primary_category, secondary_category
            ) VALUES (
                %(analysis_id)s, %(respondent_id)s, %(survey_name)s, %(survey_topic)s, %(question_code)s,
                %(question)s, %(question_type)s, %(respondent_row)s, %(user_answer)s, %(translation)s,
                %(labels)s, %(primary_category)s, %(secondary_category)s
            )
            """
            
            cursor.executemany(insert_sql, records)
            connection.commit()
            
            inserted_count = cursor.rowcount
            logger.info(f"✅ 成功插入 {inserted_count} 条记录")
            
            # 更新分析结果中的数据库导入状态
            analysis_info['database_imported'] = True
            analysis_info['database_import_time'] = datetime.now().isoformat()
            analysis_info['database_record_count'] = inserted_count
            
            cursor.close()
            
            return jsonify({
                'success': True,
                'message': f'成功导入 {inserted_count} 条记录到数据库',
                'statistics': validation['statistics'],
                'analysis_id': analysis_id,
                'database': 'mkt',
                'table': 'questionnaire_final_results'
            })
            
        except Exception as e:
            connection.rollback()
            error_msg = f"数据库操作失败: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return jsonify({'error': error_msg}), 500
        finally:
            connection.close()
            
    except Exception as e:
        logger.error(f"❌ 导入过程中发生异常: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'导入异常: {str(e)}'}), 500

@app.route('/database-status/<analysis_id>', methods=['GET'])
def get_database_status(analysis_id):
    """获取数据库导入状态"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        
        # 检查数据库中是否有该分析ID的数据
        connection, error = get_database_connection()
        if error:
            return jsonify({'error': error}), 500
        
        try:
            cursor = connection.cursor()
            cursor.execute("SELECT COUNT(*) FROM questionnaire_final_results WHERE analysis_id = %s", (analysis_id,))
            db_record_count = cursor.fetchone()[0]
            cursor.close()
            
            return jsonify({
                'analysis_id': analysis_id,
                'database_imported': analysis_info.get('database_imported', False),
                'database_import_time': analysis_info.get('database_import_time', ''),
                'database_record_count': db_record_count,
                'local_record_count': analysis_info.get('database_record_count', 0)
            })
            
        finally:
            connection.close()
            
    except Exception as e:
        logger.error(f"❌ 获取数据库状态失败: {e}")
        return jsonify({'error': f'获取状态失败: {str(e)}'}), 500

@app.route('/save-ai-manual-tags/<analysis_id>', methods=['POST'])
def save_ai_manual_tags(analysis_id):
    """保存AI打标手动修改的标签"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        data = request.get_json()
        modifications = data.get('modifications', [])
        
        if not modifications:
            return jsonify({'error': '没有提供修改数据'}), 400
        
        analysis_info = analysis_results[analysis_id]
        
        # 专门处理AI打标文件
        standard_labeling_output = analysis_info.get('standard_labeling_output')
        manual_ai_output = analysis_info.get('manual_ai_output')
        
        # 删除之前的AI手动编辑文件（如果存在）
        if manual_ai_output and os.path.exists(manual_ai_output):
            try:
                os.remove(manual_ai_output)
                logger.info(f"🗑️ 删除之前的AI手动编辑文件: {manual_ai_output}")
            except Exception as e:
                logger.warning(f"⚠️ 删除之前的AI手动编辑文件失败: {e}")
        
        # 确定当前读取文件
        if manual_ai_output and os.path.exists(manual_ai_output):
            current_file = manual_ai_output
            logger.info(f"📁 AI打标手动修改基于已有手动修改文件: {current_file}")
        elif standard_labeling_output and os.path.exists(standard_labeling_output):
            current_file = standard_labeling_output
            logger.info(f"📁 AI打标手动修改基于标准AI打标文件: {current_file}")
        else:
            return jsonify({'error': '没有找到AI打标结果文件'}), 404
        
        # 生成保存路径到translate_ai_manual目录，使用原始时间戳保持一致性
        base_name, original_timestamp = extract_file_info(current_file)
        output_file = TRANSLATE_AI_MANUAL_FOLDER / f"{base_name}_ai_manual_{original_timestamp}.xlsx"
        
        return _save_manual_tags_common(analysis_id, current_file, str(output_file), modifications, 'manual_ai_output', "AI打标手动修改")
        
    except Exception as e:
        logger.error(f"❌ 保存AI打标手动修改失败: {e}")
        return jsonify({'error': f'保存AI打标手动修改失败: {str(e)}'}), 500

@app.route('/save-custom-manual-tags/<analysis_id>', methods=['POST'])
def save_custom_manual_tags(analysis_id):
    """保存参考标签打标手动修改的标签"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        data = request.get_json()
        modifications = data.get('modifications', [])
        
        if not modifications:
            return jsonify({'error': '没有提供修改数据'}), 400
        
        analysis_info = analysis_results[analysis_id]
        
        # 专门处理参考标签打标文件
        custom_labeling_output = analysis_info.get('custom_labeling_output')
        manual_custom_output = analysis_info.get('manual_custom_output')
        
        # 删除之前的参考标签手动编辑文件（如果存在）
        if manual_custom_output and os.path.exists(manual_custom_output):
            try:
                os.remove(manual_custom_output)
                logger.info(f"🗑️ 删除之前的参考标签手动编辑文件: {manual_custom_output}")
            except Exception as e:
                logger.warning(f"⚠️ 删除之前的参考标签手动编辑文件失败: {e}")
        
        # 确定当前读取文件
        if manual_custom_output and os.path.exists(manual_custom_output):
            current_file = manual_custom_output
            logger.info(f"📁 参考标签手动修改基于已有手动修改文件: {current_file}")
        elif custom_labeling_output and os.path.exists(custom_labeling_output):
            current_file = custom_labeling_output
            logger.info(f"📁 参考标签手动修改基于参考标签打标文件: {current_file}")
        else:
            # 尝试搜索备用文件
            try:
                custom_files = list(TRANSLATE_CUSTOM_FOLDER.glob(f"*{analysis_id.split('-')[0]}*_translate_custom_*.xlsx"))
                if custom_files:
                    current_file = str(max(custom_files, key=os.path.getmtime))
                    logger.info(f"🔧 找到备用参考标签文件: {current_file}")
                else:
                    return jsonify({'error': '没有找到参考标签打标结果文件'}), 404
            except Exception:
                return jsonify({'error': '没有找到参考标签打标结果文件'}), 404
        
        # 生成保存路径到translate_custom_manual目录，使用原始时间戳保持一致性
        base_name, original_timestamp = extract_file_info(current_file)
        output_file = TRANSLATE_CUSTOM_MANUAL_FOLDER / f"{base_name}_custom_manual_{original_timestamp}.xlsx"
        
        return _save_manual_tags_common(analysis_id, current_file, str(output_file), modifications, 'manual_custom_output', "参考标签手动修改")
        
    except Exception as e:
        logger.error(f"❌ 保存参考标签手动修改失败: {e}")
        return jsonify({'error': f'保存参考标签手动修改失败: {str(e)}'}), 500

def _save_manual_tags_common(analysis_id, current_file, output_file, modifications, output_key, save_type):
    """保存手动标签的通用函数"""
    try:
        # 读取当前文件
        df = pd.read_excel(current_file)
        logger.info(f"📊 读取{save_type}文件成功，共 {len(df)} 行，{len(df.columns)} 列")
        
        # 应用修改
        for mod in modifications:
            row_id = mod.get('rowId')
            field_name = mod.get('fieldName')
            tag_type = mod.get('tagType')  # 'level1_themes', 'level2_tags', 'reference_tags'
            new_values = mod.get('newValues', [])
            
            logger.info(f"🔧 应用{save_type}修改: 行{row_id}, 字段{field_name}, 类型{tag_type}, 新值{new_values}")
            
            # 根据tag_type确定要修改的列
            if tag_type == 'level1_themes':
                target_col = f"{field_name}一级主题"
            elif tag_type == 'level2_tags':
                target_col = f"{field_name}二级标签"
            elif tag_type == 'reference_tags':
                target_col = f"{field_name}标签"
            else:
                logger.warning(f"⚠️ 未知的标签类型: {tag_type}")
                continue
            
            if target_col in df.columns and row_id < len(df):
                # 将新值列表转换为逗号分隔的字符串
                new_value_str = ','.join(new_values) if new_values else ''
                df.at[row_id, target_col] = new_value_str
                logger.info(f"✅ 更新 {target_col}[{row_id}] = '{new_value_str}'")
            else:
                if target_col not in df.columns:
                    logger.warning(f"⚠️ 列 {target_col} 不存在于DataFrame中")
                if row_id >= len(df):
                    logger.warning(f"⚠️ 行索引 {row_id} 超出DataFrame范围")
        
        # 保存修改后的文件
        df.to_excel(output_file, index=False)
        logger.info(f"💾 {save_type}文件已保存: {output_file}")
        
        # 更新analysis_results
        analysis_results[analysis_id][output_key] = output_file
        
        # 生成文件预览数据
        preview_data = []
        for col in df.columns:
            field_data = {
                'field': col,
                'values': df[col].fillna('').astype(str).tolist()
            }
            preview_data.append(field_data)
        
        result = {
            'success': True,
            'message': f'{save_type}保存成功',
            'output_file': output_file,
            'save_type': save_type,
            'total_rows': len(df),
            'processed_data': preview_data
        }
        
        logger.info(f"✅ {save_type}保存成功，分析ID: {analysis_id}")
        return jsonify(convert_pandas_types(result))
        
    except Exception as e:
        logger.error(f"❌ {save_type}保存失败: {e}")
        import traceback
        logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
        return jsonify({'error': f'{save_type}保存失败: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info("🚀 问卷分析Flask服务启动")
    logger.info(f"📁 上传文件夹: {UPLOAD_FOLDER}")
    logger.info("🌐 服务地址: http://localhost:9001")
    
    # 启动Flask应用
    app.run(
        host='0.0.0.0',
        port=9001,
        debug=False  # 关闭debug模式避免watchdog问题
    ) 