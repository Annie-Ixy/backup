#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试环境变量加载脚本
"""

import os
from dotenv import load_dotenv

def test_env_loading():
    """测试环境变量加载"""
    print("=== 环境变量加载测试 ===")
    
    # 测试.env文件加载
    env_paths = [
        '.env',
        'config/.env',
        '../.env',
        '../../.env'
    ]
    
    env_loaded = False
    for env_path in env_paths:
        if os.path.exists(env_path):
            try:
                load_dotenv(env_path)
                print(f"✅ 成功加载环境变量文件: {env_path}")
                env_loaded = True
                break
            except Exception as e:
                print(f"❌ 加载环境变量文件失败 {env_path}: {e}")
    
    if not env_loaded:
        print("⚠️  未找到.env文件")
    
    # 检查关键环境变量
    print("\n=== 环境变量状态 ===")
    key_vars = [
        'DB_HOST', 'DB_PORT', 'DB_DATABASE', 
        'DB_USERNAME', 'DB_PASSWORD', 'DB_CHARSET'
    ]
    
    for var in key_vars:
        value = os.getenv(var)
        if value:
            # 隐藏密码
            if 'PASSWORD' in var:
                display_value = '***已设置***'
            else:
                display_value = value
            print(f"✅ {var}: {display_value}")
        else:
            print(f"❌ {var}: 未设置")
    
    # 测试数据库连接配置
    print("\n=== 数据库配置测试 ===")
    try:
        from config.database_config import DatabaseConfig
        db_config = DatabaseConfig()
        config = db_config.get_database_config()
        print("✅ 数据库配置获取成功:")
        for key, value in config.items():
            if 'password' in key.lower():
                display_value = '***已设置***'
            else:
                display_value = value
            print(f"  {key}: {display_value}")
    except Exception as e:
        print(f"❌ 数据库配置获取失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_env_loading() 