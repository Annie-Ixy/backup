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
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pandas as pd
import numpy as np
import traceback

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

# 配置上传文件夹
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
UPLOAD_FOLDER.mkdir(exist_ok=True)

# 配置允许的文件类型
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'txt'}

# 存储分析结果的临时数据结构
analysis_results = {}

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
        
        # 安全地保存文件，保留中文字符
        filename = secure_chinese_filename(file.filename or 'unknown_file')
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        file_path = UPLOAD_FOLDER / unique_filename
        
        file.save(str(file_path))
        logger.info(f"✅ 文件保存成功: {file_path}")
        
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
                'filename': filename,
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
                'filename': filename,
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

# 处理Classification分析 开始分析
@app.route('/classification', methods=['POST'])
def handle_classification():
    """处理Classification分析"""
    try:
        logger.info("🔍 收到Classification处理请求")
        
        data = request.get_json()
        analysis_id = data.get('analysisId')
        selected_fields = data.get('selectedFields', [])
        
        if not analysis_id or analysis_id not in analysis_results:
            return jsonify({'error': '无效的分析ID'}), 400
        
        # 注意：选择字段检查被注释掉是为了允许处理所有字段
        # if not selected_fields:
        #     return jsonify({'error': '请选择要分析的字段'}), 400
        
        analysis_info = analysis_results[analysis_id]
        input_file = analysis_info['file_path']
        
        logger.info(f"📊 开始Classification处理，文件: {input_file}")
        
        try:
            # 导入classification模块
            try:
                from classification import QuestionnaireTranslationClassifier
                logger.info("✅ 成功导入 QuestionnaireTranslationClassifier")
            except ImportError as e:
                logger.error(f"❌ 导入 QuestionnaireTranslationClassifier 失败: {e}")
                return jsonify({'error': f'导入 classification 模块失败: {str(e)}'}), 500
            
            classifier = QuestionnaireTranslationClassifier()
            
            # 生成输出文件路径
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = Path(input_file).parent / f"classification_{timestamp}.xlsx"
            
            # 执行classification处理
            logger.info(f"🔧 开始执行classification处理: {input_file} -> {output_file}")
            logger.info(f"📋 输入文件存在: {Path(input_file).exists()}")
            logger.info(f"📋 输入文件大小: {Path(input_file).stat().st_size if Path(input_file).exists() else 'N/A'} bytes")
            
            try:
                logger.info("🚀 即将调用 classifier.process_table 方法")
                success = classifier.process_table(input_file, str(output_file))
                logger.info(f"🔧 classifier.process_table 返回结果: {success}")
                logger.info(f"📋 输出文件存在: {Path(output_file).exists()}")
                if Path(output_file).exists():
                    logger.info(f"📋 输出文件大小: {Path(output_file).stat().st_size} bytes")
                
                if not success:
                    logger.error("❌ classifier.process_table 返回 False")
                    return jsonify({'error': 'Classification处理失败 - process_table返回False'}), 500
                    
            except Exception as process_error:
                logger.error(f"❌ classifier.process_table 执行时发生异常: {process_error}")
                logger.error(f"❌ 异常类型: {type(process_error)}")
                import traceback
                logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
                return jsonify({'error': f'Classification处理异常: {str(process_error)}'}), 500
            
            logger.info(f"✅ Classification处理完成: {output_file}")
            
            # 读取处理后的文件
            processed_df = pd.read_excel(str(output_file))
            
            # 筛选选中的字段（如果存在）
            available_fields = [col for col in processed_df.columns if col in selected_fields or col in [col.replace('_翻译', '') for col in selected_fields]]
            if not available_fields:
                # 如果没有找到匹配的字段，使用所有字段
                available_fields = processed_df.columns.tolist()
            
            # 生成处理结果
            result = {
                'summary': {
                    'total_responses': len(processed_df),
                    'processed_fields': len(available_fields),
                    'processing_time': datetime.now().isoformat(),
                    'output_file': str(output_file)
                },
                'processed_data': {},
                'field_analysis': {},
                'sample_size': min(10, len(processed_df))
            }
            
            # 准备处理后的数据（前10行）- 转换为数组格式
            result['processed_data'] = []
            
            # 读取处理后的文件并识别题型
            try:
                from universal_questionnaire_analyzer import UniversalQuestionnaireAnalyzer
                logger.info("✅ 成功导入 UniversalQuestionnaireAnalyzer")
            except ImportError as e:
                logger.error(f"❌ 导入 UniversalQuestionnaireAnalyzer 失败: {e}")
                return jsonify({'error': f'导入分析模块失败: {str(e)}'}), 500
            
            analyzer = UniversalQuestionnaireAnalyzer()
            question_types = analyzer.identify_all_question_types(processed_df)
            
            # 打印题型识别结果
            logger.info("题型识别结果:")
            logger.info(f"单选题: {question_types.get('single_choice', [])}")
            logger.info(f"量表题: {question_types.get('scale_questions', [])}")
            logger.info(f"开放题: {question_types.get('open_ended', [])}")
            
            # 创建字段到类型的映射
            field_type_map = {}
            
            # 1. 处理单选题 (type: 0)
            for q in question_types.get('single_choice', []):
                if isinstance(q, dict) and 'column' in q:
                    field_type_map[q['column']] = 0
            
            # 2. 处理量表题 (type: 1)
            for q in question_types.get('scale_questions', []):
                if isinstance(q, dict) and 'column' in q:
                    field_type_map[q['column']] = 1
            
            # 3. 处理开放题 (type: 2)
            for q in question_types.get('open_ended', []):
                if isinstance(q, dict) and 'column' in q:
                    field_type_map[q['column']] = 2
            
            # 新逻辑中无其他题型，所有字段都已被分类


            
            for col in available_fields:
                if col in processed_df.columns:
                    result['processed_data'].append({
                        'field': col,
                        'values': processed_df[col].head(10).fillna('').astype(str).tolist(),
                        'type': field_type_map.get(col)  # 如果字段没有被分类，将返回 None
                    })
            
            # 为每个字段生成详细分析
            for field in available_fields:
                if field in processed_df.columns:
                    field_data = processed_df[field]
                    field_data_clean = field_data.dropna()
                    
                    if len(field_data_clean) > 0:
                        # 获取样本数据
                        sample_data = field_data_clean.head(10).tolist()
                        
                        # 获取唯一值数量
                        unique_count = len(field_data_clean.unique())
                        
                        # 如果是翻译字段，尝试提取主要主题
                        main_topics = []
                        if '_翻译' in field or '_标签' in field:
                            # 从数据中提取前5个最常见的值作为主题
                            value_counts = field_data_clean.value_counts().head(5)
                            main_topics = value_counts.index.tolist()
                        
                        result['field_analysis'][field] = {
                            'response_count': len(field_data_clean),
                            'unique_values': unique_count,
                            'sample_data': sample_data,
                            'main_topics': main_topics
                        }
            
            # 存储处理结果
            analysis_results[analysis_id]['classification_result'] = result
            analysis_results[analysis_id]['classification_output'] = str(output_file)
            
            logger.info(f"✅ Classification处理完成，分析ID: {analysis_id}")
            return jsonify(convert_pandas_types(result))
            
        except Exception as e:
            logger.error(f"❌ Classification处理失败: {e}")
            logger.error(f"❌ 异常类型: {type(e)}")
            import traceback
            logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
            return jsonify({'error': f'Classification处理失败: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"❌ Classification请求处理失败: {e}")
        logger.error(f"❌ 异常类型: {type(e)}")
        import traceback
        logger.error(f"❌ 异常堆栈: {traceback.format_exc()}")
        return jsonify({'error': f'Classification请求处理失败: {str(e)}'}), 500

@app.route('/test/analysis-results/<analysis_id>', methods=['GET'])
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

@app.route('/test/export/<analysis_id>', methods=['GET'])
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

@app.route('/download-classification/<analysis_id>', methods=['GET'])
def download_classification(analysis_id):
    """下载Classification处理后的文件"""
    try:
        if analysis_id not in analysis_results:
            return jsonify({'error': '分析ID不存在'}), 404
        
        analysis_info = analysis_results[analysis_id]
        classification_output = analysis_info.get('classification_output')
        
        if not classification_output or not os.path.exists(classification_output):
            return jsonify({'error': 'Classification处理结果文件不存在'}), 404
        
        return send_file(
            classification_output,
            as_attachment=True,
            download_name=f"classification_result_{analysis_id}.xlsx",
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"❌ 下载Classification结果失败: {e}")
        return jsonify({'error': f'下载Classification结果失败: {str(e)}'}), 500

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