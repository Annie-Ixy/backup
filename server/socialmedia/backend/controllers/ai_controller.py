# -*- coding: utf-8 -*-
"""
AI分析控制器
提供批量AI分析的API接口
"""

import logging
from flask import jsonify, request
from typing import Dict, Any

from services.batch_ai_analyzer import BatchAIAnalyzer

logger = logging.getLogger(__name__)

class AIController:
    """AI分析控制器"""
    
    def __init__(self):
        self.batch_ai_analyzer = BatchAIAnalyzer()
    
    def process_pending_analysis(self) -> Dict[str, Any]:
        """处理待AI分析的数据API"""
        try:
            # 获取请求参数
            batch_size = request.json.get('batch_size', 100) if request.json else 100
            
            # 参数验证
            if not isinstance(batch_size, int) or batch_size <= 0:
                return {
                    'success': False,
                    'error': '批处理大小必须是正整数',
                    'data': None
                }
            
            if batch_size > 500:
                return {
                    'success': False,
                    'error': '批处理大小不能超过500（避免AI服务超载）',
                    'data': None
                }
            
            # 执行AI分析
            result = self.batch_ai_analyzer.process_pending_ai_analysis(batch_size)
            
            return {
                'success': True,
                'message': result.get('message', 'AI分析处理完成'),
                'data': result
            }
            
        except Exception as e:
            error_msg = f"AI分析处理失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
    
    def retry_failed_analysis(self) -> Dict[str, Any]:
        """重试失败的AI分析API"""
        try:
            # 获取请求参数
            batch_size = request.json.get('batch_size', 50) if request.json else 50
            
            # 参数验证
            if not isinstance(batch_size, int) or batch_size <= 0:
                return {
                    'success': False,
                    'error': '批处理大小必须是正整数',
                    'data': None
                }
            
            if batch_size > 200:
                return {
                    'success': False,
                    'error': '重试批处理大小不能超过200',
                    'data': None
                }
            
            # 执行重试
            result = self.batch_ai_analyzer.retry_failed_analysis(batch_size)
            
            return {
                'success': True,
                'message': result.get('message', '重试AI分析完成'),
                'data': result
            }
            
        except Exception as e:
            error_msg = f"重试AI分析失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
    
    def get_analysis_statistics(self) -> Dict[str, Any]:
        """获取AI分析统计信息API"""
        try:
            result = self.batch_ai_analyzer.get_ai_analysis_statistics()
            
            return {
                'success': True,
                'message': 'AI分析统计获取成功',
                'data': result
            }
            
        except Exception as e:
            error_msg = f"获取AI分析统计失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
    
    def cleanup_old_data(self) -> Dict[str, Any]:
        """清理旧的分析数据API"""
        try:
            # 获取请求参数
            days = request.json.get('days', 30) if request.json else 30
            
            # 参数验证
            if not isinstance(days, int) or days <= 0:
                return {
                    'success': False,
                    'error': '清理天数必须是正整数',
                    'data': None
                }
            
            if days < 7:
                return {
                    'success': False,
                    'error': '清理天数不能少于7天',
                    'data': None
                }
            
            # 执行清理
            result = self.batch_ai_analyzer.cleanup_old_analysis_data(days)
            
            return {
                'success': True,
                'message': result.get('message', '数据清理完成'),
                'data': result
            }
            
        except Exception as e:
            error_msg = f"数据清理失败：{str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg,
                'data': None
            }
