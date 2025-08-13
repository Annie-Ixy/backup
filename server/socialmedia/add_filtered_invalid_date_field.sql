# -*- sql -*-
# 数据库迁移脚本：添加filtered_invalid_date_records字段到etl_processing_log表
# 
# 目的：为ETL处理日志表添加过滤无效日期记录数的统计字段
# 
# 执行方式：
# mysql -u your_username -p your_database < add_filtered_invalid_date_field.sql
# 或者在MySQL客户端中直接执行以下SQL语句

USE mkt;

-- 检查字段是否已存在，避免重复添加
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'mkt' 
  AND TABLE_NAME = 'etl_processing_log' 
  AND COLUMN_NAME = 'filtered_invalid_date_records';

-- 如果上述查询结果为空，则执行以下ALTER语句
-- 如果字段已存在，请跳过此步骤

ALTER TABLE etl_processing_log 
ADD COLUMN filtered_invalid_date_records INT DEFAULT 0 COMMENT '过滤掉的last_update无效的记录数'
AFTER filtered_empty_text_records;

-- 验证字段添加成功
DESCRIBE etl_processing_log;

-- 显示字段添加结果
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'mkt' 
  AND TABLE_NAME = 'etl_processing_log' 
  AND COLUMN_NAME IN ('filtered_empty_text_records', 'filtered_invalid_date_records')
ORDER BY ORDINAL_POSITION;

COMMIT;

