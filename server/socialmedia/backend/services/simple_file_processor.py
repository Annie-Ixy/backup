# -*- coding: utf-8 -*-
"""
简化的文件处理器
专注于ODS层数据接收，不做去重和AI分析
"""

import os
import logging
import pandas as pd
import uuid
from datetime import datetime
from typing import Tuple, Dict, Any, List
from pathlib import Path

from models.new_dash_social_model import ODSDashSocialComment, FileUploadLog
from config.database_config import get_db_config
from utils.csv_helper import CSVHelper

logger = logging.getLogger(__name__)

class SimpleFileProcessor:
    """简化的文件处理器 - 只负责ODS层数据接收"""
    
    def __init__(self):
        self.db_config = get_db_config()
        self.supported_formats = ['.xlsx', '.xls', '.csv']
        
        # 预期的列名映射（支持中英文）
        self.column_mapping = {
            # 英文列名
            'last_update': 'last_update',
            'brand_label': 'brand_label', 
            'author_name': 'author_name',
            'channel': 'channel',
            'message_type': 'message_type',
            'text': 'text',
            'tags': 'tags',
            'post_link': 'post_link',
            'sentiment': 'sentiment',
            'caption': 'caption',
            
            # 中文列名映射
            '最后更新时间': 'last_update',
            '品牌标签': 'brand_label',
            '作者名称': 'author_name',
            '渠道': 'channel',
            '平台': 'channel',
            '消息类型': 'message_type',
            '文本内容': 'text',
            '内容': 'text',
            '评论内容': 'text',
            '标签': 'tags',
            '帖子链接': 'post_link',
            '链接': 'post_link',
            '情感标签': 'sentiment',
            '情感': 'sentiment',
            '标题': 'caption',
            '说明': 'caption',
            '标题说明': 'caption'
        }
        
        # 添加位置映射（用于处理无标题或标题不匹配的情况）
        self.position_mapping = {
            0: 'last_update',      # 第一列通常是时间
            1: 'brand_label',      # 第二列通常是品牌
            2: 'author_name',      # 第三列通常是作者
            3: 'channel',          # 第四列通常是渠道
            4: 'message_type',     # 第五列通常是消息类型
            5: 'text',             # 第六列通常是文本内容
        }
    
    def validate_file(self, file_path: str) -> Tuple[bool, str]:
        """
        验证文件
        """
        try:
            # 检查文件是否存在
            if not os.path.exists(file_path):
                return False, "文件不存在"
            
            # 检查文件格式
            file_extension = Path(file_path).suffix.lower()
            if file_extension not in self.supported_formats:
                return False, f"不支持的文件格式：{file_extension}，支持的格式：{', '.join(self.supported_formats)}"
            
            # 检查文件大小（限制100MB）
            file_size = os.path.getsize(file_path)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                return False, f"文件大小超过限制（{max_size / 1024 / 1024:.0f}MB）"
            
            return True, "文件验证通过"
            
        except Exception as e:
            return False, f"文件验证失败：{str(e)}"
    
    def read_file(self, file_path: str) -> Tuple[pd.DataFrame, str]:
        """
        读取文件数据
        """
        try:
            file_extension = Path(file_path).suffix.lower()
            
            if file_extension in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path, engine='openpyxl')
            elif file_extension == '.csv':
                # 增强的CSV文件编码检测
                df = self._read_csv_with_encoding_detection(file_path)
                if df is None:
                    return None, "CSV文件读取失败"
            else:
                return None, f"不支持的文件格式：{file_extension}"
            
            if df is not None and not df.empty:
                logger.info(f"成功读取文件：{file_path}，共 {len(df)} 行")
                return df, ""
            else:
                return None, "文件为空或无法读取有效数据"
            
        except Exception as e:
            error_msg = f"读取文件失败：{str(e)}"
            logger.error(error_msg)
            return None, error_msg
    
    def _read_csv_with_encoding_detection(self, file_path: str) -> pd.DataFrame:
        """
        使用CSV助手进行增强的CSV文件读取
        """
        try:
            # 优先使用简单读取方法
            df, error_msg = CSVHelper.read_csv_simple(file_path)
            
            if df is not None:
                logger.info(f"使用简单CSV读取成功: {file_path}")
                return df
            
            # 如果简单方法失败，尝试健壮方法
            logger.warning("简单CSV读取失败，尝试健壮读取方法")
            df, error_msg = CSVHelper.read_csv_robust(file_path)
            
            if df is not None:
                logger.info(f"使用健壮CSV读取成功: {file_path}")
                return df
            else:
                logger.error(f"所有CSV读取方法都失败: {error_msg}")
                raise Exception(error_msg)
                
        except Exception as e:
            logger.error(f"CSV文件读取失败: {e}")
            raise e
    
    def clean_and_standardize_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        数据清洗和标准化
        """
        try:
            # 创建副本避免修改原数据
            df_cleaned = df.copy()
            
            # 1. 列名标准化（映射中英文列名）
            df_cleaned = self._standardize_columns(df_cleaned)
            
            # 2. 数据类型转换和清洗
            df_cleaned = self._clean_data_types(df_cleaned)
            
            # 3. 必填字段检查
            df_cleaned = self._validate_required_fields(df_cleaned)
            
            logger.info(f"数据清洗完成：从 {len(df)} 行清洗为 {len(df_cleaned)} 行")
            return df_cleaned
            
        except Exception as e:
            logger.error(f"数据清洗失败：{e}")
            # 返回空DataFrame而不是抛出异常
            return pd.DataFrame()
    
    def _standardize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """标准化列名（包含位置映射）"""
        logger.info(f"原始列名: {df.columns.tolist()}")
        
        # 创建新的列名映射
        new_columns = {}
        mapped_standard_cols = set()  # 跟踪已映射的标准列名
        
        for i, col in enumerate(df.columns):
            col_lower = str(col).strip().lower()
            mapped = False
            
            # 1. 直接匹配
            if col in self.column_mapping:
                new_columns[col] = self.column_mapping[col]
                mapped_standard_cols.add(self.column_mapping[col])
                mapped = True
            # 2. 小写匹配
            elif col_lower in [k.lower() for k in self.column_mapping.keys()]:
                for k, v in self.column_mapping.items():
                    if k.lower() == col_lower:
                        new_columns[col] = v
                        mapped_standard_cols.add(v)
                        mapped = True
                        break
            
            if not mapped:
                # 3. 位置映射作为后备方案
                if i in self.position_mapping:
                    std_col = self.position_mapping[i]
                    # 只有当这个标准列名还没有被映射时才使用位置映射
                    if std_col not in mapped_standard_cols:
                        new_columns[col] = std_col
                        mapped_standard_cols.add(std_col)
                        logger.info(f"位置映射: 第{i}列 '{col}' -> '{std_col}'")
                        mapped = True
                
                if not mapped:
                    # 保持原列名
                    new_columns[col] = col
        
        df_renamed = df.rename(columns=new_columns)
        logger.info(f"映射后列名: {df_renamed.columns.tolist()}")
        
        # 确保必要字段存在，不存在则创建空字段
        required_fields = ['text', 'author_name', 'channel']
        for field in required_fields:
            if field not in df_renamed.columns:
                df_renamed[field] = ''
                logger.warning(f"缺少必填字段 '{field}'，已创建空字段")
        
        return df_renamed
    
    def _clean_data_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """清洗数据类型"""
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
    
    def _clean_datetime_field(self, series: pd.Series) -> pd.Series:
        """
        严格清洗时间字段，将无效格式设置为空值
        
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
        
        # 逐个检查每个值
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
            logger.info(f"清洗时间字段：过滤掉 {invalid_count} 条格式无效的时间数据")
        
        return cleaned_series
    
    def _validate_required_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """验证必填字段（使用更宽松的验证）"""
        original_count = len(df)
        
        # 移除文本内容为空的记录（更宽松的检查）
        if 'text' in df.columns:
            df = df[(df['text'].notna()) & (df['text'].str.len() > 0) & (df['text'] != 'nan')]
        
        # 移除作者名称为空的记录（更宽松的检查）
        if 'author_name' in df.columns:
            df = df[(df['author_name'].notna()) & (df['author_name'].str.len() > 0) & (df['author_name'] != 'nan')]
        
        # 移除渠道为空的记录（更宽松的检查）
        if 'channel' in df.columns:
            df = df[(df['channel'].notna()) & (df['channel'].str.len() > 0) & (df['channel'] != 'nan')]
        
        filtered_count = len(df)
        if filtered_count < original_count:
            logger.info(f"必填字段验证: 从 {original_count} 行过滤为 {filtered_count} 行")
        
        return df
    
    def save_to_ods(self, df: pd.DataFrame, batch_id: str) -> Tuple[int, int]:
        """
        保存数据到ODS表
        
        Returns:
            (success_count, error_count)
        """
        success_count = 0
        error_count = 0
        
        try:
            for index, row in df.iterrows():
                try:
                    # 创建ODS记录
                    # 处理时间字段，确保pandas NaT被转换为None
                    last_update_value = row.get('last_update')
                    if pd.isna(last_update_value):
                        last_update_value = None
                    
                    ods_record = ODSDashSocialComment(
                        last_update=last_update_value,
                        brand_label=str(row.get('brand_label', '')),
                        author_name=str(row.get('author_name', '')),
                        channel=str(row.get('channel', '')),
                        message_type=str(row.get('message_type', '')),
                        text=str(row.get('text', '')),
                        tags=str(row.get('tags', '')),
                        post_link=str(row.get('post_link', '')),
                        sentiment=str(row.get('sentiment', '')),
                        caption=str(row.get('caption', '')),
                        upload_batch_id=batch_id,
                        original_row_index=int(index),
                        processed_at=datetime.now(),
                        created_at=datetime.now(),
                        processed_flag=0  # 标记为未处理
                    )
                    
                    # 构建插入SQL
                    sql = self._build_insert_sql(ods_record)
                    
                    # 执行插入
                    self.db_config.execute_insert(sql)
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"保存第 {index} 行数据失败：{e}")
                    error_count += 1
                    continue
            
            logger.info(f"ODS数据保存完成：成功 {success_count} 条，失败 {error_count} 条")
            return success_count, error_count
            
        except Exception as e:
            logger.error(f"批量保存数据失败：{e}")
            return success_count, error_count
    
    def _build_insert_sql(self, record: ODSDashSocialComment) -> str:
        """构建插入SQL"""
        # 处理时间字段（正确处理NaT值）
        import pandas as pd
        
        # 安全的时间格式化
        def safe_datetime_format(dt):
            if dt is None or pd.isna(dt):
                return 'NULL'
            try:
                return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"
            except (AttributeError, ValueError):
                return 'NULL'
        
        last_update_str = safe_datetime_format(record.last_update)
        processed_at_str = safe_datetime_format(record.processed_at)
        created_at_str = safe_datetime_format(record.created_at)
        
        # 处理文本字段（防止SQL注入）
        def escape_sql_string(s):
            if s is None:
                return 'NULL'
            return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"
        
        sql = f"""
            INSERT INTO ods_dash_social_comments 
            (last_update, brand_label, author_name, channel, message_type, text, tags, 
             post_link, sentiment, caption, upload_batch_id, original_row_index, 
             processed_at, created_at, processed_flag)
            VALUES (
                {last_update_str},
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
                {processed_at_str},
                {created_at_str},
                {record.processed_flag}
            )
        """
        
        return sql
    
    def process_file(self, file_path: str, filename: str = None) -> Tuple[bool, str, Dict[str, Any]]:
        """
        处理文件的主入口（简化版）
        
        Returns:
            (success, error_message, result_stats)
        """
        try:
            # 生成批次ID
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            if not filename:
                filename = os.path.basename(file_path)
            
            file_size = os.path.getsize(file_path)
            
            # 创建上传日志
            upload_log = FileUploadLog(
                filename=filename,
                file_path=file_path,
                file_size=file_size,
                batch_id=batch_id,
                upload_time=datetime.now(),
                process_start_time=datetime.now(),
                status='processing'
            )
            
            # 保存上传记录
            self._save_upload_log(upload_log)
            
            # 1. 验证文件
            is_valid, error_msg = self.validate_file(file_path)
            if not is_valid:
                upload_log.status = 'failed'
                upload_log.error_message = error_msg
                upload_log.process_end_time = datetime.now()
                upload_log.original_rows = 0
                self._update_upload_log(upload_log)
                return False, error_msg, {}
            
            # 2. 读取文件
            df, error_msg = self.read_file(file_path)
            if df is None:
                upload_log.status = 'failed'
                upload_log.error_message = error_msg
                upload_log.process_end_time = datetime.now()
                upload_log.original_rows = 0
                self._update_upload_log(upload_log)
                return False, error_msg, {}
            
            upload_log.original_rows = len(df)
            
            # 3. 清洗数据
            df_cleaned = self.clean_and_standardize_data(df)
            upload_log.processed_rows = len(df_cleaned)
            
            if df_cleaned.empty:
                upload_log.status = 'failed'
                upload_log.error_message = "数据清洗后无有效数据"
                upload_log.process_end_time = datetime.now()
                upload_log.success_rows = 0
                upload_log.error_rows = upload_log.original_rows
                self._update_upload_log(upload_log)
                return False, "数据清洗后无有效数据", {}
            
            # 4. 保存到ODS表
            success_count, error_count = self.save_to_ods(df_cleaned, batch_id)
            
            # 5. 更新上传日志
            upload_log.success_rows = success_count
            upload_log.error_rows = error_count
            upload_log.duplicate_rows = 0  # ODS层不检测重复
            upload_log.status = 'completed' if error_count == 0 else 'partial'
            upload_log.process_end_time = datetime.now()
            
            self._update_upload_log(upload_log)
            
            # 6. 返回结果
            result = {
                'batch_id': batch_id,
                'original_rows': upload_log.original_rows,
                'processed_rows': upload_log.processed_rows,
                'success_rows': success_count,
                'duplicate_rows': 0,  # ODS层不处理重复
                'error_rows': error_count,
                'filename': filename,
                'message': f"文件处理完成：成功 {success_count} 条，失败 {error_count} 条"
            }
            
            return True, "", result
            
        except Exception as e:
            error_msg = f"文件处理失败：{str(e)}"
            logger.error(error_msg)
            
            # 更新失败状态
            if 'upload_log' in locals():
                upload_log.status = 'failed'
                upload_log.error_message = error_msg
                upload_log.process_end_time = datetime.now()
                self._update_upload_log(upload_log)
            
            return False, error_msg, {}
    
    def _save_upload_log(self, upload_log: FileUploadLog):
        """保存上传记录"""
        try:
            sql = f"""
                INSERT INTO ods_dash_social_file_upload_logs 
                (filename, file_path, file_size, original_rows, processed_rows, 
                 success_rows, duplicate_rows, error_rows, upload_time, process_start_time, 
                 batch_id, status, error_message, user_upload)
                VALUES ('{upload_log.filename}', '{upload_log.file_path}', 
                        {upload_log.file_size}, {upload_log.original_rows}, 
                        {upload_log.processed_rows}, {upload_log.success_rows}, 
                        {upload_log.duplicate_rows}, {upload_log.error_rows}, 
                        '{upload_log.upload_time.strftime('%Y-%m-%d %H:%M:%S')}', 
                        '{upload_log.process_start_time.strftime('%Y-%m-%d %H:%M:%S')}', 
                        '{upload_log.batch_id}', '{upload_log.status}', 
                        '{upload_log.error_message}', '{upload_log.user_upload}')
            """
            self.db_config.execute_insert(sql)
        except Exception as e:
            logger.error(f"保存上传记录失败: {e}")
    
    def _update_upload_log(self, upload_log: FileUploadLog):
        """更新上传记录"""
        try:
            process_end_time_str = f"'{upload_log.process_end_time.strftime('%Y-%m-%d %H:%M:%S')}'" if upload_log.process_end_time else 'NULL'
            
            sql = f"""
                UPDATE ods_dash_social_file_upload_logs SET
                    original_rows = {upload_log.original_rows},
                    processed_rows = {upload_log.processed_rows},
                    success_rows = {upload_log.success_rows},
                    duplicate_rows = {upload_log.duplicate_rows},
                    error_rows = {upload_log.error_rows},
                    process_end_time = {process_end_time_str},
                    status = '{upload_log.status}',
                    error_message = '{upload_log.error_message.replace("'", "''")}'
                WHERE batch_id = '{upload_log.batch_id}'
            """
            self.db_config.execute_insert(sql)
        except Exception as e:
            logger.error(f"更新上传记录失败: {e}")
    
    def get_upload_statistics(self) -> Dict[str, Any]:
        """获取上传统计信息"""
        try:
            # 总上传统计
            total_sql = "SELECT COUNT(*) as total_uploads FROM ods_dash_social_file_upload_logs"
            total_result = self.db_config.execute_query_dict(total_sql)
            total_uploads = total_result[0]['total_uploads'] if total_result else 0
            
            # 今日上传统计
            today_sql = """
                SELECT COUNT(*) as today_uploads, 
                       SUM(success_rows) as today_success_rows
                FROM ods_dash_social_file_upload_logs 
                WHERE DATE(upload_time) = CURDATE()
            """
            today_result = self.db_config.execute_query_dict(today_sql)
            today_uploads = today_result[0]['today_uploads'] if today_result else 0
            today_success_rows = today_result[0]['today_success_rows'] if today_result else 0
            
            # ODS表总记录数
            ods_sql = "SELECT COUNT(*) as total_ods_records FROM ods_dash_social_comments"
            ods_result = self.db_config.execute_query_dict(ods_sql)
            total_ods_records = ods_result[0]['total_ods_records'] if ods_result else 0
            
            return {
                'total_uploads': total_uploads,
                'today_uploads': today_uploads,
                'today_success_rows': today_success_rows,
                'total_ods_records': total_ods_records,
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"获取上传统计失败：{e}")
            return {'error': str(e)}
