# -*- coding: utf-8 -*-
"""
社媒AI分析工具 - Flask主应用
Dash Social数据上传与分析系统
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 添加项目路径到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database_config import get_db_config
from services.simple_file_processor import SimpleFileProcessor
from services.new_dash_analyzer import NewDashAnalyzer
from controllers.upload_controller import UploadController
from controllers.analysis_controller import AnalysisController
from controllers.etl_controller import ETLController
from controllers.ai_controller import AIController

# 创建Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'social-media-analysis-2024'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB最大文件大小

# 启用CORS支持
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 配置上传目录
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 初始化服务
db_config = get_db_config()
file_processor = SimpleFileProcessor()  # 使用简化的文件处理器
dash_analyzer = NewDashAnalyzer()  # 使用新的基于DWD_AI的分析器
upload_controller = UploadController()
analysis_controller = AnalysisController()
etl_controller = ETLController()
ai_controller = AIController()

@app.route('/')
def index():
    """首页路由"""
    return jsonify({
        'message': '社媒AI分析工具API',
        'version': '1.0.0',
        'status': 'running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/health')
def health_check():
    """健康检查接口"""
    try:
        # 测试数据库连接
        db_status = db_config.test_connection()
        
        return jsonify({
            'status': 'healthy',
            'database': 'connected' if db_status else 'disconnected',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """文件上传接口"""
    try:
        logger.info("API路由接收到上传请求")
        result = upload_controller.handle_upload(request)
        logger.info(f"控制器处理完成，返回结果类型: {type(result)}")
        return result
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error("=" * 60)
        logger.error("Flask API路由异常:")
        logger.error(f"异常类型: {type(e).__name__}")
        logger.error(f"异常消息: {str(e)}")
        logger.error("完整异常堆栈:")
        logger.error(error_traceback)
        logger.error("=" * 60)
        
        return jsonify({
            'success': False,
            'error': '文件上传失败',
            'message': str(e),
            'error_type': type(e).__name__
        }), 500

@app.route('/api/uploads/history')
def upload_history():
    """获取上传历史记录"""
    try:
        # 获取查询参数
        limit = request.args.get('limit', 50, type=int)
        return upload_controller.get_upload_history(limit)
    except Exception as e:
        logger.error(f"获取上传历史失败: {e}")
        return jsonify({
            'error': '获取上传历史失败',
            'message': str(e)
        }), 500

@app.route('/api/upload/stats', methods=['GET'])
def upload_stats():
    """获取上传统计API"""
    try:
        result = upload_controller.get_upload_stats()
        return result
    except Exception as e:
        logger.error(f"获取上传统计失败：{e}")
        return jsonify({'success': False, 'error': f'获取统计失败：{str(e)}'}), 500

@app.route('/api/upload/status/<batch_id>', methods=['GET'])
def get_upload_processing_status(batch_id):
    """获取指定批次的处理状态API"""
    try:
        result = upload_controller.get_processing_status(batch_id)
        return result
    except Exception as e:
        logger.error(f"获取处理状态失败：{e}")
        return jsonify({'success': False, 'error': f'状态查询失败：{str(e)}'}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    """数据分析接口（旧路径，保持兼容）"""
    try:
        return analysis_controller.handle_analysis(request)
    except Exception as e:
        logger.error(f"数据分析失败: {e}")
        return jsonify({
            'error': '数据分析失败',
            'message': str(e)
        }), 500

@app.route('/api/analysis', methods=['POST'])
def analyze_data_new():
    """数据分析接口（新路径）"""
    try:
        return analysis_controller.handle_analysis(request)
    except Exception as e:
        logger.error(f"数据分析失败: {e}")
        return jsonify({
            'error': '数据分析失败',
            'message': str(e)
        }), 500

@app.route('/api/analysis/start', methods=['POST'])
def start_analysis():
    """开始分析处理：ETL去重 + AI分析"""
    try:
        return analysis_controller.start_analysis()
    except Exception as e:
        logger.error(f"开始分析失败: {e}")
        return jsonify({
            'error': '开始分析失败',
            'message': str(e)
        }), 500

@app.route('/api/analysis/status')
def get_analysis_status():
    """获取分析状态"""
    try:
        return analysis_controller.get_analysis_status()
    except Exception as e:
        logger.error(f"获取分析状态失败: {e}")
        return jsonify({
            'error': '获取分析状态失败',
            'message': str(e)
        }), 500

# @app.route('/api/analysis/history')
# def get_analysis_history():
#     """获取分析历史记录"""
#     try:
#         # 获取查询参数
#         limit = request.args.get('limit', 50, type=int)
#         return analysis_controller.get_analysis_history(limit)
#     except Exception as e:
#         logger.error(f"获取分析历史失败: {e}")
#         return jsonify({
#             'error': '获取分析历史失败',
#             'message': str(e)
#         }), 500

@app.route('/api/keywords')
def get_keywords():
    """获取关键词配置"""
    try:
        return analysis_controller.get_keywords()
    except Exception as e:
        logger.error(f"获取关键词失败: {e}")
        return jsonify({
            'error': '获取关键词失败',
            'message': str(e)
        }), 500

@app.route('/api/keywords', methods=['POST'])
def add_keyword():
    """添加关键词"""
    try:
        return analysis_controller.add_keyword(request)
    except Exception as e:
        logger.error(f"添加关键词失败: {e}")
        return jsonify({
            'error': '添加关键词失败',
            'message': str(e)
        }), 500

@app.route('/api/platforms')
def get_platforms():
    """获取平台列表"""
    try:
        return analysis_controller.get_platforms()
    except Exception as e:
        logger.error(f"获取平台列表失败: {e}")
        return jsonify({
            'error': '获取平台列表失败',
            'message': str(e)
        }), 500

@app.route('/api/database/status')
def database_status():
    """数据库状态检查"""
    try:
        # 获取数据库统计信息
        stats = analysis_controller.get_database_stats()
        return jsonify(stats)
    except Exception as e:
        logger.error(f"获取数据库状态失败: {e}")
        return jsonify({
            'error': '获取数据库状态失败',
            'message': str(e)
        }), 500

@app.errorhandler(413)
def too_large(e):
    """文件过大错误处理"""
    return jsonify({
        'error': '文件过大',
        'message': '上传文件不能超过50MB'
    }), 413

@app.errorhandler(404)
def not_found(e):
    """404错误处理"""
    return jsonify({
        'error': '接口不存在',
        'message': '请检查API路径是否正确'
    }), 404

@app.errorhandler(500)
def internal_error(e):
    """500错误处理"""
    return jsonify({
        'error': '服务器内部错误',
        'message': '请联系管理员检查服务器状态'
    }), 500

# ============================================================================
# ETL相关API
# ============================================================================

@app.route('/api/etl/ods-to-dwd', methods=['POST'])
def etl_ods_to_dwd():
    """ODS到DWD处理API"""
    try:
        result = etl_controller.process_ods_to_dwd()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"ODS到DWD处理失败：{e}")
        return jsonify({'success': False, 'error': f'处理失败：{str(e)}'}), 500

@app.route('/api/etl/dwd-to-ai', methods=['POST'])
def etl_dwd_to_ai():
    """DWD到AI同步API"""
    try:
        result = etl_controller.process_dwd_to_ai()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"DWD到AI处理失败：{e}")
        return jsonify({'success': False, 'error': f'处理失败：{str(e)}'}), 500

@app.route('/api/etl/full-pipeline', methods=['POST'])
def etl_full_pipeline():
    """完整ETL流水线API"""
    try:
        result = etl_controller.run_full_pipeline()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"ETL流水线执行失败：{e}")
        return jsonify({'success': False, 'error': f'流水线执行失败：{str(e)}'}), 500

@app.route('/api/etl/status', methods=['GET'])
def etl_status():
    """ETL状态查询API"""
    try:
        result = etl_controller.get_etl_status()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"获取ETL状态失败：{e}")
        return jsonify({'success': False, 'error': f'状态查询失败：{str(e)}'}), 500

# ============================================================================
# AI分析相关API
# ============================================================================

@app.route('/api/ai/process-pending', methods=['POST'])
def ai_process_pending():
    """处理待AI分析的数据API"""
    try:
        result = ai_controller.process_pending_analysis()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"AI分析处理失败：{e}")
        return jsonify({'success': False, 'error': f'AI分析失败：{str(e)}'}), 500

@app.route('/api/ai/retry-failed', methods=['POST'])
def ai_retry_failed():
    """重试失败的AI分析API"""
    try:
        result = ai_controller.retry_failed_analysis()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"重试AI分析失败：{e}")
        return jsonify({'success': False, 'error': f'重试失败：{str(e)}'}), 500

@app.route('/api/ai/statistics', methods=['GET'])
def ai_statistics():
    """获取AI分析统计信息API"""
    try:
        result = ai_controller.get_analysis_statistics()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"获取AI统计失败：{e}")
        return jsonify({'success': False, 'error': f'统计查询失败：{str(e)}'}), 500

@app.route('/api/ai/cleanup', methods=['POST'])
def ai_cleanup():
    """清理旧的AI分析数据API"""
    try:
        result = ai_controller.cleanup_old_data()
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"数据清理失败：{e}")
        return jsonify({'success': False, 'error': f'清理失败：{str(e)}'}), 500

if __name__ == '__main__':
    # 创建必要的目录
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # 启动应用
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('BACKEND_PORT', 9002)),
        debug=False  # 暂时禁用调试模式，避免热重载干扰
    )