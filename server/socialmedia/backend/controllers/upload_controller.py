# -*- coding: utf-8 -*-
"""
文件上传控制器
处理文件上传相关的HTTP请求
"""

import os
import uuid
from datetime import datetime
from flask import request, jsonify
from werkzeug.utils import secure_filename
import logging

from services.simple_file_processor import SimpleFileProcessor
from services.etl_processor import ETLProcessor
from services.batch_ai_analyzer import BatchAIAnalyzer
from config.database_config import get_db_config

logger = logging.getLogger(__name__)

class UploadController:
    """文件上传控制器"""
    
    # 类级别的进度跟踪
    _processing_status = {}  # {batch_id: {'status': 'processing', 'step': 'upload/etl/ai', 'timestamp': datetime}}
    
    def __init__(self):
        self.file_processor = SimpleFileProcessor()
        self.etl_processor = ETLProcessor()
        self.ai_analyzer = BatchAIAnalyzer()
        self.db_config = get_db_config()
        self.allowed_extensions = {'xlsx', 'xls', 'csv'}
        
    def _allowed_file(self, filename: str) -> bool:
        """检查文件扩展名是否允许"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in self.allowed_extensions
    
    @classmethod
    def _update_processing_status(cls, batch_id: str, status: str, step: str):
        """更新处理状态"""
        cls._processing_status[batch_id] = {
            'status': status,
            'step': step,
            'timestamp': datetime.now()
        }
        logger.info(f"更新处理状态: {batch_id} -> {status} ({step})")
    
    @classmethod
    def _check_processing_conflicts(cls) -> dict:
        """检查是否有正在处理的任务"""
        current_time = datetime.now()
        active_tasks = {}
        
        # 清理超过1小时的旧任务
        expired_tasks = []
        for batch_id, info in cls._processing_status.items():
            if (current_time - info['timestamp']).total_seconds() > 3600:  # 1小时
                expired_tasks.append(batch_id)
            elif info['status'] == 'processing':
                active_tasks[batch_id] = info
        
        # 移除过期任务
        for batch_id in expired_tasks:
            del cls._processing_status[batch_id]
            
        return active_tasks
    
    @classmethod
    def _clear_processing_status(cls, batch_id: str):
        """清除处理状态"""
        if batch_id in cls._processing_status:
            del cls._processing_status[batch_id]
            logger.info(f"清除处理状态: {batch_id}")
    
    def handle_upload(self, request):
        """
        处理文件上传请求
        
        Args:
            request: Flask请求对象
            
        Returns:
            JSON响应
        """
        try:
            # 记录上传请求开始
            logger.info("=" * 50)
            logger.info("开始处理文件上传请求")
            logger.info(f"请求方法: {request.method}")
            logger.info(f"请求URL: {request.url}")
            logger.info(f"Content-Type: {request.content_type}")
            logger.info(f"Content-Length: {request.content_length}")
            
            # 检查是否有正在处理的任务
            active_tasks = self._check_processing_conflicts()
            if active_tasks:
                active_info = list(active_tasks.values())[0]
                return jsonify({
                    'success': False,
                    'error': '系统正在处理其他上传任务',
                    'message': f'当前有任务正在进行{active_info["step"]}阶段，请等待完成后再上传新文件',
                    'active_task_step': active_info['step'],
                    'timestamp': active_info['timestamp'].isoformat()
                }), 409  # 409 Conflict
            
            # 检查请求中是否有文件
            if 'file' not in request.files:
                return jsonify({
                    'success': False,
                    'error': '没有选择文件',
                    'message': '请选择要上传的Excel或CSV文件'
                }), 400
            
            file = request.files['file']
            logger.info(f"收到上传文件: {file.filename}, 大小: {file.content_length if hasattr(file, 'content_length') else 'Unknown'}")
            
            # 检查文件名是否为空
            if file.filename == '':
                logger.warning("上传失败: 文件名为空")
                return jsonify({
                    'success': False,
                    'error': '文件名为空',
                    'message': '请选择有效的文件'
                }), 400
            
            # 检查文件类型
            if not self._allowed_file(file.filename):
                logger.warning(f"上传失败: 不支持的文件格式 - {file.filename}")
                return jsonify({
                    'success': False,
                    'error': '不支持的文件格式',
                    'message': f'仅支持 {", ".join(self.allowed_extensions)} 格式的文件'
                }), 400
            
            # 生成安全的文件名
            original_filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            filename = f"{timestamp}_{unique_id}_{original_filename}"
            
            # 确保上传目录存在
            upload_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
            os.makedirs(upload_folder, exist_ok=True)
            
            # 保存文件
            file_path = os.path.join(upload_folder, filename)
            logger.info(f"准备保存文件到: {file_path}")
            file.save(file_path)
            
            # 检查文件是否成功保存
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                logger.info(f"文件成功保存: {file_path}, 大小: {file_size} bytes")
            else:
                logger.error(f"文件保存失败: {file_path}")
                raise Exception(f"文件保存失败: {file_path}")
            
            # 生成批次ID
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{unique_id}"
            
            # 更新处理状态为正在上传
            self._update_processing_status(batch_id, 'processing', 'upload')
            
            # 处理文件（写入ODS表）
            logger.info(f"开始处理文件到ODS表: {file_path}")
            success, error_msg, result = self.file_processor.process_file(file_path, original_filename)
            
            if success:
                logger.info(f"文件上传到ODS成功: {result['batch_id']}")
                logger.info(f"处理结果: 原始行数={result.get('original_rows', 0)}, 成功行数={result.get('success_rows', 0)}, 错误行数={result.get('error_rows', 0)}")
                
                # 构建响应数据（只包含上传结果）
                response_data = {
                    'batch_id': result['batch_id'],
                    'filename': result['filename'],
                    'original_rows': result['original_rows'],
                    'processed_rows': result['processed_rows'],
                    'success_rows': result['success_rows'],
                    'duplicate_rows': result['duplicate_rows'],
                    'error_rows': result['error_rows'],
                    'upload_time': datetime.now().isoformat(),
                    'processing_status': {
                        'ods_upload': 'completed',
                        'etl_processing': 'not_started',
                        'ai_analysis': 'not_started'
                    }
                }
                
                # 处理完成，清除状态
                self._clear_processing_status(batch_id)
                
                return jsonify({
                    'success': True,
                    'message': '文件上传成功，可以开始分析处理',
                    'data': response_data,
                    'summary': {
                        'success_count': result['success_rows'],
                        'duplicate_count': result['duplicate_rows'],
                        'error_count': result['error_rows']
                    },
                    'next_step': {
                        'action': 'start_analysis',
                        'description': '点击"开始分析"按钮进行数据去重和AI分析'
                    }
                }), 200
            else:
                # 如果处理失败，清除状态并删除已上传的文件
                logger.error("=" * 50)
                logger.error("文件处理失败 - 详细信息:")
                logger.error(f"文件路径: {file_path}")
                logger.error(f"原始文件名: {original_filename}")
                logger.error(f"处理失败原因: {error_msg}")
                logger.error(f"批次ID: {batch_id}")
                logger.error("=" * 50)
                
                self._clear_processing_status(batch_id)
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"已删除失败处理的文件: {file_path}")
                except Exception as file_cleanup_error:
                    logger.warning(f"删除失败文件时出错: {file_cleanup_error}")
                
                return jsonify({
                    'success': False,
                    'error': '文件处理失败',
                    'message': error_msg,
                    'debug_info': {
                        'filename': original_filename,
                        'batch_id': batch_id,
                        'file_path': file_path
                    }
                }), 500
                
        except Exception as e:
            # 增强错误日志，包含详细的异常信息
            import traceback
            error_traceback = traceback.format_exc()
            
            logger.error("=" * 60)
            logger.error("文件上传处理发生异常 - 详细错误信息:")
            logger.error(f"异常类型: {type(e).__name__}")
            logger.error(f"异常消息: {str(e)}")
            logger.error(f"文件信息: {getattr(request.files.get('file', {}), 'filename', 'Unknown')}")
            logger.error(f"请求方法: {request.method}")
            logger.error(f"请求URL: {request.url}")
            logger.error(f"请求头信息: {dict(request.headers)}")
            logger.error(f"表单数据: {request.form.to_dict()}")
            logger.error("完整异常堆栈:")
            logger.error(error_traceback)
            logger.error("=" * 60)
            
            # 清除处理状态
            if 'batch_id' in locals():
                self._clear_processing_status(batch_id)
                logger.info(f"已清除处理状态: {batch_id}")
            
            # 清理可能的临时文件
            try:
                if 'file_path' in locals() and os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"已清理临时文件: {file_path}")
            except Exception as cleanup_error:
                logger.warning(f"清理临时文件失败: {cleanup_error}")
            
            # 确保返回有效的JSON响应
            error_response = {
                'success': False,
                'error': '上传过程出现异常',
                'message': str(e),
                'error_type': type(e).__name__,
                'timestamp': datetime.now().isoformat(),
                'debug_info': {
                    'filename': getattr(request.files.get('file', {}), 'filename', 'Unknown'),
                    'method': request.method,
                    'url': request.url
                }
            }
            
            return jsonify(error_response), 500
    
    def get_upload_history(self, limit: int = 50):
        """
        获取上传历史记录
        
        Args:
            limit: 返回记录数量限制
            
        Returns:
            JSON响应
        """
        try:
            # 查询上传历史 - 使用原生pymysql查询避免DataFrame问题
            import pymysql
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            # 获取数据库配置
            db_config = self.db_config.get_database_config()
            
            # 获取SSL配置
            ssl_config = self.db_config._get_ssl_config(db_config)
            
            # 构建连接参数
            connection_params = {
                'host': db_config['host'],
                'port': db_config['port'],
                'user': db_config['username'],
                'password': db_config['password'],
                'database': db_config['database'],
                'charset': db_config['charset'],
                'cursorclass': pymysql.cursors.DictCursor,
                'autocommit': True,
                'connect_timeout': 30,
                'read_timeout': 60,
                'write_timeout': 60
            }
            
            # 添加SSL配置
            if ssl_config:
                connection_params.update(ssl_config)
            
            connection = pymysql.connect(**connection_params)
            
            sql = """
                SELECT id, filename, file_size, original_rows, processed_rows, 
                       success_rows, error_rows, upload_time, process_start_time,
                       process_end_time, batch_id, status, error_message, user_upload
                FROM ods_dash_social_file_upload_logs 
                ORDER BY upload_time DESC 
                LIMIT %s
            """
            
            with connection.cursor() as cursor:
                cursor.execute(sql, (limit,))
                result = cursor.fetchall()
            
            connection.close()
            
            # 处理DataFrame或字典列表
            if result is None:
                return jsonify({
                    'success': True,
                    'data': [],
                    'message': '暂无上传记录'
                }), 200
            
            # 如果结果是pandas DataFrame，转换为字典列表
            if hasattr(result, 'to_dict'):
                result = result.to_dict('records')
            elif hasattr(result, 'empty') and result.empty:
                return jsonify({
                    'success': True,
                    'data': [],
                    'message': '暂无上传记录'
                }), 200
            elif len(result) == 0:
                return jsonify({
                    'success': True,
                    'data': [],
                    'message': '暂无上传记录'
                }), 200
            
            # 格式化结果
            upload_history = []
            for row in result:
                upload_history.append({
                    'id': row.get('id'),
                    'filename': row.get('filename'),
                    'file_size': row.get('file_size'),
                    'original_rows': row.get('original_rows'),
                    'processed_rows': row.get('processed_rows'),
                    'success_rows': row.get('success_rows'),
                    'error_rows': row.get('error_rows'),
                    'upload_time': str(row.get('upload_time')) if row.get('upload_time') else None,
                    'process_start_time': str(row.get('process_start_time')) if row.get('process_start_time') else None,
                    'process_end_time': str(row.get('process_end_time')) if row.get('process_end_time') else None,
                    'batch_id': row.get('batch_id'),
                    'status': row.get('status'),
                    'error_message': row.get('error_message'),
                    'user_upload': row.get('user_upload')
                })
            
            return jsonify({
                'success': True,
                'data': upload_history,
                'total': len(upload_history),
                'message': f'获取到 {len(upload_history)} 条上传记录'
            }), 200
            
        except Exception as e:
            logger.error(f"获取上传历史失败: {e}")
            return jsonify({
                'success': False,
                'error': '获取上传历史失败',
                'message': str(e)
            }), 500
    
    def get_upload_stats(self):
        """
        获取上传统计信息
        
        Returns:
            JSON响应
        """
        try:
            # 总上传次数
            total_uploads_sql = "SELECT COUNT(*) as total FROM ods_dash_social_file_upload_logs"
            total_result = self.db_config.execute_query_dict(total_uploads_sql)
            # 处理DataFrame
            if hasattr(total_result, 'to_dict'):
                total_result = total_result.to_dict('records')
            total_uploads = total_result[0]['total'] if total_result and len(total_result) > 0 else 0
            
            # 成功上传次数
            success_uploads_sql = "SELECT COUNT(*) as success FROM ods_dash_social_file_upload_logs WHERE status = 'completed'"
            success_result = self.db_config.execute_query_dict(success_uploads_sql)
            # 处理DataFrame
            if hasattr(success_result, 'to_dict'):
                success_result = success_result.to_dict('records')
            success_uploads = success_result[0]['success'] if success_result and len(success_result) > 0 else 0
            
            # 总处理行数
            total_rows_sql = "SELECT SUM(success_rows) as total_rows FROM ods_dash_social_file_upload_logs"
            rows_result = self.db_config.execute_query_dict(total_rows_sql)
            # 处理DataFrame
            if hasattr(rows_result, 'to_dict'):
                rows_result = rows_result.to_dict('records')
            total_rows = rows_result[0]['total_rows'] if rows_result and len(rows_result) > 0 and rows_result[0]['total_rows'] else 0
            
            # 最近7天上传统计
            recent_uploads_sql = """
                SELECT DATE(upload_time) as upload_date, COUNT(*) as count
                FROM ods_dash_social_file_upload_logs 
                WHERE upload_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(upload_time)
                ORDER BY upload_date DESC
            """
            recent_result = self.db_config.execute_query_dict(recent_uploads_sql)
            # 处理DataFrame
            if hasattr(recent_result, 'to_dict'):
                recent_result = recent_result.to_dict('records')
            recent_stats = {str(row['upload_date']): row['count'] for row in recent_result} if recent_result and len(recent_result) > 0 else {}
            
            # 状态分布
            status_sql = """
                SELECT status, COUNT(*) as count 
                FROM ods_dash_social_file_upload_logs 
                GROUP BY status
            """
            status_result = self.db_config.execute_query_dict(status_sql)
            # 处理DataFrame
            if hasattr(status_result, 'to_dict'):
                status_result = status_result.to_dict('records')
            status_stats = {row['status']: row['count'] for row in status_result} if status_result and len(status_result) > 0 else {}
            
            return jsonify({
                'success': True,
                'data': {
                    'total_uploads': total_uploads,
                    'success_uploads': success_uploads,
                    'success_rate': (success_uploads / total_uploads * 100) if total_uploads > 0 else 0,
                    'total_processed_rows': total_rows,
                    'recent_7days': recent_stats,
                    'status_distribution': status_stats,
                    'last_updated': datetime.now().isoformat()
                }
            }), 200
            
        except Exception as e:
            logger.error(f"获取上传统计失败: {e}")
            return jsonify({
                'success': False,
                'error': '获取上传统计失败',
                'message': str(e)
            }), 500
    
    def _trigger_post_upload_processing(self, upload_success_rows: int):
        """
        触发上传后的处理流程：ETL处理 + AI分析
        
        Args:
            upload_success_rows: 上传成功的行数
            
        Returns:
            处理结果状态字典
        """
        processing_results = {
            'etl_processing': 'failed',
            'ai_analysis': 'failed',
            'etl_details': {},
            'ai_details': {}
        }
        
        try:
            # 1. 执行ETL处理（ODS → DWD → DWD_AI数据同步）
            logger.info("开始执行ETL处理...")
            
            # 更新状态为ETL处理中
            batch_id = f"etl_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self._update_processing_status(batch_id, 'processing', 'etl')
            
            # 根据上传数据量调整批处理大小
            etl_batch_size = min(max(upload_success_rows, 100), 2000)
            
            etl_result = self.etl_processor.run_full_etl_pipeline(batch_size=etl_batch_size)
            
            if etl_result.get('pipeline_status') == 'completed':
                processing_results['etl_processing'] = 'completed'
                processing_results['etl_details'] = {
                    'dwd_new_records': etl_result.get('ods_to_dwd_success', 0),
                    'ai_sync_records': etl_result.get('dwd_to_ai_success', 0),
                    'total_failed': etl_result.get('total_failed_records', 0),
                    'message': etl_result.get('message', 'ETL处理完成')
                }
                logger.info(f"ETL处理成功: {etl_result.get('message')}")
                
                # 2. 执行AI分析（如果ETL成功）
                logger.info("开始执行AI分析...")
                
                # 更新状态为AI分析中
                self._update_processing_status(batch_id, 'processing', 'ai')
                
                # 根据处理成功的数据量调整AI批处理大小
                ai_batch_size = min(max(etl_result.get('dwd_to_ai_success', 0), 50), 500)
                
                if ai_batch_size > 0:
                    ai_result = self.ai_analyzer.process_pending_ai_analysis(batch_size=ai_batch_size)
                    
                    if ai_result.get('status') in ['completed', 'partial']:
                        processing_results['ai_analysis'] = ai_result.get('status')
                        processing_results['ai_details'] = {
                            'success_records': ai_result.get('success_records', 0),
                            'failed_records': ai_result.get('failed_records', 0),
                            'ai_service_available': ai_result.get('ai_service_available', False),
                            'message': ai_result.get('message', 'AI分析完成')
                        }
                        logger.info(f"AI分析完成: {ai_result.get('message')}")
                    else:
                        processing_results['ai_details'] = {
                            'error': ai_result.get('error', '未知错误'),
                            'ai_service_available': ai_result.get('ai_service_available', False)
                        }
                        logger.warning(f"AI分析失败: {ai_result.get('error')}")
                else:
                    processing_results['ai_analysis'] = 'skipped'
                    processing_results['ai_details'] = {'message': '没有数据需要AI分析'}
            else:
                processing_results['etl_details'] = {
                    'error': etl_result.get('error', '未知错误'),
                    'steps': etl_result.get('steps', [])
                }
                logger.error(f"ETL处理失败: {etl_result.get('error')}")
                
        except Exception as e:
            logger.error(f"后续处理流程异常: {e}")
            processing_results['etl_details']['error'] = f'处理异常: {str(e)}'
            processing_results['ai_details']['error'] = '由于ETL失败，跳过AI分析'
        finally:
            # 无论成功失败，都清除处理状态
            if 'batch_id' in locals():
                self._clear_processing_status(batch_id)
        
        return processing_results
    
    def get_processing_status(self, batch_id: str):
        """
        获取指定批次的处理状态
        
        Args:
            batch_id: 批次ID
            
        Returns:
            JSON响应
        """
        try:
            # 查询上传记录 - 使用execute_query_dict获取字典格式结果
            upload_sql = """
                SELECT batch_id, status, success_rows, filename, upload_time, processed_rows
                FROM ods_dash_social_file_upload_logs 
                WHERE batch_id = %s
            """
            upload_result = self.db_config.execute_query_dict(upload_sql, (batch_id,))
            
            logger.info(f"查询上传信息: {upload_result}")
            
            if not upload_result or len(upload_result) == 0:
                return jsonify({
                    'success': False,
                    'error': '未找到指定批次',
                    'message': f'批次ID {batch_id} 不存在'
                }), 404
            
            upload_info = upload_result[0]
            
            # 简化ETL状态查询 - 移除不存在的字段
            etl_sql = """
                SELECT batch_id, status, success_records, failed_records, start_time, end_time, message
                FROM etl_processing_log 
                WHERE batch_id LIKE %s
                ORDER BY start_time DESC
                LIMIT 5
            """
            
            try:
                etl_result = self.db_config.execute_query_dict(etl_sql, (f'%{batch_id}%',))
                logger.info(f"ETL信息(成功): {etl_result}")
            except Exception as etl_error:
                logger.warning(f"ETL查询失败: {etl_error}")
                etl_result = []
            
            # 查询AI分析状态
            ai_stats_sql = """
                SELECT ai_processing_status, COUNT(*) as count
                FROM dwd_dash_social_comments_ai 
                WHERE upload_batch_id = %s
                GROUP BY ai_processing_status
            """
            
            try:
                ai_stats_result = self.db_config.execute_query_dict(ai_stats_sql, (upload_info['batch_id'],))
                ai_status_stats = {row['ai_processing_status']: row['count'] for row in ai_stats_result} if ai_stats_result else {}
                logger.info(f"查询到AI统计信息: {ai_status_stats}")
            except Exception as ai_error:
                logger.warning(f"AI状态查询失败: {ai_error}")
                ai_status_stats = {}
            
            logger.info(f"开始计算详细状态: upload_info={upload_info}")
            logger.info(f"ETL结果: {etl_result}")
            logger.info(f"AI统计: {ai_status_stats}")
            
            return jsonify({
                'success': True,
                'data': {
                    'batch_id': batch_id,
                    'upload_info': {
                        'filename': upload_info.get('filename'),
                        'status': upload_info.get('status'),
                        'success_rows': upload_info.get('success_rows'),
                        'processed_rows': upload_info.get('processed_rows'),
                        'upload_time': str(upload_info.get('upload_time')) if upload_info.get('upload_time') else None
                    },
                    'etl_info': [
                        {
                            'batch_id': row.get('batch_id'),
                            'status': row.get('status'),
                            'success_records': row.get('success_records'),
                            'failed_records': row.get('failed_records'),
                            'start_time': str(row.get('start_time')) if row.get('start_time') else None,
                            'end_time': str(row.get('end_time')) if row.get('end_time') else None,
                            'message': row.get('message')
                        } for row in etl_result
                    ] if etl_result else [],
                    'ai_status_stats': ai_status_stats,
                    'overall_status': self._calculate_overall_status(upload_info, etl_result, ai_status_stats)
                }
            }), 200
            
        except Exception as e:
            logger.error(f"获取处理状态失败: {e}")
            logger.error(f"异常类型: {type(e)}")
            logger.error(f"异常详情: {repr(e)}")
            import traceback
            logger.error(f"调用栈: {traceback.format_exc()}")
            return jsonify({
                'success': False,
                'error': '获取处理状态失败',
                'message': str(e)
            }), 500
    
    def _calculate_overall_status(self, upload_info, etl_result, ai_status_stats):
        """计算整体处理状态"""
        if upload_info.get('status') != 'completed':
            return 'upload_failed'
        
        if not etl_result:
            return 'etl_pending'
        
        latest_etl = etl_result[0] if etl_result else None
        if latest_etl and latest_etl.get('status') != 'completed':
            return 'etl_processing'
        
        total_ai_records = sum(ai_status_stats.values()) if ai_status_stats else 0
        completed_ai = ai_status_stats.get('completed', 0)
        
        if total_ai_records == 0:
            return 'ai_pending'
        elif completed_ai == total_ai_records:
            return 'fully_completed'
        elif completed_ai > 0:
            return 'ai_processing'
        else:
            return 'ai_pending'