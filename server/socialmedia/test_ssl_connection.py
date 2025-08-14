#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试SSL数据库连接的脚本
"""

import os
import sys

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.database_config import DatabaseConfig

def test_ssl_connection():
    """测试SSL数据库连接"""
    print("=== 测试SSL数据库连接 ===")
    
    try:
        # 创建数据库配置实例
        db_config = DatabaseConfig()
        
        # 打印环境变量状态
        print("\n环境变量状态:")
        print(f"DB_HOST: {os.getenv('DB_HOST', '未设置')}")
        print(f"DB_PORT: {os.getenv('DB_PORT', '未设置')}")
        print(f"DB_DATABASE: {os.getenv('DB_DATABASE', '未设置')}")
        print(f"DB_USERNAME: {os.getenv('DB_USERNAME', '未设置')}")
        print(f"DB_SSL_MODE: {os.getenv('DB_SSL_MODE', '未设置')}")
        
        # 获取数据库配置
        print("\n获取数据库配置...")
        db_params = db_config.get_database_config()
        print(f"数据库参数: {db_params}")
        
        # 测试连接
        print("\n测试数据库连接...")
        connection = db_config.get_connection()
        
        if connection:
            print("✅ 数据库连接成功！")
            
            # 测试简单查询
            print("\n测试简单查询...")
            result = db_config.execute_query("SELECT 1 as test")
            print(f"查询结果: {result}")
            
            # 关闭连接
            db_config.close_connection()
            print("✅ 连接测试完成")
            
        else:
            print("❌ 数据库连接失败")
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_ssl_connection() 