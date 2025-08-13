# -*- coding: utf-8 -*-
"""
批量AI分析服务
专门处理DWD_AI层数据的批量AI情感分析
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
import time

from models.new_dash_social_model import DWDAIDashSocialComment
from config.database_config import get_db_config
from services.ai_sentiment_analyzer import AISentimentAnalyzer

logger = logging.getLogger(__name__)

class BatchAIAnalyzer:
    """批量AI分析器 - 处理DWD_AI层数据的批量AI分析"""
    
    def __init__(self):
        self.db_config = get_db_config()
        self.ai_analyzer = AISentimentAnalyzer()
        
    def process_pending_ai_analysis(self, batch_size: int = 100) -> Dict[str, Any]:
        """
        处理待AI分析的记录
        
        Args:
            batch_size: 批处理大小
            
        Returns:
            处理结果统计
        """
        try:
            # 生成分析批次ID
            batch_id = f"ai_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            logger.info(f"开始批量AI分析，批次ID: {batch_id}")
            
            # 1. 检查AI服务是否可用
            if not self.ai_analyzer.is_available():
                logger.error("AI分析服务不可用")
                return {
                    'batch_id': batch_id,
                    'status': 'failed',
                    'error': 'AI分析服务不可用',
                    'ai_service_available': False,
                    'total_records': 0,
                    'processed_records': 0,
                    'success_records': 0,
                    'failed_records': 0
                }
            
            # 2. 获取待分析的记录
            pending_records = self._fetch_pending_ai_records(batch_size)
            
            if not pending_records:
                logger.info("没有待AI分析的记录")
                return {
                    'batch_id': batch_id,
                    'status': 'completed',
                    'message': '没有待AI分析的记录',
                    'ai_service_available': True,
                    'total_records': 0,
                    'processed_records': 0,
                    'success_records': 0,
                    'failed_records': 0
                }
            
            logger.info(f"获取到 {len(pending_records)} 条待分析记录")
            
            # 3. 批量处理AI分析
            success_count, failed_count = self._process_ai_analysis_batch(
                pending_records, batch_id
            )
            
            # 4. 生成结果
            total_records = len(pending_records)
            status = 'completed' if failed_count == 0 else 'partial' if success_count > 0 else 'failed'
            
            result = {
                'batch_id': batch_id,
                'status': status,
                'message': f'AI分析完成：成功{success_count}条，失败{failed_count}条',
                'ai_service_available': True,
                'total_records': total_records,
                'processed_records': total_records,
                'success_records': success_count,
                'failed_records': failed_count
            }
            
            logger.info(f"批量AI分析完成：{result}")
            return result
            
        except Exception as e:
            error_msg = f"批量AI分析失败：{str(e)}"
            logger.error(error_msg)
            return {
                'batch_id': batch_id if 'batch_id' in locals() else 'unknown',
                'status': 'failed',
                'error': error_msg,
                'ai_service_available': self.ai_analyzer.is_available(),
                'total_records': 0,
                'processed_records': 0,
                'success_records': 0,
                'failed_records': 0
            }
    
    def _fetch_pending_ai_records(self, limit: int) -> List[Dict[str, Any]]:
        """获取待AI分析的记录（从DWD表读取）"""
        try:
            sql = f"""
                SELECT record_id, text, ai_processing_status,
                       brand_label, author_name, channel, last_update
                FROM dwd_dash_social_comments 
                WHERE ai_processing_status != 'completed'
                ORDER BY record_id ASC
                LIMIT {limit}
            """
            
            result = self.db_config.execute_query_dict(sql)
            logger.info(f"获取到 {len(result) if result else 0} 条待AI分析记录（从DWD表）")
            
            return result or []
            
        except Exception as e:
            logger.error(f"获取待AI分析记录失败：{e}")
            return []
    
    def _process_ai_analysis_batch(self, records: List[Dict[str, Any]], batch_id: str) -> Tuple[int, int]:
        """处理一批AI分析记录"""
        success_count = 0
        failed_count = 0
        
        try:
            # 首先更新所有记录状态为processing
            record_ids = [record['record_id'] for record in records]
            self._update_processing_status(record_ids, 'processing', batch_id)
            
            logger.info(f"开始批量AI分析，共 {len(records)} 条记录")
            
            # 逐个处理记录
            for i, record in enumerate(records, 1):
                try:
                    # 每10条记录检查一次数据库连接健康状态
                    if i % 10 == 0:
                        logger.info(f"处理进度: {i}/{len(records)}, 检查数据库连接状态...")
                        if not self.db_config.test_connection():
                            logger.warning("数据库连接异常，尝试重新连接...")
                            self.db_config.close_connection()
                    
                    text = record.get('text', '').strip()
                    if not text:
                        logger.warning(f"记录 {record['record_id']} 文本为空，跳过AI分析")
                        self._update_single_record_failed(
                            record['record_id'], '文本内容为空', batch_id
                        )
                        failed_count += 1
                        continue
                    
                    # 执行AI分析
                    ai_result = self.ai_analyzer.analyze_single_text(text)
                    
                    if ai_result.get('error'):
                        # AI分析失败
                        error_msg = ai_result.get('error', '未知错误')
                        logger.warning(f"记录 {record['record_id']} AI分析失败: {error_msg}")
                        self._update_single_record_failed(
                            record['record_id'], error_msg, batch_id
                        )
                        failed_count += 1
                    else:
                        # AI分析成功
                        self._update_single_record_success(
                            record['record_id'], ai_result, batch_id
                        )
                        success_count += 1
                    
                    # API限流：每次分析后暂停
                    if i < len(records):  # 最后一个记录不需要等待
                        time.sleep(1.0)  # 1秒间隔避免API限制
                        
                except Exception as e:
                    logger.error(f"处理记录 {record.get('record_id', 'unknown')} 时发生错误: {e}")
                    self._update_single_record_failed(
                        record.get('record_id'), f'处理异常: {str(e)}', batch_id
                    )
                    failed_count += 1
                    continue
            
            logger.info(f"AI分析批次处理完成：成功 {success_count} 条，失败 {failed_count} 条")
            return success_count, failed_count
            
        except Exception as e:
            logger.error(f"批量AI分析处理失败：{e}")
            # 更新所有记录为失败状态
            record_ids = [record['record_id'] for record in records]
            self._update_processing_status(record_ids, 'failed', batch_id, str(e))
            return 0, len(records)
    
    def _update_processing_status(self, record_ids: List[int], status: str, 
                                batch_id: str, error_msg: str = None):
        """批量更新记录的处理状态（更新DWD表）"""
        try:
            if not record_ids:
                return
            
            ids_str = ','.join(map(str, record_ids))
            # 注意：DWD表没有ai_error_message和ai_analysis_batch_id字段，只更新状态
            
            sql = f"""
                UPDATE dwd_dash_social_comments SET
                    ai_processing_status = '{status}'
                WHERE record_id IN ({ids_str})
            """
            
            self.db_config.execute_insert(sql)
            logger.info(f"更新 {len(record_ids)} 条DWD记录状态为: {status}")
            
        except Exception as e:
            logger.error(f"批量更新DWD记录状态失败：{e}")
    
    def _update_single_record_success(self, record_id: int, ai_result: Dict[str, Any], batch_id: str):
        """更新单条记录为成功状态：只更新DWD表的AI分析状态"""
        try:
            # 获取AI分析结果
            ai_sentiment = ai_result.get('sentiment', 'neutral')
            ai_confidence = ai_result.get('confidence', 0.0)
            
            def escape_sql_string(s):
                if s is None:
                    return 'NULL'
                return "'" + str(s).replace("'", "''") + "'"
            
            # 更新DWD表状态为completed，并保存基本AI分析结果
            update_sql = f"""
                UPDATE dwd_dash_social_comments SET
                    ai_processing_status = 'completed',
                    ai_sentiment = {escape_sql_string(ai_sentiment)},
                    ai_confidence = {ai_confidence},
                    ai_processed_at = NOW(),
                    updated_at = NOW()
                WHERE record_id = {record_id}
            """
            
            self.db_config.execute_insert(update_sql)
            logger.debug(f"更新DWD记录 {record_id} AI分析状态为completed，情感：{ai_sentiment}")
            
            # 注意：不再直接插入DWD_AI表，这将由后续的极端负面分析和同步流程处理
            
        except Exception as e:
            logger.error(f"更新记录 {record_id} AI分析状态失败：{e}")
    
    def _get_dwd_record(self, record_id: int) -> Dict[str, Any]:
        """获取DWD记录详细信息"""
        try:
            sql = f"""
                SELECT record_id, source_record_id, last_update, brand_label, author_name, 
                       channel, message_type, text, tags, post_link, sentiment,
                       ai_processing_status, created_at, updated_at
                FROM dwd_dash_social_comments 
                WHERE record_id = {record_id}
            """
            
            result = self.db_config.execute_query_dict(sql)
            if result:
                return result[0]
            return None
            
        except Exception as e:
            logger.error(f"获取DWD记录 {record_id} 失败：{e}")
            return None
    
    def _insert_to_dwd_ai(self, dwd_record: Dict[str, Any], ai_result: Dict[str, Any], batch_id: str):
        """插入记录到DWD_AI表"""
        try:
            def escape_sql_string(s):
                if s is None:
                    return 'NULL'
                return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"
            
            def format_datetime(dt):
                if dt is None:
                    return 'NULL'
                if isinstance(dt, str):
                    return f"'{dt}'"
                try:
                    return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'" if hasattr(dt, 'strftime') else f"'{dt}'"
                except:
                    return 'NULL'
            
            def format_date(dt):
                if dt is None:
                    return 'NULL'
                if isinstance(dt, str):
                    return f"'{dt}'"
                try:
                    return f"'{dt.strftime('%Y-%m-%d')}'" if hasattr(dt, 'strftime') else f"'{dt}'"
                except:
                    return 'NULL'
            
            sentiment = ai_result.get('sentiment', 'neutral')
            confidence = float(ai_result.get('confidence', 0.0))
            
            sql = f"""
                INSERT INTO dwd_dash_social_comments_ai 
                (dwd_record_id, last_update, brand_label, author_name, channel, 
                 message_type, text, tags, post_link, sentiment, caption, 
                 upload_batch_id, original_row_index, dedupe_date, source_count,
                 ai_sentiment, ai_confidence, ai_processed_at, ai_processing_status, 
                 ai_model_version, ai_analysis_batch_id, created_at)
                VALUES (
                    {dwd_record['record_id']},
                    {format_datetime(dwd_record.get('last_update'))},
                    {escape_sql_string(dwd_record.get('brand_label'))},
                    {escape_sql_string(dwd_record.get('author_name'))},
                    {escape_sql_string(dwd_record.get('channel'))},
                    {escape_sql_string(dwd_record.get('message_type'))},
                    {escape_sql_string(dwd_record.get('text'))},
                    {escape_sql_string(dwd_record.get('tags'))},
                    {escape_sql_string(dwd_record.get('post_link'))},
                    {escape_sql_string(dwd_record.get('sentiment'))},
                    '',  
                    '',  
                    0,  
                    CURDATE(),  
                    1,  
                    {escape_sql_string(sentiment)},
                    {confidence},
                    NOW(),
                    'completed',
                    {escape_sql_string(self.ai_analyzer.model)},
                    {escape_sql_string(batch_id)},
                    NOW()
                )
            """
            
            self.db_config.execute_insert(sql)
            logger.debug(f"成功插入DWD_AI记录，dwd_record_id: {dwd_record['record_id']}")
            
        except Exception as e:
            logger.error(f"插入DWD_AI记录失败：{e}")
    
    def _update_single_record_failed(self, record_id: int, error_msg: str, batch_id: str):
        """更新单条记录为失败状态（只更新DWD表，不插入DWD_AI表）"""
        try:
            # 只更新DWD表的状态为failed
            sql = f"""
                UPDATE dwd_dash_social_comments SET
                    ai_processing_status = 'failed'
                WHERE record_id = {record_id}
            """
            
            self.db_config.execute_insert(sql)
            logger.debug(f"更新DWD记录 {record_id} 状态为failed")
            
        except Exception as e:
            logger.error(f"更新记录 {record_id} 失败状态失败：{e}")
    
    def retry_failed_analysis(self, batch_size: int = 50) -> Dict[str, Any]:
        """重试失败的AI分析记录（从DWD表重试）"""
        try:
            # 重置失败的记录状态为pending（从DWD表）
            sql = f"""
                UPDATE dwd_dash_social_comments 
                SET ai_processing_status = 'pending'
                WHERE ai_processing_status = 'failed' 
                LIMIT {batch_size}
            """
            
            affected_rows = self.db_config.execute_insert(sql)
            
            if affected_rows > 0:
                logger.info(f"重置 {affected_rows} 条失败记录为待处理状态")
                # 直接调用处理方法
                return self.process_pending_ai_analysis(batch_size)
            else:
                return {
                    'status': 'completed',
                    'message': '没有需要重试的失败记录',
                    'ai_service_available': self.ai_analyzer.is_available(),
                    'total_records': 0,
                    'processed_records': 0,
                    'success_records': 0,
                    'failed_records': 0
                }
                
        except Exception as e:
            error_msg = f"重试失败分析记录时出错：{str(e)}"
            logger.error(error_msg)
            return {
                'status': 'failed',
                'error': error_msg,
                'ai_service_available': self.ai_analyzer.is_available()
            }
    
    def get_ai_analysis_statistics(self) -> Dict[str, Any]:
        """获取AI分析统计信息（从DWD表获取状态统计，从DWD_AI表获取情感分析统计）"""
        try:
            # DWD表的AI处理状态统计
            total_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments"
            pending_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments WHERE ai_processing_status = 'pending'"
            processing_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments WHERE ai_processing_status = 'processing'"
            completed_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments WHERE ai_processing_status = 'completed'"
            failed_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments WHERE ai_processing_status = 'failed'"
            
            total_result = self.db_config.execute_query_dict(total_sql)
            pending_result = self.db_config.execute_query_dict(pending_sql)
            processing_result = self.db_config.execute_query_dict(processing_sql)
            completed_result = self.db_config.execute_query_dict(completed_sql)
            failed_result = self.db_config.execute_query_dict(failed_sql)
            
            stats = {
                'total_records': total_result[0]['count'] if total_result else 0,
                'pending_records': pending_result[0]['count'] if pending_result else 0,
                'processing_records': processing_result[0]['count'] if processing_result else 0,
                'completed_records': completed_result[0]['count'] if completed_result else 0,
                'failed_records': failed_result[0]['count'] if failed_result else 0,
                'ai_service_available': self.ai_analyzer.is_available()
            }
            
            # 情感分析统计
            sentiment_sql = """
                SELECT ai_sentiment, COUNT(*) as count 
                FROM dwd_dash_social_comments_ai 
                WHERE ai_processing_status = 'completed' AND ai_sentiment IS NOT NULL
                GROUP BY ai_sentiment
            """
            
            sentiment_result = self.db_config.execute_query_dict(sentiment_sql)
            sentiment_stats = {}
            if sentiment_result:
                for row in sentiment_result:
                    sentiment_stats[row['ai_sentiment']] = row['count']
            
            stats['sentiment_distribution'] = sentiment_stats
            
            return {
                'status': 'success',
                'statistics': stats
            }
            
        except Exception as e:
            logger.error(f"获取AI分析统计失败：{e}")
            return {
                'status': 'failed',
                'error': str(e)
            }
    
    def cleanup_old_analysis_data(self, days: int = 30) -> Dict[str, Any]:
        """清理旧的分析数据（可选功能）"""
        try:
            # 清理超过指定天数的失败记录的错误信息
            sql = f"""
                UPDATE dwd_dash_social_comments_ai 
                SET ai_error_message = ''
                WHERE ai_processing_status = 'failed' 
                  AND ai_processed_at < DATE_SUB(NOW(), INTERVAL {days} DAY)
                  AND ai_error_message != ''
            """
            
            affected_rows = self.db_config.execute_insert(sql)
            
            return {
                'status': 'completed',
                'message': f'清理了 {affected_rows} 条旧错误信息',
                'cleaned_records': affected_rows
            }
            
        except Exception as e:
            logger.error(f"清理旧分析数据失败：{e}")
            return {
                'status': 'failed',
                'error': str(e)
            }
