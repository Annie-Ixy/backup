# -*- coding: utf-8 -*-
"""
ETL处理器
实现ODS层到DWD层的数据处理，以及DWD层到DWD_AI层的数据流转
"""

import logging
import uuid
import hashlib
from datetime import datetime, date
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd

from models.new_dash_social_model import (
    ODSDashSocialComment, DWDDashSocialComment, DWDAIDashSocialComment, ETLProcessingLog
)
from config.database_config import get_db_config

logger = logging.getLogger(__name__)

class ETLProcessor:
    """ETL处理器 - 负责数据层间的处理和转换"""
    
    def __init__(self):
        self.db_config = get_db_config()
    
    def process_ods_to_dwd(self, batch_size: int = 1000, force_reprocess: bool = False) -> Dict[str, Any]:
        """
        ODS到DWD的ETL处理
        
        Args:
            batch_size: 批处理大小
            force_reprocess: 是否强制重新处理已处理的数据
            
        Returns:
            处理结果统计
        """
        try:
            # 生成处理批次ID
            batch_id = f"ods_to_dwd_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            # 创建ETL处理日志
            etl_log = ETLProcessingLog(
                process_type='ods_to_dwd',
                batch_id=batch_id,
                source_table='ods_dash_social_comments',
                target_table='dwd_dash_social_comments',
                start_time=datetime.now(),
                status='processing'
            )
            
            self._save_etl_log(etl_log)
            
            # 1. 获取待处理的ODS数据
            condition = "processed_flag = 0" if not force_reprocess else "1=1"
            ods_data = self._fetch_ods_data(condition, batch_size)
            
            if not ods_data:
                etl_log.status = 'completed'
                etl_log.end_time = datetime.now()
                etl_log.total_source_records = 0
                etl_log.processed_records = 0
                etl_log.success_records = 0
                self._update_etl_log(etl_log)
                
                return {
                    'batch_id': batch_id,
                    'status': 'completed',
                    'message': '没有待处理的ODS数据',
                    'total_source_records': 0,
                    'processed_records': 0,
                    'success_records': 0,
                    'failed_records': 0,
                    'duplicate_records': 0
                }
            
            etl_log.total_source_records = len(ods_data)
            
            # 2. 数据去重处理
            dwd_records, stats = self._deduplicate_ods_data(ods_data)
            
            # 3. 保存到DWD表
            success_count, failed_count = self._save_dwd_records(dwd_records, batch_id)
            
            # 4. 更新ODS处理标记
            processed_ods_ids = [record['record_id'] for record in ods_data]
            self._mark_ods_processed(processed_ods_ids)
            
            # 5. 更新ETL日志
            etl_log.status = 'completed' if failed_count == 0 else 'partial'
            etl_log.end_time = datetime.now()
            etl_log.duration_seconds = int((etl_log.end_time - etl_log.start_time).total_seconds())
            etl_log.processed_records = len(dwd_records)
            etl_log.success_records = success_count
            etl_log.failed_records = failed_count
            etl_log.duplicate_records = stats['duplicate_count']
            etl_log.filtered_empty_text_records = stats.get('filtered_empty_text', 0)
            etl_log.filtered_invalid_date_records = stats.get('filtered_invalid_date', 0)
            
            self._update_etl_log(etl_log)
            
            result = {
                'batch_id': batch_id,
                'status': etl_log.status,
                'message': f'ETL处理完成：成功{success_count}条，失败{failed_count}条，去重{stats["duplicate_count"]}条，过滤text为空{stats.get("filtered_empty_text", 0)}条，过滤时间无效{stats.get("filtered_invalid_date", 0)}条',
                'total_source_records': etl_log.total_source_records,
                'processed_records': etl_log.processed_records,
                'success_records': success_count,
                'failed_records': failed_count,
                'duplicate_records': stats['duplicate_count'],
                'filtered_empty_text_records': stats.get('filtered_empty_text', 0),
                'filtered_invalid_date_records': stats.get('filtered_invalid_date', 0),
                'duration_seconds': etl_log.duration_seconds
            }
            
            logger.info(f"ODS到DWD处理完成：{result}")
            return result
            
        except Exception as e:
            error_msg = f"ODS到DWD处理失败：{str(e)}"
            logger.error(error_msg)
            
            # 更新失败状态
            if 'etl_log' in locals():
                etl_log.status = 'failed'
                etl_log.error_message = error_msg
                etl_log.end_time = datetime.now()
                self._update_etl_log(etl_log)
            
            return {
                'batch_id': batch_id if 'batch_id' in locals() else 'unknown',
                'status': 'failed',
                'error': error_msg
            }
    
    def _fetch_ods_data(self, condition: str, limit: int) -> List[Dict[str, Any]]:
        """获取ODS数据 - 获取所有原始数据，验证由ETL过程负责"""
        try:
            sql = f"""
                SELECT record_id, last_update, brand_label, author_name, channel, 
                       message_type, text, tags, post_link, sentiment, caption, 
                       upload_batch_id, original_row_index, processed_at, created_at
                FROM ods_dash_social_comments 
                WHERE {condition}
                ORDER BY record_id ASC
                LIMIT {limit}
            """
            
            result = self.db_config.execute_query_dict(sql)
            logger.info(f"获取到 {len(result) if result else 0} 条ODS原始数据")
            
            return result or []
            
        except Exception as e:
            logger.error(f"获取ODS数据失败：{e}")
            return []
    
    def _clean_datetime_field(self, series: pd.Series) -> pd.Series:
        """
        ETL层时间字段清洗：严格验证和转换时间格式
        无效时间将被设置为None，由后续流程过滤
        
        Args:
            series: pandas Series包含时间数据
            
        Returns:
            清洗后的Series，无效时间为None
        """
        import re
        
        def is_valid_datetime_format(value):
            """检查是否为有效的日期时间格式"""
            if pd.isna(value) or value is None:
                return False
                
            value_str = str(value).strip()
            if not value_str or value_str.lower() in ['nan', 'none', '', 'null']:
                return False
            
            # 定义有效的日期时间格式正则表达式
            valid_patterns = [
                # 完整日期时间格式
                r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2}$',  # 2024-01-01 12:34:56
                r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{1,2}$',           # 2024-01-01 12:34
                r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}$',                              # 2024-01-01
                # 允许的其他格式
                r'^\d{1,2}[-/]\d{1,2}[-/]\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}$',  # 01-01-2024 12:34:56
                r'^\d{1,2}[-/]\d{1,2}[-/]\d{4}\s+\d{1,2}:\d{1,2}$',           # 01-01-2024 12:34
                r'^\d{1,2}[-/]\d{1,2}[-/]\d{4}$',                              # 01-01-2024
            ]
            
            # 检查是否匹配任一有效格式
            for pattern in valid_patterns:
                if re.match(pattern, value_str):
                    return True
            
            # 特别排除明显错误的格式
            invalid_patterns = [
                r'^\d{1,2}:\d{1,2}[\.,]\d+$',  # 15:22.1, 03:13.6 等格式
                r'^\d{1,2}:\d{1,2}$',          # 仅时分格式 15:22
                r'^\d{1,2}[\.,]\d+$',          # 仅数字格式 25.10.9
            ]
            
            for pattern in invalid_patterns:
                if re.match(pattern, value_str):
                    return False
            
            return False
        
        cleaned_series = series.copy()
        invalid_count = 0
        
        # ETL层：严格验证，无效数据设为None
        for idx in series.index:
            value = series.iloc[idx] if idx < len(series) else None
            
            if not is_valid_datetime_format(value):
                cleaned_series.iloc[idx] = None
                invalid_count += 1
            else:
                # 对有效格式尝试转换
                try:
                    converted = pd.to_datetime(value, errors='raise')
                    cleaned_series.iloc[idx] = converted
                except:
                    # 转换失败则设为空
                    cleaned_series.iloc[idx] = None
                    invalid_count += 1
        
        if invalid_count > 0:
            logger.info(f"ETL时间字段清洗：过滤掉 {invalid_count} 条格式无效的时间数据")
        
        return cleaned_series
    
    def _clean_data_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """ETL层数据类型清洗和转换"""
        # 处理时间字段
        if 'last_update' in df.columns:
            df['last_update'] = self._clean_datetime_field(df['last_update'])
        
        # 处理文本字段（去除空格、换行等）
        text_fields = ['text', 'author_name', 'channel', 'brand_label', 'tags', 'caption']
        for field in text_fields:
            if field in df.columns:
                df[field] = df[field].astype(str).str.strip()
                df[field] = df[field].replace('nan', '')
                df[field] = df[field].replace('None', '')
        
        # 处理数值字段
        if 'original_row_index' in df.columns:
            df['original_row_index'] = pd.to_numeric(df['original_row_index'], errors='coerce').fillna(0).astype(int)
        
        return df
    
    def _validate_required_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """ETL层必填字段验证（严格验证）"""
        original_count = len(df)
        
        # 移除文本内容为空的记录
        if 'text' in df.columns:
            df = df[(df['text'].notna()) & (df['text'].str.len() > 0) & (df['text'] != 'nan')]
        
        # 移除作者名称为空的记录
        if 'author_name' in df.columns:
            df = df[(df['author_name'].notna()) & (df['author_name'].str.len() > 0) & (df['author_name'] != 'nan')]
        
        # 移除渠道为空的记录
        if 'channel' in df.columns:
            df = df[(df['channel'].notna()) & (df['channel'].str.len() > 0) & (df['channel'] != 'nan')]
        
        filtered_count = len(df)
        if filtered_count < original_count:
            logger.info(f"ETL必填字段验证: 从 {original_count} 行过滤为 {filtered_count} 行")
        
        return df
    
    def _deduplicate_ods_data(self, ods_data: List[Dict[str, Any]]) -> Tuple[List[DWDDashSocialComment], Dict[str, Any]]:
        """
        ETL层数据处理：清洗、验证、去重
        
        处理流程：
        1. 数据类型清洗和转换（时间格式、文本处理）
        2. 必填字段验证（text、author_name、channel）
        3. 去重处理：基于DATE(last_update) + brand_label + author_name + channel + text分组，
                   保留last_update时分秒最晚的记录
        """
        try:
            if not ods_data:
                return [], {'duplicate_count': 0, 'unique_groups': 0, 'filtered_empty_text': 0, 'filtered_invalid_date': 0}
            
            # 转换为DataFrame便于处理
            df = pd.DataFrame(ods_data)
            original_count = len(df)
            
            # 1. 数据类型清洗和转换
            df_cleaned = self._clean_data_types(df.copy())
            
            # 2. 必填字段验证
            df_validated = self._validate_required_fields(df_cleaned)
            
            # 3. 时间字段最终验证（已在_clean_data_types中处理，这里只过滤None值）
            df_valid_date = df_validated[df_validated['last_update'].notna()].copy()
            
            # 计算过滤统计
            filtered_empty_text_count = original_count - len(df_validated)
            filtered_invalid_date_count = len(df_validated) - len(df_valid_date)
            
            logger.info(f"ETL数据清洗统计：原始{original_count}条 → 字段验证后{len(df_validated)}条 → 时间验证后{len(df_valid_date)}条")
            
            if df_valid_date.empty:
                return [], {
                    'duplicate_count': 0, 
                    'unique_groups': 0, 
                    'filtered_empty_text': filtered_empty_text_count,
                    'filtered_invalid_date': filtered_invalid_date_count
                }
            
            # 生成去重日期
            df_valid_date['dedupe_date'] = df_valid_date['last_update'].dt.date
            
            # 填充空值（除了text和last_update字段，因为已经过滤过了）
            df_valid_date = df_valid_date.fillna('')
            
            # 按去重规则分组
            group_columns = ['dedupe_date', 'brand_label', 'author_name', 'channel', 'text']
            
            # 对每组数据按last_update排序，保留最晚的记录
            df_sorted = df_valid_date.sort_values('last_update', ascending=False)
            df_deduped = df_sorted.groupby(group_columns).first().reset_index()
            
            # 计算统计信息
            valid_count = len(df_valid_date)
            unique_count = len(df_deduped)
            duplicate_count = valid_count - unique_count
            
            # 转换为DWD记录
            dwd_records = []
            for _, row in df_deduped.iterrows():
                # 生成去重键
                dedupe_key = self._generate_dedupe_key(
                    row['dedupe_date'], row['brand_label'], 
                    row['author_name'], row['channel'], row['text']
                )
                
                # 检查DWD表中是否已存在（避免重复插入）
                existing_record = self._check_dwd_exists(dedupe_key)
                if existing_record:
                    continue  # 跳过已存在的记录
                
                dwd_record = DWDDashSocialComment(
                    source_record_id=int(row['record_id']),
                    last_update=row['last_update'],
                    brand_label=str(row['brand_label']),
                    author_name=str(row['author_name']),
                    channel=str(row['channel']),
                    message_type=str(row['message_type']),
                    text=str(row['text']),
                    tags=str(row['tags']),
                    post_link=str(row['post_link']),
                    sentiment=str(row['sentiment']),
                    caption=str(row['caption']),
                    upload_batch_id=str(row['upload_batch_id']),
                    original_row_index=int(row['original_row_index']),
                    dedupe_date=row['dedupe_date'],
                    dedupe_key=dedupe_key,
                    is_latest_in_group=1,
                    source_count=1,  # 可以后续优化为计算实际合并的记录数
                    ai_processing_status="pending",  # 新增：AI处理状态，默认为pending
                    processed_at=datetime.now()
                )
                
                dwd_records.append(dwd_record)
            
            stats = {
                'original_count': original_count,
                'valid_count': valid_count,
                'unique_count': len(dwd_records),  # 实际要插入的记录数
                'duplicate_count': duplicate_count,
                'filtered_empty_text': filtered_empty_text_count,
                'filtered_invalid_date': filtered_invalid_date_count,
                'skipped_existing': unique_count - len(dwd_records)  # 跳过的已存在记录
            }
            
            logger.info(f"去重处理完成：原始{original_count}条 → 过滤text为空{filtered_empty_text_count}条 → 过滤时间无效{filtered_invalid_date_count}条 → 去重后{unique_count}条 → 新增{len(dwd_records)}条")
            
            return dwd_records, stats
            
        except Exception as e:
            logger.error(f"数据去重失败：{e}")
            return [], {
                'duplicate_count': 0, 
                'unique_groups': 0, 
                'filtered_empty_text': 0,
                'filtered_invalid_date': 0,
                'original_count': 0,
                'valid_count': 0
            }
    
    def _generate_dedupe_key(self, dedupe_date: date, brand_label: str, 
                           author_name: str, channel: str, text: str) -> str:
        """生成去重键"""
        # 创建唯一标识字符串
        key_string = f"{dedupe_date}|{brand_label}|{author_name}|{channel}|{text[:200]}"
        
        # 生成MD5哈希（避免键过长）
        return hashlib.md5(key_string.encode('utf-8')).hexdigest()
    
    def _check_dwd_exists(self, dedupe_key: str) -> bool:
        """检查DWD表中是否已存在该去重键的记录"""
        try:
            sql = f"SELECT COUNT(*) as count FROM dwd_dash_social_comments WHERE dedupe_key = '{dedupe_key}'"
            result = self.db_config.execute_query_dict(sql)
            
            return result[0]['count'] > 0 if result else False
            
        except Exception as e:
            logger.error(f"检查DWD记录存在性失败：{e}")
            return False
    
    def _save_dwd_records(self, dwd_records: List[DWDDashSocialComment], batch_id: str) -> Tuple[int, int]:
        """保存DWD记录到数据库"""
        success_count = 0
        failed_count = 0
        
        try:
            for record in dwd_records:
                try:
                    sql = self._build_dwd_insert_sql(record)
                    self.db_config.execute_insert(sql)
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"保存DWD记录失败：{e}")
                    failed_count += 1
                    continue
            
            logger.info(f"DWD记录保存完成：成功{success_count}条，失败{failed_count}条")
            return success_count, failed_count
            
        except Exception as e:
            logger.error(f"批量保存DWD记录失败：{e}")
            return success_count, failed_count
    
    def _build_dwd_insert_sql(self, record: DWDDashSocialComment) -> str:
        """构建DWD插入SQL"""
        import pandas as pd
        
        def escape_sql_string(s):
            if s is None:
                return 'NULL'
            return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"
        
        def format_datetime(dt):
            if dt is None or pd.isna(dt):
                return 'NULL'
            if isinstance(dt, str):
                return f"'{dt}'"
            try:
                return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
            except (AttributeError, ValueError):
                return 'NULL'
        
        def format_date(dt):
            if dt is None or pd.isna(dt):
                return 'NULL'
            if isinstance(dt, str):
                return f"'{dt}'"
            try:
                return f"'{dt.strftime('%Y-%m-%d')}'"
            except (AttributeError, ValueError):
                return 'NULL'
        
        sql = f"""
            INSERT INTO dwd_dash_social_comments 
            (source_record_id, last_update, brand_label, author_name, channel, 
             message_type, text, tags, post_link, sentiment, caption, 
             upload_batch_id, original_row_index, dedupe_date, dedupe_key, 
             is_latest_in_group, source_count, ai_processing_status, 
             extreme_negative_processing_status, processed_at, created_at)
            VALUES (
                {record.source_record_id},
                {format_datetime(record.last_update)},
                {escape_sql_string(record.brand_label)},
                {escape_sql_string(record.author_name)},
                {escape_sql_string(record.channel)},
                {escape_sql_string(record.message_type)},
                {escape_sql_string(record.text)},
                {escape_sql_string(record.tags)},
                {escape_sql_string(record.post_link)},
                {escape_sql_string(record.sentiment)},
                {escape_sql_string(record.caption)},
                {escape_sql_string(record.upload_batch_id)},
                {record.original_row_index},
                {format_date(record.dedupe_date)},
                {escape_sql_string(record.dedupe_key)},
                {record.is_latest_in_group},
                {record.source_count},
                {escape_sql_string(record.ai_processing_status)},
                {escape_sql_string(record.extreme_negative_processing_status)},
                {format_datetime(record.processed_at)},
                NOW()
            )
        """
        
        return sql
    
    def _mark_ods_processed(self, record_ids: List[int]):
        """标记ODS记录为已处理"""
        try:
            if not record_ids:
                return
            
            ids_str = ','.join(map(str, record_ids))
            sql = f"UPDATE ods_dash_social_comments SET processed_flag = 1 WHERE record_id IN ({ids_str})"
            
            self.db_config.execute_insert(sql)
            logger.info(f"标记 {len(record_ids)} 条ODS记录为已处理")
            
        except Exception as e:
            logger.error(f"标记ODS记录处理状态失败：{e}")
    
    def process_dwd_to_ai(self, batch_size: int = 500) -> Dict[str, Any]:
        """
        DWD到DWD_AI的数据准备（不包含AI分析）
        
        Args:
            batch_size: 批处理大小
            
        Returns:
            处理结果统计
        """
        try:
            # 生成处理批次ID
            batch_id = f"dwd_to_ai_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            # 创建ETL处理日志
            etl_log = ETLProcessingLog(
                process_type='dwd_to_ai',
                batch_id=batch_id,
                source_table='dwd_dash_social_comments',
                target_table='dwd_dash_social_comments_ai',
                start_time=datetime.now(),
                status='processing'
            )
            
            self._save_etl_log(etl_log)
            
            # 1. 获取DWD中未同步到AI表的数据
            dwd_data = self._fetch_unsynced_dwd_data(batch_size)
            
            if not dwd_data:
                etl_log.status = 'completed'
                etl_log.end_time = datetime.now()
                etl_log.total_source_records = 0
                etl_log.processed_records = 0
                etl_log.success_records = 0
                self._update_etl_log(etl_log)
                
                return {
                    'batch_id': batch_id,
                    'status': 'completed',
                    'message': '没有待同步的DWD数据',
                    'total_source_records': 0,
                    'processed_records': 0,
                    'success_records': 0,
                    'failed_records': 0
                }
            
            etl_log.total_source_records = len(dwd_data)
            
            # 2. 转换为AI记录并保存（不做AI分析）
            success_count, failed_count = self._save_ai_records_from_dwd(dwd_data, batch_id)
            
            # 3. 更新ETL日志
            etl_log.status = 'completed' if failed_count == 0 else 'partial'
            etl_log.end_time = datetime.now()
            etl_log.duration_seconds = int((etl_log.end_time - etl_log.start_time).total_seconds())
            etl_log.processed_records = len(dwd_data)
            etl_log.success_records = success_count
            etl_log.failed_records = failed_count
            
            self._update_etl_log(etl_log)
            
            result = {
                'batch_id': batch_id,
                'status': etl_log.status,
                'message': f'DWD到AI同步完成：成功{success_count}条，失败{failed_count}条',
                'total_source_records': etl_log.total_source_records,
                'processed_records': etl_log.processed_records,
                'success_records': success_count,
                'failed_records': failed_count,
                'duration_seconds': etl_log.duration_seconds
            }
            
            logger.info(f"DWD到AI处理完成：{result}")
            return result
            
        except Exception as e:
            error_msg = f"DWD到AI处理失败：{str(e)}"
            logger.error(error_msg)
            
            # 更新失败状态
            if 'etl_log' in locals():
                etl_log.status = 'failed'
                etl_log.error_message = error_msg
                etl_log.end_time = datetime.now()
                self._update_etl_log(etl_log)
            
            return {
                'batch_id': batch_id if 'batch_id' in locals() else 'unknown',
                'status': 'failed',
                'error': error_msg
            }
    
    def _fetch_unsynced_dwd_data(self, limit: int) -> List[Dict[str, Any]]:
        """获取未同步到AI表的DWD数据（只处理AI分析和极端负面分析都已完成的记录）"""
        try:
            sql = f"""
                SELECT d.* FROM dwd_dash_social_comments d
                LEFT JOIN dwd_dash_social_comments_ai ai ON d.record_id = ai.dwd_record_id
                WHERE ai.dwd_record_id IS NULL 
                  AND d.ai_processing_status = 'completed'
                  AND d.extreme_negative_processing_status = 'completed'
                ORDER BY d.record_id ASC
                LIMIT {limit}
            """
            
            result = self.db_config.execute_query_dict(sql)
            logger.info(f"获取到 {len(result) if result else 0} 条未同步的已完成AI分析的DWD数据")
            
            return result or []
            
        except Exception as e:
            logger.error(f"获取未同步DWD数据失败：{e}")
            return []
    
    def _save_ai_records_from_dwd(self, dwd_data: List[Dict[str, Any]], batch_id: str) -> Tuple[int, int]:
        """从DWD数据创建AI记录（包含AI分析结果和极端负面分析结果）"""
        success_count = 0
        failed_count = 0
        
        try:
            for dwd_record in dwd_data:
                try:
                    # 判断是否为极端负面评论
                    is_extremely_negative = False
                    if dwd_record.get('ai_sentiment') == 'negative':
                        # 重新进行极端负面检测（基于DWD中的AI结果）
                        from services.ai_sentiment_analyzer import AISentimentAnalyzer
                        analyzer = AISentimentAnalyzer()
                        is_extremely_negative = analyzer.analyze_extreme_negative(
                            dwd_record.get('text', ''), 
                            dwd_record.get('ai_sentiment', '')
                        )
                    
                    # 创建AI记录（继承DWD数据和AI分析结果）
                    ai_record = DWDAIDashSocialComment(
                        dwd_record_id=dwd_record['record_id'],
                        last_update=dwd_record['last_update'],
                        brand_label=dwd_record['brand_label'],
                        author_name=dwd_record['author_name'],
                        channel=dwd_record['channel'],
                        message_type=dwd_record['message_type'],
                        text=dwd_record['text'],
                        tags=dwd_record['tags'],
                        post_link=dwd_record['post_link'],
                        sentiment=dwd_record['sentiment'],
                        caption=dwd_record['caption'],
                        upload_batch_id=dwd_record['upload_batch_id'],
                        original_row_index=dwd_record['original_row_index'],
                        dedupe_date=dwd_record['dedupe_date'],
                        source_count=dwd_record['source_count'],
                        # AI分析结果（从DWD表继承）
                        ai_sentiment=dwd_record.get('ai_sentiment', 'neutral'),
                        ai_confidence=dwd_record.get('ai_confidence', 0.0),
                        ai_processed_at=dwd_record.get('ai_processed_at'),
                        ai_processing_status='completed',  # 已完成
                        ai_analysis_batch_id=batch_id,
                        # 极端负面分析结果
                        extremely_negative=is_extremely_negative
                    )
                    
                    sql = self._build_ai_insert_sql(ai_record)
                    self.db_config.execute_insert(sql)
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"保存AI记录失败：{e}")
                    failed_count += 1
                    continue
            
            logger.info(f"AI记录保存完成：成功{success_count}条，失败{failed_count}条")
            return success_count, failed_count
            
        except Exception as e:
            logger.error(f"批量保存AI记录失败：{e}")
            return success_count, failed_count
    
    def _build_ai_insert_sql(self, record: DWDAIDashSocialComment) -> str:
        """构建AI表插入SQL"""
        import pandas as pd
        
        def escape_sql_string(s):
            if s is None:
                return 'NULL'
            return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"
        
        def format_datetime(dt):
            if dt is None or pd.isna(dt):
                return 'NULL'
            if isinstance(dt, str):
                return f"'{dt}'"
            try:
                return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
            except (AttributeError, ValueError):
                return 'NULL'
        
        def format_date(dt):
            if dt is None or pd.isna(dt):
                return 'NULL'
            if isinstance(dt, str):
                return f"'{dt}'"
            try:
                return f"'{dt.strftime('%Y-%m-%d')}'"
            except (AttributeError, ValueError):
                return 'NULL'
        
        sql = f"""
            INSERT IGNORE INTO dwd_dash_social_comments_ai 
            (dwd_record_id, last_update, brand_label, author_name, channel, 
             message_type, text, tags, post_link, sentiment, caption, 
             upload_batch_id, original_row_index, dedupe_date, source_count,
             ai_sentiment, ai_confidence, ai_processed_at, ai_processing_status, 
             ai_analysis_batch_id, extremely_negative, created_at)
            VALUES (
                {record.dwd_record_id},
                {format_datetime(record.last_update)},
                {escape_sql_string(record.brand_label)},
                {escape_sql_string(record.author_name)},
                {escape_sql_string(record.channel)},
                {escape_sql_string(record.message_type)},
                {escape_sql_string(record.text)},
                {escape_sql_string(record.tags)},
                {escape_sql_string(record.post_link)},
                {escape_sql_string(record.sentiment)},
                {escape_sql_string(record.caption)},
                {escape_sql_string(record.upload_batch_id)},
                {record.original_row_index},
                {format_date(record.dedupe_date)},
                {record.source_count},
                {escape_sql_string(record.ai_sentiment)},
                {record.ai_confidence if record.ai_confidence is not None else 'NULL'},
                {format_datetime(record.ai_processed_at)},
                {escape_sql_string(record.ai_processing_status)},
                {escape_sql_string(record.ai_analysis_batch_id)},
                {1 if record.extremely_negative else 0},
                NOW()
            )
        """
        
        return sql
    
    def _save_etl_log(self, etl_log: ETLProcessingLog):
        """保存ETL处理日志"""
        try:
            sql = f"""
                INSERT INTO dwd_etl_processing_log 
                (batch_id, step_name, total_source_records, processed_records, 
                 success_records, failed_records, duplicate_records, 
                 filtered_empty_text_records, filtered_invalid_date_records, 
                 start_time, status)
                VALUES (
                    '{etl_log.batch_id}', '{etl_log.process_type}',
                    {etl_log.total_source_records}, {etl_log.processed_records}, 
                    {etl_log.success_records}, {etl_log.failed_records}, 
                    {etl_log.duplicate_records}, {etl_log.filtered_empty_text_records},
                    {etl_log.filtered_invalid_date_records},
                    '{etl_log.start_time.strftime('%Y-%m-%d %H:%M:%S')}', 
                    '{etl_log.status}'
                )
            """
            self.db_config.execute_insert(sql)
            
        except Exception as e:
            logger.error(f"保存ETL日志失败：{e}")
    
    def _update_etl_log(self, etl_log: ETLProcessingLog):
        """更新ETL处理日志"""
        try:
            end_time_str = f"'{etl_log.end_time.strftime('%Y-%m-%d %H:%M:%S')}'" if etl_log.end_time else 'NULL'
            duration_str = str(etl_log.duration_seconds) if etl_log.duration_seconds else 'NULL'
            
            sql = f"""
                UPDATE dwd_etl_processing_log SET
                    total_source_records = {etl_log.total_source_records},
                    processed_records = {etl_log.processed_records},
                    success_records = {etl_log.success_records},
                    failed_records = {etl_log.failed_records},
                    duplicate_records = {etl_log.duplicate_records},
                    filtered_empty_text_records = {etl_log.filtered_empty_text_records},
                    filtered_invalid_date_records = {etl_log.filtered_invalid_date_records},
                    end_time = {end_time_str},
                    duration_seconds = {duration_str},
                    status = '{etl_log.status}',
                    error_message = '{etl_log.error_message.replace("'", "''") if etl_log.error_message else ""}'
                WHERE batch_id = '{etl_log.batch_id}'
            """
            
            self.db_config.execute_insert(sql)
            
        except Exception as e:
            logger.error(f"更新ETL日志失败：{e}")
    
    def get_etl_status(self) -> Dict[str, Any]:
        """获取ETL处理状态统计"""
        try:
            # 获取各层数据统计
            ods_count_sql = "SELECT COUNT(*) as count FROM ods_dash_social_comments"
            dwd_count_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments"
            ai_count_sql = "SELECT COUNT(*) as count FROM dwd_dash_social_comments_ai"
            
            ods_result = self.db_config.execute_query_dict(ods_count_sql)
            dwd_result = self.db_config.execute_query_dict(dwd_count_sql)
            ai_result = self.db_config.execute_query_dict(ai_count_sql)
            
            ods_count = ods_result[0]['count'] if ods_result else 0
            dwd_count = dwd_result[0]['count'] if dwd_result else 0
            ai_count = ai_result[0]['count'] if ai_result else 0
            
            # 获取待处理数据统计
            pending_ods_sql = "SELECT COUNT(*) as count FROM ods_dash_social_comments WHERE processed_flag = 0"
            pending_dwd_sql = """
                SELECT COUNT(*) as count FROM dwd_dash_social_comments d
                LEFT JOIN dwd_dash_social_comments_ai ai ON d.record_id = ai.dwd_record_id
                WHERE ai.dwd_record_id IS NULL
            """
            
            pending_ods_result = self.db_config.execute_query_dict(pending_ods_sql)
            pending_dwd_result = self.db_config.execute_query_dict(pending_dwd_sql)
            
            pending_ods_count = pending_ods_result[0]['count'] if pending_ods_result else 0
            pending_dwd_count = pending_dwd_result[0]['count'] if pending_dwd_result else 0
            
            # 获取最近的ETL日志
            recent_logs_sql = """
                SELECT step_name as process_type, batch_id, status, start_time, end_time, 
                       success_records, failed_records, duplicate_records,
                       filtered_empty_text_records, filtered_invalid_date_records, error_message
                FROM dwd_etl_processing_log 
                ORDER BY start_time DESC 
                LIMIT 10
            """
            
            recent_logs_result = self.db_config.execute_query_dict(recent_logs_sql)
            
            return {
                'data_counts': {
                    'ods_total': ods_count,
                    'dwd_total': dwd_count,
                    'ai_total': ai_count,
                    'pending_ods_to_dwd': pending_ods_count,
                    'pending_dwd_to_ai': pending_dwd_count
                },
                'recent_logs': recent_logs_result or [],
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"获取ETL状态失败：{e}")
            return {'error': str(e)}
    
    def run_full_etl_pipeline(self, batch_size: int = 1000) -> Dict[str, Any]:
        """运行完整的ETL流水线"""
        try:
            results = []
            
            # 1. ODS → DWD
            logger.info("开始执行 ODS → DWD 处理...")
            ods_to_dwd_result = self.process_ods_to_dwd(batch_size)
            results.append({
                'step': 'ods_to_dwd',
                'result': ods_to_dwd_result
            })
            
            # 2. DWD → DWD_AI（数据同步，不包含AI分析）
            logger.info("开始执行 DWD → DWD_AI 同步...")
            dwd_to_ai_result = self.process_dwd_to_ai(batch_size // 2)
            results.append({
                'step': 'dwd_to_ai',
                'result': dwd_to_ai_result
            })
            
            # 3. 生成总体报告
            # 注意：这里统计的是各阶段处理的记录数，而非最终数据记录数
            ods_to_dwd_success = results[0]['result'].get('success_records', 0)
            dwd_to_ai_success = results[1]['result'].get('success_records', 0) if len(results) > 1 else 0
            
            total_failed = sum(r['result'].get('failed_records', 0) for r in results)
            
            pipeline_result = {
                'pipeline_status': 'completed',
                'steps': results,
                'ods_to_dwd_success': ods_to_dwd_success,
                'dwd_to_ai_success': dwd_to_ai_success,
                'total_processing_operations': ods_to_dwd_success + dwd_to_ai_success,  # 更准确的描述
                'total_failed_records': total_failed,
                'message': f'ETL流水线执行完成：DWD新增{ods_to_dwd_success}条，AI同步{dwd_to_ai_success}条，失败{total_failed}条'
            }
            
            logger.info(f"完整ETL流水线执行完成：{pipeline_result}")
            return pipeline_result
            
        except Exception as e:
            error_msg = f"ETL流水线执行失败：{str(e)}"
            logger.error(error_msg)
            return {
                'pipeline_status': 'failed',
                'error': error_msg,
                'steps': results if 'results' in locals() else []
            }
