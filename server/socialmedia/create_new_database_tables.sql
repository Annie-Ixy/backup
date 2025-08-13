-- 新的数据架构表结构
-- 三层架构：ODS（原始数据层）→ DWD（数据仓库详细层）→ DWD_AI（AI增强层）
-- 
-- ETL处理说明：
-- 1. ODS到DWD：自动过滤text为空或null的记录，确保DWD层数据质量
-- 2. 去重规则：基于日期+品牌+作者+渠道+文本内容进行去重
-- 3. DWD层的text字段必须非空，在ETL处理过程中会自动过滤

USE mkt;

-- ================================================================
-- 1. 修改 ODS 原始数据表（简化，移除重复检测和AI字段）
-- ================================================================

-- 首先备份现有表（创建表结构并插入数据）
CREATE TABLE IF NOT EXISTS ods_dash_social_comments_backup (
    record_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    last_update DATETIME NULL COMMENT '最后更新时间',
    brand_label VARCHAR(100) NULL COMMENT '品牌标签',
    author_name VARCHAR(100) NULL COMMENT '作者名称',
    channel VARCHAR(50) NULL COMMENT '渠道/平台',
    message_type VARCHAR(50) NULL COMMENT '消息类型',
    text TEXT NULL COMMENT '文本内容',
    tags VARCHAR(100) NULL COMMENT '标签',
    post_link VARCHAR(200) NULL COMMENT '帖子链接',
    sentiment VARCHAR(100) NULL COMMENT '情感标签',
    caption TEXT NULL COMMENT '标题/说明',
    upload_batch_id VARCHAR(50) NULL COMMENT '上传批次ID',
    original_row_index INT NULL COMMENT '原始行索引',
    processed_at DATETIME NULL COMMENT '处理时间',
    created_at DATETIME NULL COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ODS原始数据表备份';

-- 插入备份数据
INSERT INTO ods_dash_social_comments_backup 
SELECT record_id, last_update, brand_label, author_name, channel, message_type, 
       text, tags, post_link, sentiment, caption, upload_batch_id, 
       original_row_index, processed_at, created_at 
FROM ods_dash_social_comments;

-- 删除原有的唯一索引（重复检测索引）
ALTER TABLE ods_dash_social_comments DROP INDEX uk_duplicate_check_v2;

-- 添加处理标记字段
ALTER TABLE ods_dash_social_comments 
ADD COLUMN processed_flag TINYINT DEFAULT 0 COMMENT '处理标记：0-未处理，1-已处理';

-- 添加处理标记字段的索引
CREATE INDEX idx_processed_flag ON ods_dash_social_comments (processed_flag);

-- ================================================================
-- 2. 创建 DWD 数据仓库详细层表（去重后的清洗数据）
-- ================================================================

CREATE TABLE IF NOT EXISTS dwd_dash_social_comments (
    record_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    source_record_id INT NULL COMMENT '来源ODS记录ID',
    last_update DATETIME NULL COMMENT '最后更新时间',
    brand_label VARCHAR(100) NULL COMMENT '品牌标签',
    author_name VARCHAR(100) NULL COMMENT '作者名称',
    channel VARCHAR(50) NULL COMMENT '渠道/平台',
    message_type VARCHAR(50) NULL COMMENT '消息类型',
    text TEXT NOT NULL COMMENT '文本内容（ETL处理时会过滤空值）',
    tags VARCHAR(100) NULL COMMENT '标签',
    post_link VARCHAR(200) NULL COMMENT '帖子链接',
    sentiment VARCHAR(100) NULL COMMENT '情感标签',
    caption TEXT NULL COMMENT '标题/说明',
    upload_batch_id VARCHAR(50) NULL COMMENT '上传批次ID',
    original_row_index INT NULL COMMENT '原始行索引',
    
    -- DWD层特有字段
    dedupe_date DATE NULL COMMENT '去重基准日期（last_update的日期部分）',
    dedupe_key VARCHAR(500) NULL COMMENT '去重键（用于快速查找重复）',
    is_latest_in_group TINYINT DEFAULT 1 COMMENT '是否为组内最新记录',
    source_count INT DEFAULT 1 COMMENT '去重时合并的源记录数量',
    
    -- 处理时间字段
    processed_at DATETIME NULL COMMENT '处理时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 业务索引
    INDEX idx_last_update (last_update),
    INDEX idx_dedupe_date (dedupe_date),
    INDEX idx_brand_label (brand_label),
    INDEX idx_author_name (author_name),
    INDEX idx_channel (channel),
    INDEX idx_message_type (message_type),
    INDEX idx_sentiment (sentiment),
    INDEX idx_batch_id (upload_batch_id),
    INDEX idx_processed_at (processed_at),
    INDEX idx_is_latest (is_latest_in_group),
    
    -- 去重业务索引（用于快速查找重复）
    INDEX idx_dedupe_key (dedupe_key),
    
    -- 组合索引（支持去重逻辑）
    INDEX idx_dedupe_group (dedupe_date, brand_label, author_name, channel, text(255)),
    
    -- 唯一索引确保DWD层数据唯一性
    UNIQUE KEY uk_dwd_dedupe (dedupe_date, brand_label, author_name, channel, text(255))
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DWD层-去重后的社交媒体数据';

-- ================================================================
-- 3. 创建 DWD_AI AI增强层表（包含AI分析结果）
-- ================================================================

CREATE TABLE IF NOT EXISTS dwd_dash_social_comments_ai (
    record_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    dwd_record_id INT NOT NULL COMMENT 'DWD层记录ID',
    
    -- 继承DWD层所有业务字段
    last_update DATETIME NULL COMMENT '最后更新时间',
    brand_label VARCHAR(100) NULL COMMENT '品牌标签',
    author_name VARCHAR(100) NULL COMMENT '作者名称',
    channel VARCHAR(50) NULL COMMENT '渠道/平台',
    message_type VARCHAR(50) NULL COMMENT '消息类型',
    text TEXT NULL COMMENT '文本内容',
    tags VARCHAR(100) NULL COMMENT '标签',
    post_link VARCHAR(200) NULL COMMENT '帖子链接',
    sentiment VARCHAR(100) NULL COMMENT '原始情感标签',
    caption TEXT NULL COMMENT '标题/说明',
    upload_batch_id VARCHAR(50) NULL COMMENT '上传批次ID',
    original_row_index INT NULL COMMENT '原始行索引',
    
    -- DWD层字段
    dedupe_date DATE NULL COMMENT '去重基准日期',
    source_count INT DEFAULT 1 COMMENT '去重时合并的源记录数量',
    
    -- AI分析字段
    ai_sentiment VARCHAR(20) NULL COMMENT 'AI情感分析结果：positive/negative/neutral',
    ai_confidence FLOAT NULL COMMENT 'AI分析置信度（0-1）',
    ai_processed_at DATETIME NULL COMMENT 'AI处理时间',
    ai_error_message TEXT NULL COMMENT 'AI处理错误信息',
    ai_processing_status VARCHAR(20) DEFAULT 'pending' COMMENT 'AI处理状态：pending/processing/completed/failed',
    ai_model_version VARCHAR(50) NULL COMMENT 'AI模型版本',
    ai_analysis_batch_id VARCHAR(50) NULL COMMENT 'AI分析批次ID',
    
    -- 扩展AI分析字段（未来可能用到）
    ai_emotion_details JSON NULL COMMENT 'AI情感详细分析（JSON格式）',
    ai_keywords JSON NULL COMMENT 'AI提取的关键词（JSON格式）',
    ai_summary TEXT NULL COMMENT 'AI生成的内容摘要',
    
    -- 时间字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 业务索引（继承DWD层索引逻辑）
    INDEX idx_dwd_record_id (dwd_record_id),
    INDEX idx_last_update (last_update),
    INDEX idx_brand_label (brand_label),
    INDEX idx_author_name (author_name),
    INDEX idx_channel (channel),
    INDEX idx_message_type (message_type),
    INDEX idx_sentiment (sentiment),
    INDEX idx_batch_id (upload_batch_id),
    
    -- AI相关索引
    INDEX idx_ai_sentiment (ai_sentiment),
    INDEX idx_ai_confidence (ai_confidence),
    INDEX idx_ai_processed_at (ai_processed_at),
    INDEX idx_ai_processing_status (ai_processing_status),
    INDEX idx_ai_analysis_batch_id (ai_analysis_batch_id),
    
    -- 分析专用组合索引
    INDEX idx_analysis_time_sentiment (last_update, ai_sentiment),
    INDEX idx_analysis_channel_sentiment (channel, ai_sentiment),
    INDEX idx_analysis_author_sentiment (author_name, ai_sentiment),
    
    -- 外键约束
    CONSTRAINT fk_dwd_ai_dwd_record FOREIGN KEY (dwd_record_id) REFERENCES dwd_dash_social_comments(record_id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DWD_AI层-包含AI分析结果的社交媒体数据';

-- ================================================================
-- 4. 创建ETL处理状态表（跟踪数据处理进度）
-- ================================================================

CREATE TABLE IF NOT EXISTS etl_processing_log (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    process_type VARCHAR(50) NOT NULL COMMENT '处理类型：ods_to_dwd, dwd_to_ai',
    batch_id VARCHAR(50) NOT NULL COMMENT '处理批次ID',
    source_table VARCHAR(100) NOT NULL COMMENT '源表名',
    target_table VARCHAR(100) NOT NULL COMMENT '目标表名',
    
    -- 处理统计
    total_source_records INT DEFAULT 0 COMMENT '源记录总数',
    processed_records INT DEFAULT 0 COMMENT '已处理记录数',
    success_records INT DEFAULT 0 COMMENT '成功记录数',
    failed_records INT DEFAULT 0 COMMENT '失败记录数',
    duplicate_records INT DEFAULT 0 COMMENT '重复记录数',
    filtered_empty_text_records INT DEFAULT 0 COMMENT '过滤掉的text为空的记录数',
    
    -- 处理时间
    start_time DATETIME NULL COMMENT '开始时间',
    end_time DATETIME NULL COMMENT '结束时间',
    duration_seconds INT NULL COMMENT '处理耗时（秒）',
    
    -- 处理状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT '处理状态：pending/processing/completed/failed',
    error_message TEXT NULL COMMENT '错误信息',
    
    -- 处理配置
    config JSON NULL COMMENT '处理配置（JSON格式）',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    -- 索引
    INDEX idx_process_type (process_type),
    INDEX idx_batch_id (batch_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    UNIQUE KEY uk_batch_process (batch_id, process_type)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ETL处理日志表';

-- ================================================================
-- 5. 查看表结构确认
-- ================================================================

-- 显示所有相关表
SHOW TABLES LIKE '%dash_social%';
SHOW TABLES LIKE 'etl_%';

-- 显示表结构
DESCRIBE ods_dash_social_comments;
DESCRIBE dwd_dash_social_comments;
DESCRIBE dwd_dash_social_comments_ai;
DESCRIBE etl_processing_log;

-- 显示索引信息
SHOW INDEX FROM ods_dash_social_comments;
SHOW INDEX FROM dwd_dash_social_comments;
SHOW INDEX FROM dwd_dash_social_comments_ai;
