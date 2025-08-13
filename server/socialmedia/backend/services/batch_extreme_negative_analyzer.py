# -*- coding: utf-8 -*-
"""
批量极端负面评论分析器
负责批量处理极端负面评论分析任务
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from config.database_config import get_db_config
from services.ai_sentiment_analyzer import AISentimentAnalyzer

logger = logging.getLogger(__name__)

class BatchExtremeNegativeAnalyzer:
    """批量极端负面分析器"""
    
    def __init__(self):
        self.db_config = get_db_config()
        self.ai_analyzer = AISentimentAnalyzer()
    
    def process_pending_extreme_analysis(self, batch_size: int = 50) -> Dict[str, Any]:
        """
        处理待极端负面分析的记录
        
        Args:
            batch_size: 批处理大小
            
        Returns:
            处理结果统计
        """
        try:
            # 生成批次ID
            batch_id = f"extreme_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            logger.info(f"开始批量极端负面分析，批次ID: {batch_id}")
            
            # 1. 获取待极端负面分析的记录
            records = self._fetch_pending_extreme_records(batch_size)
            
            if not records:
                logger.info("没有待极端负面分析的记录")
                return {
                    'batch_id': batch_id,
                    'status': 'completed',
                    'message': '没有待分析的数据',
                    'total_records': 0,
                    'success_records': 0,
                    'failed_records': 0,
                    'ai_service_available': self.ai_analyzer.is_available()
                }
            
            logger.info(f"获取到 {len(records)} 条待极端负面分析记录（从DWD表）")
            
            # 2. 批量处理记录
            success_count = 0
            failed_count = 0
            
            for record in records:
                try:
                    # 更新状态为 processing
                    self._update_extreme_status(record['record_id'], 'processing')
                    
                    # 进行极端负面检测
                    is_extreme = self.ai_analyzer.analyze_extreme_negative(
                        record['text'], 
                        record.get('ai_sentiment', '')
                    )
                    
                    # 更新状态为 completed
                    self._update_extreme_status_success(record['record_id'], is_extreme)
                    success_count += 1
                    
                    logger.debug(f"记录 {record['record_id']} 极端负面分析完成: {is_extreme}")
                    
                except Exception as e:
                    logger.error(f"记录 {record['record_id']} 极端负面分析失败: {e}")
                    # 更新状态为 failed
                    self._update_extreme_status(record['record_id'], 'failed')
                    failed_count += 1
                    continue
            
            # 3. 返回处理结果
            result = {
                'batch_id': batch_id,
                'status': 'completed' if failed_count == 0 else 'partial',
                'message': f'极端负面分析完成：成功{success_count}条，失败{failed_count}条',
                'total_records': len(records),
                'success_records': success_count,
                'failed_records': failed_count,
                'ai_service_available': self.ai_analyzer.is_available()
            }
            
            logger.info(f"批量极端负面分析完成: {result['message']}")
            return result
            
        except Exception as e:
            error_msg = f"批量极端负面分析失败: {e}"
            logger.error(error_msg)
            return {
                'batch_id': batch_id if 'batch_id' in locals() else 'unknown',
                'status': 'failed',
                'error': error_msg,
                'total_records': 0,
                'success_records': 0,
                'failed_records': 0,
                'ai_service_available': self.ai_analyzer.is_available()
            }
    
    def _fetch_pending_extreme_records(self, batch_size: int) -> List[Dict[str, Any]]:
        """获取待极端负面分析的记录"""
        try:
            sql = f"""
                SELECT record_id, text, ai_sentiment
                FROM dwd_dash_social_comments
                WHERE ai_processing_status = 'completed'
                  AND ai_sentiment = 'negative'
                  AND extreme_negative_processing_status NOT IN ('completed', 'processing')
                ORDER BY record_id ASC
                LIMIT {batch_size}
            """
            
            result = self.db_config.execute_query_dict(sql)
            return result or []
            
        except Exception as e:
            logger.error(f"获取待极端负面分析记录失败: {e}")
            return []
    
    def _update_extreme_status(self, record_id: int, status: str):
        """更新极端负面处理状态"""
        try:
            sql = f"""
                UPDATE dwd_dash_social_comments 
                SET extreme_negative_processing_status = '{status}',
                    updated_at = NOW()
                WHERE record_id = {record_id}
            """
            
            self.db_config.execute_insert(sql)
            logger.debug(f"更新记录 {record_id} 极端负面状态为: {status}")
            
        except Exception as e:
            logger.error(f"更新极端负面状态失败: {e}")
            raise
    
    def _update_extreme_status_success(self, record_id: int, is_extreme: bool):
        """更新极端负面分析成功状态"""
        try:
            sql = f"""
                UPDATE dwd_dash_social_comments 
                SET extreme_negative_processing_status = 'completed',
                    updated_at = NOW()
                WHERE record_id = {record_id}
            """
            
            self.db_config.execute_insert(sql)
            logger.debug(f"记录 {record_id} 极端负面分析完成，结果: {is_extreme}")
            
        except Exception as e:
            logger.error(f"更新极端负面成功状态失败: {e}")
            raise
    
    def retry_failed_extreme_analysis(self, batch_size: int = 50) -> Dict[str, Any]:
        """重试失败的极端负面分析"""
        try:
            # 重置失败状态为pending
            reset_sql = """
                UPDATE dwd_dash_social_comments 
                SET extreme_negative_processing_status = 'pending'
                WHERE extreme_negative_processing_status = 'failed'
                  AND ai_processing_status = 'completed'
                  AND ai_sentiment = 'negative'
            """
            
            self.db_config.execute_insert(reset_sql)
            logger.info("重置失败的极端负面分析记录状态为pending")
            
            # 重新处理
            return self.process_pending_extreme_analysis(batch_size)
            
        except Exception as e:
            error_msg = f"重试失败的极端负面分析失败: {e}"
            logger.error(error_msg)
            return {
                'status': 'failed',
                'error': error_msg
            }
    
    def get_extreme_analysis_statistics(self) -> Dict[str, Any]:
        """获取极端负面分析统计信息"""
        try:
            # 总体状态统计
            status_sql = """
                SELECT 
                    extreme_negative_processing_status,
                    COUNT(*) as count
                FROM dwd_dash_social_comments
                WHERE ai_processing_status = 'completed'
                  AND ai_sentiment = 'negative'
                GROUP BY extreme_negative_processing_status
            """
            
            status_result = self.db_config.execute_query_dict(status_sql)
            
            # 极端负面分布统计（从AI表）
            distribution_sql = """
                SELECT 
                    extremely_negative,
                    COUNT(*) as count
                FROM dwd_dash_social_comments_ai
                WHERE ai_sentiment = 'negative'
                GROUP BY extremely_negative
            """
            
            distribution_result = self.db_config.execute_query_dict(distribution_sql)
            
            return {
                'status_distribution': {row['extreme_negative_processing_status']: row['count'] for row in status_result or []},
                'extreme_distribution': {bool(row['extremely_negative']): row['count'] for row in distribution_result or []},
                'ai_service_available': self.ai_analyzer.is_available()
            }
            
        except Exception as e:
            logger.error(f"获取极端负面分析统计失败: {e}")
            return {
                'status_distribution': {},
                'extreme_distribution': {},
                'ai_service_available': self.ai_analyzer.is_available(),
                'error': str(e)
            }
    
    def process_non_negative_records(self, batch_size: int = 100) -> Dict[str, Any]:
        """
        处理非负面评论（直接设置为completed状态）
        
        Args:
            batch_size: 批处理大小
            
        Returns:
            处理结果统计
        """
        try:
            logger.info("开始处理非负面评论的极端负面状态")
            
            # 对于非负面评论，直接设置extreme_negative_processing_status为completed
            sql = f"""
                UPDATE dwd_dash_social_comments 
                SET extreme_negative_processing_status = 'completed',
                    updated_at = NOW()
                WHERE ai_processing_status = 'completed'
                  AND ai_sentiment != 'negative'
                  AND extreme_negative_processing_status = 'pending'
                LIMIT {batch_size}
            """
            
            affected_rows = self.db_config.execute_insert(sql)
            
            result = {
                'status': 'completed',
                'message': f'非负面评论处理完成：{affected_rows}条',
                'processed_records': affected_rows
            }
            
            logger.info(result['message'])
            return result
            
        except Exception as e:
            error_msg = f"处理非负面评论失败: {e}"
            logger.error(error_msg)
            return {
                'status': 'failed',
                'error': error_msg,
                'processed_records': 0
            }
