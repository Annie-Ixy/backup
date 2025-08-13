# -*- coding: utf-8 -*-
"""
ETL控制器
提供ETL处理的API接口
"""

import logging
from flask import jsonify, request
from typing import Dict, Any

from services.etl_processor import ETLProcessor

logger = logging.getLogger(__name__)

class ETLController:
    """ETL控制器"""
    
    def __init__(self):
        self.etl_processor = ETLProcessor()
    
    def process_ods_to_dwd(self) -> Dict[str, Any]:
        """ODS到DWD处理API"""
        try:
            # 获取请求参数
            batch_size = request.json.get('batch_size', 1000) if request.json else 1000
            force_reprocess = request.json.get('force_reprocess', False) if request.json else False
            
            # 参数验证
            if not isinstance(batch_size, int) or batch_size <= 0:
                return {
                    'success': False,
                    'error': '批处理大小必须是正整数',
                    'data': None
                }
            
            if batch_size > 5000:
                return {
                    'success': False,
                    'error': '批处理大小不能超过5000',
                    'data': None
                }
            
            # 执行处理
            result = self.etl_processor.process_ods_to_dwd(batch_size, force_reprocess)
            
            return {
                'success': True,
                'message': result.get('message', 'ODS到DWD处理完成'),
                'data': result
            }
            
        except Exception as e:
            error_msg = f"ODS到DWD处理失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
    
    def process_dwd_to_ai(self) -> Dict[str, Any]:
        """DWD到DWD_AI处理API"""
        try:
            # 获取请求参数
            batch_size = request.json.get('batch_size', 500) if request.json else 500
            
            # 参数验证
            if not isinstance(batch_size, int) or batch_size <= 0:
                return {
                    'success': False,
                    'error': '批处理大小必须是正整数',
                    'data': None
                }
            
            if batch_size > 2000:
                return {
                    'success': False,
                    'error': '批处理大小不能超过2000',
                    'data': None
                }
            
            # 执行处理
            result = self.etl_processor.process_dwd_to_ai(batch_size)
            
            return {
                'success': True,
                'message': result.get('message', 'DWD到AI同步完成'),
                'data': result
            }
            
        except Exception as e:
            error_msg = f"DWD到AI处理失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
    
    def run_full_pipeline(self) -> Dict[str, Any]:
        """运行完整ETL流水线API"""
        try:
            # 获取请求参数
            batch_size = request.json.get('batch_size', 1000) if request.json else 1000
            
            # 参数验证
            if not isinstance(batch_size, int) or batch_size <= 0:
                return {
                    'success': False,
                    'error': '批处理大小必须是正整数',
                    'data': None
                }
            
            if batch_size > 5000:
                return {
                    'success': False,
                    'error': '批处理大小不能超过5000',
                    'data': None
                }
            
            # 执行完整流水线
            result = self.etl_processor.run_full_etl_pipeline(batch_size)
            
            return {
                'success': True,
                'message': result.get('message', 'ETL流水线执行完成'),
                'data': result
            }
            
        except Exception as e:
            error_msg = f"ETL流水线执行失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
    
    def get_etl_status(self) -> Dict[str, Any]:
        """获取ETL状态API"""
        try:
            result = self.etl_processor.get_etl_status()
            
            return {
                'success': True,
                'message': 'ETL状态获取成功',
                'data': result
            }
            
        except Exception as e:
            error_msg = f"获取ETL状态失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
