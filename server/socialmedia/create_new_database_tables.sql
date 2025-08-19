-- ================================================================
-- 社交媒体数据分析平台 - 数据库表结构定义（基于现有表优化）
-- ================================================================
-- 
-- 三层架构设计：
-- 1. ODS（原始数据层）：接收所有原始数据
-- 2. DWD（数据仓库详细层）：text非空+last_update有效+去重数据+AI分析结果
-- 3. DWD_AI（AI增强层）：完整AI分析结果存储
-- 
-- 数据流向：原始数据 → ODS → ETL去重 → DWD → AI分析 → DWD_AI
-- 
-- 更新时间：2024-08-15
-- 版本：v3.0（基于现有表结构优化）
-- ================================================================

USE mkt;

-- ================================================================
-- 1. ODS 原始数据表（基于现有表结构）
-- ================================================================

CREATE TABLE IF NOT EXISTS `ods_dash_social_comments` (
    `record_id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `last_update` DATETIME DEFAULT NULL COMMENT '最后更新时间',
    `brand_label` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌标签',
    `author_name` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者名称',
    `channel` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '渠道/平台',
    `message_type` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '消息类型',
    `text` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文本内容',
    `tags` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签',
    `post_link` VARCHAR(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '帖子链接',
    `sentiment` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '情感标签',
    `caption` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题/说明',
    `upload_batch_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '上传批次ID',
    `original_row_index` INT(11) DEFAULT NULL COMMENT '原始行索引',
    `processed_at` DATETIME DEFAULT NULL COMMENT '处理时间',
    `created_at` DATETIME DEFAULT NULL COMMENT '创建时间',
    `processed_flag` TINYINT(4) DEFAULT '0' COMMENT '处理标记：0-未处理，1-已处理',
    
    PRIMARY KEY (`record_id`) /*T![clustered_index] CLUSTERED */,
    KEY `idx_last_update` (`last_update`),
    KEY `idx_brand_label` (`brand_label`),
    KEY `idx_author_name` (`author_name`),
    KEY `idx_channel` (`channel`),
    KEY `idx_message_type` (`message_type`),
    KEY `idx_sentiment` (`sentiment`),
    KEY `idx_batch_id` (`upload_batch_id`),
    KEY `idx_processed_at` (`processed_at`),
    KEY `idx_processed_flag` (`processed_flag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='DashSocial原始数据表';

-- ================================================================
-- 2. DWD 数据仓库详细层表（基于现有表结构）
-- ================================================================

CREATE TABLE IF NOT EXISTS `dwd_dash_social_comments` (
    `record_id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `source_record_id` INT(11) DEFAULT NULL COMMENT '来源ODS记录ID',
    `last_update` DATETIME DEFAULT NULL COMMENT '最后更新时间',
    `brand_label` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌标签',
    `author_name` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者名称',
    `channel` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '渠道/平台',
    `message_type` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '消息类型',
    `text` TEXT COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文本内容',
    `tags` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签',
    `post_link` VARCHAR(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '帖子链接',
    `sentiment` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '情感标签',
    `caption` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题/说明',
    `upload_batch_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '上传批次ID',
    `original_row_index` INT(11) DEFAULT NULL COMMENT '原始行索引',
    
    -- DWD层去重字段
    `dedupe_date` DATE DEFAULT NULL COMMENT '去重基准日期（last_update的日期部分）',
    `dedupe_key` VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '去重键（用于快速查找重复）',
    `is_latest_in_group` TINYINT(4) DEFAULT '1' COMMENT '是否为组内最新记录',
    `source_count` INT(11) DEFAULT '1' COMMENT '去重时合并的源记录数量',
    
    -- 时间字段
    `processed_at` DATETIME DEFAULT NULL COMMENT '处理时间',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- AI处理状态字段
    `ai_processing_status` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'AI处理状态：pending/processing/completed/failed',
    `extreme_negative_processing_status` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT '极端负面分析状态：pending/processing/completed/failed',
    
    -- AI分析结果字段
    `ai_sentiment` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI情感分析结果：positive/negative/neutral',
    `ai_confidence` DECIMAL(5,4) DEFAULT NULL COMMENT 'AI分析置信度',
    `ai_processed_at` DATETIME DEFAULT NULL COMMENT 'AI分析处理时间',
    
    PRIMARY KEY (`record_id`) /*T![clustered_index] CLUSTERED */,
    KEY `idx_last_update` (`last_update`),
    KEY `idx_dedupe_date` (`dedupe_date`),
    KEY `idx_brand_label` (`brand_label`),
    KEY `idx_author_name` (`author_name`),
    KEY `idx_channel` (`channel`),
    KEY `idx_message_type` (`message_type`),
    KEY `idx_sentiment` (`sentiment`),
    KEY `idx_batch_id` (`upload_batch_id`),
    KEY `idx_processed_at` (`processed_at`),
    KEY `idx_is_latest` (`is_latest_in_group`),
    KEY `idx_dedupe_key` (`dedupe_key`),
    KEY `idx_dedupe_group` (`dedupe_date`,`brand_label`,`author_name`,`channel`,`text`(255)),
    KEY `idx_dwd_ai_processing_status` (`ai_processing_status`),
    KEY `idx_extreme_negative_processing_status` (`extreme_negative_processing_status`),
    KEY `idx_ai_extreme_combined` (`ai_processing_status`,`extreme_negative_processing_status`),
    UNIQUE KEY `uk_dwd_dedupe` (`dedupe_date`,`brand_label`,`author_name`,`channel`,`text`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='DWD层-去重后的社交媒体数据';

-- ================================================================
-- 3. DWD_AI AI增强分析层表（基于现有表结构）
-- ================================================================

CREATE TABLE IF NOT EXISTS `dwd_dash_social_comments_ai` (
    `record_id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `dwd_record_id` INT(11) NOT NULL COMMENT 'DWD层记录ID',
    
    -- 继承DWD层业务字段
    `last_update` DATETIME DEFAULT NULL COMMENT '最后更新时间',
    `brand_label` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '品牌标签',
    `author_name` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '作者名称',
    `channel` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '渠道/平台',
    `message_type` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '消息类型',
    `text` TEXT COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文本内容',
    `tags` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签',
    `post_link` VARCHAR(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '帖子链接',
    `sentiment` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '原始情感标签',
    `caption` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题/说明',
    `upload_batch_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '上传批次ID',
    `original_row_index` INT(11) DEFAULT NULL COMMENT '原始行索引',
    
    -- DWD层字段
    `dedupe_date` DATE DEFAULT NULL COMMENT '去重基准日期',
    `source_count` INT(11) DEFAULT '1' COMMENT '去重时合并的源记录数量',
    
    -- AI分析核心字段
    `ai_sentiment` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI情感分析结果：positive/negative/neutral',
    `ai_confidence` FLOAT DEFAULT NULL COMMENT 'AI分析置信度（0-1）',
    `ai_processed_at` DATETIME DEFAULT NULL COMMENT 'AI处理时间',
    `ai_processing_status` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'AI处理状态：pending/processing/completed/failed',
    `ai_analysis_batch_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI分析批次ID',
    
    -- 时间字段
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 特殊分析字段
    `extremely_negative` TINYINT(1) DEFAULT '0' COMMENT '是否为极端负面评论',
    
    PRIMARY KEY (`record_id`) /*T![clustered_index] CLUSTERED */,
    KEY `idx_dwd_record_id` (`dwd_record_id`),
    KEY `idx_last_update` (`last_update`),
    KEY `idx_brand_label` (`brand_label`),
    KEY `idx_author_name` (`author_name`),
    KEY `idx_channel` (`channel`),
    KEY `idx_message_type` (`message_type`),
    KEY `idx_sentiment` (`sentiment`),
    KEY `idx_batch_id` (`upload_batch_id`),
    KEY `idx_ai_sentiment` (`ai_sentiment`),
    KEY `idx_ai_confidence` (`ai_confidence`),
    KEY `idx_ai_processed_at` (`ai_processed_at`),
    KEY `idx_ai_processing_status` (`ai_processing_status`),
    KEY `idx_ai_analysis_batch_id` (`ai_analysis_batch_id`),
    KEY `idx_analysis_time_sentiment` (`last_update`,`ai_sentiment`),
    KEY `idx_analysis_channel_sentiment` (`channel`,`ai_sentiment`),
    KEY `idx_analysis_author_sentiment` (`author_name`,`ai_sentiment`),
    KEY `idx_extremely_negative` (`extremely_negative`),
    KEY `idx_negative_analysis` (`ai_sentiment`,`extremely_negative`),
    UNIQUE KEY `uk_dwd_record_id` (`dwd_record_id`),
    CONSTRAINT `fk_dwd_ai_dwd_record` FOREIGN KEY (`dwd_record_id`) REFERENCES `dwd_dash_social_comments` (`record_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='DWD_AI层-包含AI分析结果的社交媒体数据';

-- ================================================================
-- 4. 文件上传日志表（基于现有表结构）
-- ================================================================

CREATE TABLE IF NOT EXISTS `ods_dash_social_file_upload_logs` (
    `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `filename` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
    `file_path` VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件路径',
    `file_size` INT(11) DEFAULT NULL COMMENT '文件大小(字节)',
    `original_rows` INT(11) DEFAULT NULL COMMENT '原始行数',
    `processed_rows` INT(11) DEFAULT NULL COMMENT '已处理行数',
    `success_rows` INT(11) DEFAULT NULL COMMENT '成功行数',
    `duplicate_rows` INT(11) DEFAULT NULL COMMENT '重复行数',
    `error_rows` INT(11) DEFAULT NULL COMMENT '错误行数',
    `upload_time` DATETIME DEFAULT NULL COMMENT '上传时间',
    `process_start_time` DATETIME DEFAULT NULL COMMENT '处理开始时间',
    `process_end_time` DATETIME DEFAULT NULL COMMENT '处理结束时间',
    `batch_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '批次ID',
    `status` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '处理状态：pending/processing/completed/failed',
    `error_message` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '错误信息',
    `user_upload` VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '上传用户',
    
    PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
    KEY `idx_batch_id` (`batch_id`),
    KEY `idx_status` (`status`),
    KEY `idx_upload_time` (`upload_time`),
    KEY `idx_filename` (`filename`),
    UNIQUE KEY `uk_batch_id` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='DashSocial文件上传记录表';

-- ================================================================
-- 5. ETL处理日志表（基于现有表结构）
-- ================================================================

CREATE TABLE IF NOT EXISTS `dwd_etl_processing_log` (
    -- 主键和批次标识
    `log_id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '日志记录主键ID，自增长',
    `batch_id` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ETL处理批次ID，格式：ods_to_dwd_YYYYMMDD_HHMMSS_随机8位',
    `step_name` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ETL步骤名称：ods_to_dwd（ODS到DWD）, dwd_to_ai（DWD到AI表）',
    
    -- 处理状态和时间
    `status` VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'running' COMMENT '处理状态：running（进行中）, completed（完成）, partial（部分成功）, failed（失败）',
    `start_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ETL处理开始时间',
    `end_time` DATETIME DEFAULT NULL COMMENT 'ETL处理结束时间，NULL表示仍在处理中',
    `duration_seconds` INT(11) DEFAULT NULL COMMENT '处理耗时（秒），end_time - start_time的秒数',
    
    -- 数据统计字段
    `total_source_records` INT(11) DEFAULT '0' COMMENT '源表记录总数（ODS→DWD时为ODS记录数，DWD→AI时为DWD记录数）',
    `processed_records` INT(11) DEFAULT '0' COMMENT '实际处理的记录数（经过过滤后进入处理流程的记录数）',
    `success_records` INT(11) DEFAULT '0' COMMENT '成功处理的记录数（最终插入目标表的记录数）',
    `failed_records` INT(11) DEFAULT '0' COMMENT '处理失败的记录数（因各种错误未能处理的记录数）',
    `duplicate_records` INT(11) DEFAULT '0' COMMENT '去重过程中的重复记录数（同一去重组内被过滤掉的记录数）',
    
    -- 数据过滤统计
    `filtered_empty_text_records` INT(11) DEFAULT '0' COMMENT '过滤掉的text为空的记录数（text字段为NULL、空字符串或纯空白）',
    `filtered_invalid_date_records` INT(11) DEFAULT '0' COMMENT '过滤掉的last_update无效的记录数（时间格式错误或无法解析的记录）',
    
    -- 错误和元数据
    `error_message` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '错误详细信息（当status为failed时记录具体错误原因）',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '日志记录创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '日志记录最后更新时间',
    
    -- 索引定义
    PRIMARY KEY (`log_id`) /*T![clustered_index] CLUSTERED */,
    KEY `idx_batch_id` (`batch_id`),
    KEY `idx_step_name` (`step_name`),
    KEY `idx_status` (`status`),
    KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ETL处理日志表 - 记录ODS到DWD、DWD到AI的数据处理过程和统计信息';

-- ================================================================
-- 6. 清理未使用字段和已废弃的约束
-- ================================================================

-- 删除DWD_AI表中未使用的字段（确认后执行）
-- 这些字段在实际业务中未被使用，删除可以优化表结构和性能
-- ALTER TABLE dwd_dash_social_comments_ai DROP COLUMN ai_error_message;
-- ALTER TABLE dwd_dash_social_comments_ai DROP COLUMN ai_model_version;
-- ALTER TABLE dwd_dash_social_comments_ai DROP COLUMN ai_emotion_details;
-- ALTER TABLE dwd_dash_social_comments_ai DROP COLUMN ai_keywords;
-- ALTER TABLE dwd_dash_social_comments_ai DROP COLUMN ai_summary;

-- 删除ODS表中可能存在的uk_duplicate_check约束（如果存在）
-- 因为新架构中ODS层不再需要重复检查约束
-- ALTER TABLE ods_dash_social_comments DROP INDEX uk_duplicate_check;
-- ALTER TABLE ods_dash_social_comments DROP INDEX uk_duplicate_check_v2;

-- 查看当前约束状态
-- SHOW INDEX FROM ods_dash_social_comments WHERE Key_name LIKE '%duplicate%';

-- 确认字段删除前，检查数据
-- SELECT COUNT(*) as total,
--        SUM(CASE WHEN ai_error_message IS NOT NULL THEN 1 ELSE 0 END) as has_error_msg,
--        SUM(CASE WHEN ai_model_version IS NOT NULL THEN 1 ELSE 0 END) as has_model_ver,
--        SUM(CASE WHEN ai_emotion_details IS NOT NULL THEN 1 ELSE 0 END) as has_emotion,
--        SUM(CASE WHEN ai_keywords IS NOT NULL THEN 1 ELSE 0 END) as has_keywords,
--        SUM(CASE WHEN ai_summary IS NOT NULL THEN 1 ELSE 0 END) as has_summary
-- FROM dwd_dash_social_comments_ai;

-- ================================================================
-- 7. 验证和查看表结构
-- ================================================================

-- 显示所有相关表及其统计信息
SELECT 
    TABLE_NAME, 
    TABLE_COMMENT, 
    TABLE_ROWS,
    ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS 'Size_MB'
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'mkt' 
  AND (TABLE_NAME LIKE '%social%' 
   OR TABLE_NAME LIKE 'etl_%'
   OR TABLE_NAME LIKE '%upload%')
ORDER BY TABLE_NAME;

-- 查看表结构（取消注释查看具体表结构）
-- DESCRIBE ods_dash_social_comments;
-- DESCRIBE dwd_dash_social_comments;
-- DESCRIBE dwd_dash_social_comments_ai;
-- DESCRIBE dwd_etl_processing_log;
-- DESCRIBE ods_dash_social_file_upload_logs;

-- 查看索引信息（取消注释查看索引详情）
-- SHOW INDEX FROM ods_dash_social_comments;
-- SHOW INDEX FROM dwd_dash_social_comments;
-- SHOW INDEX FROM dwd_dash_social_comments_ai;

-- 验证数据流通性（检查各层数据统计）
-- SELECT 
--     'ODS' as layer, COUNT(*) as total_records, 
--     SUM(CASE WHEN processed_flag = 0 THEN 1 ELSE 0 END) as unprocessed
-- FROM ods_dash_social_comments
-- UNION ALL
-- SELECT 
--     'DWD' as layer, COUNT(*) as total_records,
--     SUM(CASE WHEN ai_processing_status = 'pending' THEN 1 ELSE 0 END) as pending_ai
-- FROM dwd_dash_social_comments  
-- UNION ALL
-- SELECT 
--     'DWD_AI' as layer, COUNT(*) as total_records,
--     SUM(CASE WHEN ai_processing_status = 'completed' THEN 1 ELSE 0 END) as completed_ai
-- FROM dwd_dash_social_comments_ai;

-- 检查数据处理统计（按批次）
-- SELECT 
--     batch_id,
--     step_name,
--     total_source_records,
--     success_records,
--     filtered_empty_text_records,
--     filtered_invalid_date_records,
--     duplicate_records,
--     status
-- FROM dwd_etl_processing_log 
-- ORDER BY start_time DESC
-- LIMIT 10;

-- ================================================================
-- 8. 数据架构说明和重要注意事项
-- ================================================================

/*
=== 社交媒体数据分析平台架构总结 ===

🏗️ 表结构设计原则：
1. ODS层：接收所有原始数据，无任何处理和约束
2. DWD层：text非空+last_update有效+去重清洗+AI分析状态管理
3. DWD_AI层：完整AI分析结果存储
4. 日志表：完整的数据处理链路追踪

📊 数据流向：
原始数据 → ODS（直接保存）→ ETL（过滤+去重）→ DWD → AI分析 → DWD_AI

🔄 去重机制：
- 去重规则：DATE(last_update) + brand_label + author_name + channel + text(255)
- 唯一约束：uk_dwd_dedupe 确保DWD层数据唯一性
- 数据过滤：text非空 + last_update有效
- 保留策略：保留last_update时间戳最晚的记录

🤖 AI处理流程：
1. ODS数据上传：直接保存所有原始数据（无任何处理）
2. ETL处理：text非空+last_update有效+去重→DWD层
3. AI分析：sentiment分析→更新DWD层AI字段
4. 数据同步：完成的AI分析结果→DWD_AI层

⚠️ 重要注意事项：
1. ODS层接收所有原始数据，text和last_update可为空
2. DWD层使用uk_dwd_dedupe唯一约束确保去重规则生效
3. ETL过程中过滤text为空和last_update无效的记录
4. AI处理状态分为两个维度：基础AI分析 + 极端负面分析
5. DWD_AI层有外键约束，删除DWD记录会级联删除AI记录
6. 没有使用uk_duplicate_check约束（已移除）

🔧 索引优化：
- 业务查询索引：时间、品牌、渠道等常用查询字段
- AI分析索引：AI状态、情感分析结果等
- 组合索引：支持复杂查询场景

📈 扩展性：
- JSON字段支持复杂AI分析结果存储
- 灵活的状态管理机制
- 完整的处理日志追踪
*/
