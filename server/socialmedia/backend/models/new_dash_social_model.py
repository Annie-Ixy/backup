# -*- coding: utf-8 -*-
"""
新的 Dash Social 数据模型
支持三层架构：ODS → DWD → DWD_AI
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

@dataclass
class ODSDashSocialComment:
    """ODS层：原始数据模型（简化版，仅用于数据接收）"""
    record_id: Optional[int] = None
    last_update: Optional[datetime] = None
    brand_label: str = ""
    author_name: str = ""
    channel: str = ""
    message_type: str = ""
    text: str = ""
    tags: str = ""
    post_link: str = ""
    sentiment: str = ""
    caption: str = ""
    upload_batch_id: str = ""
    original_row_index: int = 0
    processed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    # ODS层特有字段
    processed_flag: int = 0  # 0-未处理，1-已处理
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'record_id': self.record_id,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'brand_label': self.brand_label,
            'author_name': self.author_name,
            'channel': self.channel,
            'message_type': self.message_type,
            'text': self.text,
            'tags': self.tags,
            'post_link': self.post_link,
            'sentiment': self.sentiment,
            'caption': self.caption,
            'upload_batch_id': self.upload_batch_id,
            'original_row_index': self.original_row_index,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'processed_flag': self.processed_flag
        }

@dataclass
class DWDDashSocialComment:
    """DWD层：数据仓库详细层模型（去重后的清洗数据）"""
    record_id: Optional[int] = None
    source_record_id: Optional[int] = None
    last_update: Optional[datetime] = None
    brand_label: str = ""
    author_name: str = ""
    channel: str = ""
    message_type: str = ""
    text: str = ""
    tags: str = ""
    post_link: str = ""
    sentiment: str = ""
    caption: str = ""
    upload_batch_id: str = ""
    original_row_index: int = 0
    
    # DWD层特有字段
    dedupe_date: Optional[datetime] = None
    dedupe_key: str = ""
    is_latest_in_group: int = 1
    source_count: int = 1
    
    # AI处理状态字段
    ai_processing_status: str = "pending"  # pending/processing/completed/failed
    extreme_negative_processing_status: str = "pending"  # pending/processing/completed/failed
    
    # AI分析结果字段（DWD层保存基本AI分析结果）
    ai_sentiment: Optional[str] = None  # positive/negative/neutral
    ai_confidence: Optional[float] = None
    ai_processed_at: Optional[datetime] = None
    
    # 时间字段
    processed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def generate_dedupe_key(self) -> str:
        """生成去重键"""
        date_str = self.dedupe_date.strftime('%Y-%m-%d') if self.dedupe_date else ''
        return f"{date_str}|{self.brand_label}|{self.author_name}|{self.channel}|{self.text[:200]}"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'record_id': self.record_id,
            'source_record_id': self.source_record_id,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'brand_label': self.brand_label,
            'author_name': self.author_name,
            'channel': self.channel,
            'message_type': self.message_type,
            'text': self.text,
            'tags': self.tags,
            'post_link': self.post_link,
            'sentiment': self.sentiment,
            'caption': self.caption,
            'upload_batch_id': self.upload_batch_id,
            'original_row_index': self.original_row_index,
            'dedupe_date': self.dedupe_date.isoformat() if self.dedupe_date else None,
            'dedupe_key': self.dedupe_key,
            'is_latest_in_group': self.is_latest_in_group,
            'source_count': self.source_count,
            'ai_processing_status': self.ai_processing_status,
            'extreme_negative_processing_status': self.extreme_negative_processing_status,
            'ai_sentiment': self.ai_sentiment,
            'ai_confidence': self.ai_confidence,
            'ai_processed_at': self.ai_processed_at.isoformat() if self.ai_processed_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

@dataclass
class DWDAIDashSocialComment:
    """DWD_AI层：AI增强层模型（包含AI分析结果）"""
    record_id: Optional[int] = None
    dwd_record_id: int = 0
    
    # 继承DWD层业务字段
    last_update: Optional[datetime] = None
    brand_label: str = ""
    author_name: str = ""
    channel: str = ""
    message_type: str = ""
    text: str = ""
    tags: str = ""
    post_link: str = ""
    sentiment: str = ""  # 原始情感标签
    caption: str = ""
    upload_batch_id: str = ""
    original_row_index: int = 0
    
    # DWD层字段
    dedupe_date: Optional[datetime] = None
    source_count: int = 1
    
    # AI分析字段
    ai_sentiment: str = ""  # positive/negative/neutral
    ai_confidence: Optional[float] = None
    ai_processed_at: Optional[datetime] = None
    ai_processing_status: str = "pending"  # pending/processing/completed/failed
    ai_analysis_batch_id: str = ""
    
    # 极端负面分析字段
    extremely_negative: bool = False
    
    # 时间字段
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'record_id': self.record_id,
            'dwd_record_id': self.dwd_record_id,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'brand_label': self.brand_label,
            'author_name': self.author_name,
            'channel': self.channel,
            'message_type': self.message_type,
            'text': self.text,
            'tags': self.tags,
            'post_link': self.post_link,
            'sentiment': self.sentiment,
            'caption': self.caption,
            'upload_batch_id': self.upload_batch_id,
            'original_row_index': self.original_row_index,
            'dedupe_date': self.dedupe_date.isoformat() if self.dedupe_date else None,
            'source_count': self.source_count,
            'ai_sentiment': self.ai_sentiment,
            'ai_confidence': self.ai_confidence,
            'ai_processed_at': self.ai_processed_at.isoformat() if self.ai_processed_at else None,
            'ai_processing_status': self.ai_processing_status,
            'ai_analysis_batch_id': self.ai_analysis_batch_id,
            'extremely_negative': self.extremely_negative,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dwd_record(cls, dwd_record: DWDDashSocialComment) -> 'DWDAIDashSocialComment':
        """从DWD记录创建AI记录"""
        return cls(
            dwd_record_id=dwd_record.record_id,
            last_update=dwd_record.last_update,
            brand_label=dwd_record.brand_label,
            author_name=dwd_record.author_name,
            channel=dwd_record.channel,
            message_type=dwd_record.message_type,
            text=dwd_record.text,
            tags=dwd_record.tags,
            post_link=dwd_record.post_link,
            sentiment=dwd_record.sentiment,
            caption=dwd_record.caption,
            upload_batch_id=dwd_record.upload_batch_id,
            original_row_index=dwd_record.original_row_index,
            dedupe_date=dwd_record.dedupe_date,
            source_count=dwd_record.source_count
        )

@dataclass
class ETLProcessingLog:
    """ETL处理日志模型"""
    id: Optional[int] = None
    process_type: str = ""  # ods_to_dwd, dwd_to_ai
    batch_id: str = ""
    source_table: str = ""
    target_table: str = ""
    
    # 处理统计
    total_source_records: int = 0
    processed_records: int = 0
    success_records: int = 0
    failed_records: int = 0
    duplicate_records: int = 0
    filtered_empty_text_records: int = 0  # 过滤掉的text为空的记录数
    filtered_invalid_date_records: int = 0  # 过滤掉的last_update无效的记录数
    
    # 处理时间
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    
    # 处理状态
    status: str = "pending"  # pending/processing/completed/failed
    error_message: str = ""
    
    # 处理配置
    config: Optional[Dict[str, Any]] = None
    
    created_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'process_type': self.process_type,
            'batch_id': self.batch_id,
            'source_table': self.source_table,
            'target_table': self.target_table,
            'total_source_records': self.total_source_records,
            'processed_records': self.processed_records,
            'success_records': self.success_records,
            'failed_records': self.failed_records,
            'duplicate_records': self.duplicate_records,
            'filtered_empty_text_records': self.filtered_empty_text_records,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_seconds': self.duration_seconds,
            'status': self.status,
            'error_message': self.error_message,
            'config': self.config,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# 保持原有的FileUploadLog模型兼容性
@dataclass
class FileUploadLog:
    """文件上传记录模型（保持兼容性）"""
    id: Optional[int] = None
    filename: str = ""
    file_path: str = ""
    file_size: int = 0
    original_rows: int = 0
    processed_rows: int = 0
    success_rows: int = 0
    duplicate_rows: int = 0
    error_rows: int = 0
    upload_time: Optional[datetime] = None
    process_start_time: Optional[datetime] = None
    process_end_time: Optional[datetime] = None
    batch_id: str = ""
    status: str = "pending"
    error_message: str = ""
    user_upload: str = "system"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'id': self.id,
            'filename': self.filename,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'original_rows': self.original_rows,
            'processed_rows': self.processed_rows,
            'success_rows': self.success_rows,
            'duplicate_rows': self.duplicate_rows,
            'error_rows': self.error_rows,
            'upload_time': self.upload_time.isoformat() if self.upload_time else None,
            'process_start_time': self.process_start_time.isoformat() if self.process_start_time else None,
            'process_end_time': self.process_end_time.isoformat() if self.process_end_time else None,
            'batch_id': self.batch_id,
            'status': self.status,
            'error_message': self.error_message,
            'user_upload': self.user_upload
        }
