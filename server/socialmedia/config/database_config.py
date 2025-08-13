# -*- coding: utf-8 -*-
"""
数据库连接配置模块
基于PyMySQL、环境变量和cfg.yaml配置文件进行TiDB数据库连接
支持环境变量优先级：.env文件 > 系统环境变量 > cfg.yaml配置文件
"""

import os
import yaml
import pymysql
import pandas as pd
from typing import Dict, Any, Optional
from dotenv import load_dotenv

class DatabaseConfig:
    """数据库配置管理类"""
    
    def __init__(self, config_path: str = None):
        """
        初始化数据库配置
        优先级：.env文件 > 系统环境变量 > cfg.yaml配置文件
        
        Args:
            config_path: 配置文件路径，默认查找项目中的cfg.yaml
        """
        # 加载.env文件（如果存在）
        self._load_env_file()
        
        self.config_path = config_path or self._find_config_file()
        self.config = self._load_config()
        self.connection = None
        
    def _find_config_file(self) -> str:
        """查找cfg.yaml配置文件"""
        # 先在当前目录查找
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 查找顺序：当前目录 -> 上级目录 -> 项目根目录
        search_paths = [
            os.path.join(current_dir, 'cfg.yaml'),
            os.path.join(current_dir, '..', 'cfg.yaml'),
            os.path.join(current_dir, '..', '..', 'datalibro-reddit-monitoring', 'cfg.yaml'),
            os.path.join(current_dir, '..', '..', 'cfg.yaml')
        ]
        
        for path in search_paths:
            if os.path.exists(path):
                return path
                
        # 如果找不到，创建默认配置
        return self._create_default_config()
    
    def _create_default_config(self) -> str:
        """创建默认业务配置文件（不包含数据库配置）"""
        default_config = {
            'system': {
                'upload': {
                    'allowed_extensions': ['.xlsx', '.xls', '.csv']
                },
                'analysis': {
                    'default_date_range': 30,
                    'max_keywords': 10,
                    'sentiment_threshold': 0.5
                },
                'logging': {
                    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                }
            },
            'default_keywords': [
                {'keyword': 'petlibro', 'category': 'brand', 'priority': 10},
                {'keyword': 'Scout Smart Camera', 'category': 'brand', 'priority': 9},
                {'keyword': 'Fountain', 'category': 'product', 'priority': 8}
            ]
        }
        
        config_path = os.path.join(os.path.dirname(__file__), 'cfg.yaml')
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
            
        return config_path
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"配置文件加载失败: {e}")
            return {}
    
    def _load_env_file(self):
        """加载.env文件"""
        env_paths = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
            '.env'
        ]
        
        env_loaded = False
        for env_path in env_paths:
            if os.path.exists(env_path):
                try:
                    load_dotenv(env_path)
                    print(f"已加载环境变量文件: {env_path}")
                    env_loaded = True
                    break
                except Exception as e:
                    print(f"加载环境变量文件失败 {env_path}: {e}")
        
        if not env_loaded:
            print("警告: 未找到.env文件，将使用系统环境变量或默认值")
            
        # 打印当前环境变量状态
        print(f"当前环境变量状态:")
        print(f"  DB_HOST: {os.getenv('DB_HOST', '未设置')}")
        print(f"  DB_PORT: {os.getenv('DB_PORT', '未设置')}")
        print(f"  DB_DATABASE: {os.getenv('DB_DATABASE', '未设置')}")
        print(f"  DB_USERNAME: {os.getenv('DB_USERNAME', '未设置')}")
        print(f"  DB_CHARSET: {os.getenv('DB_CHARSET', '未设置')}")
    
    def get_database_config(self, db_name: str = 'mkt') -> Dict[str, Any]:
        """
        获取数据库配置
        现在数据库配置完全从环境变量读取(.env文件)
        cfg.yaml文件专用于业务配置
        """
        # 从环境变量获取配置
        env_config = {
            'host': os.getenv('DB_HOST', '10.51.32.12'),  # 使用你提供的IP地址作为默认值
            'port': int(os.getenv('DB_PORT', 4000)),
            'database': os.getenv('DB_DATABASE', 'mkt'),  # 默认使用mkt数据库
            'username': os.getenv('DB_USERNAME', 'root'),  # 提供默认用户名
            'password': os.getenv('DB_PASSWORD', ''),      # 密码必须设置
            'charset': os.getenv('DB_CHARSET', 'utf8mb4')
        }
        
        # 调试信息：打印环境变量值
        print(f"调试 - 环境变量读取结果:")
        print(f"  DB_HOST: {os.getenv('DB_HOST')}")
        print(f"  DB_PORT: {os.getenv('DB_PORT')}")
        print(f"  DB_DATABASE: {os.getenv('DB_DATABASE')}")
        print(f"  DB_USERNAME: {os.getenv('DB_USERNAME')}")
        print(f"  DB_CHARSET: {os.getenv('DB_CHARSET')}")
        print(f"  最终配置: {env_config}")
        
        # 验证必需的环境变量
        if not env_config['host'] or not env_config['username'] or not env_config['password']:
            raise ValueError(
                "数据库配置缺失！请检查 .env 文件中的以下变量：\n"
                "DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE\n"
                f"当前配置: host={env_config['host']}, username={env_config['username']}, password={'已设置' if env_config['password'] else '未设置'}"
            )
        
        # 确保charset不为None，如果环境变量中没有设置，使用默认值
        if not env_config['charset']:
            env_config['charset'] = 'utf8mb4'
            print("警告: DB_CHARSET环境变量未设置，使用默认值: utf8mb4")
        
        return env_config
    
    def get_connection(self):
        """获取数据库连接，支持自动重连"""
        if self.connection is None or not self._is_connection_alive():
            # 关闭旧连接
            self.close_connection()
            
            # 创建新连接，增加超时和重连设置
            db_config = self.get_database_config()
            
            # 确保charset有有效值
            charset = db_config.get('charset', 'utf8mb4')
            if not charset:
                charset = 'utf8mb4'
                print("警告: 字符集配置无效，使用默认值: utf8mb4")
            
            try:
                self.connection = pymysql.connect(
                    host=db_config.get('host', 'localhost'),
                    port=db_config.get('port', 4000),
                    user=db_config.get('username', 'root'),
                    password=db_config.get('password', ''),
                    database=db_config.get('database', 'mkt'),
                    charset=charset,
                    autocommit=True,
                    cursorclass=pymysql.cursors.DictCursor,
                    # 连接超时设置
                    connect_timeout=30,        # 连接超时30秒
                    read_timeout=60,           # 读取超时60秒
                    write_timeout=60,          # 写入超时60秒
                    # 保持连接活跃，注意：ping_interval不是pymysql的标准参数
                    init_command="SET SESSION wait_timeout=3600"  # 1小时会话超时
                )
                print(f"数据库连接成功: {db_config.get('host')}:{db_config.get('port')}")
            except Exception as e:
                print(f"数据库连接失败: {e}")
                raise
        return self.connection
    
    def _is_connection_alive(self):
        """检查连接是否活跃"""
        try:
            if self.connection is None:
                return False
            self.connection.ping(reconnect=False)
            return True
        except Exception as e:
            print(f"连接检查失败: {e}")
            return False
    
    def execute_query(self, sql: str, params: Optional[tuple] = None) -> pd.DataFrame:
        """
        执行SQL查询
        
        Args:
            sql: SQL语句
            params: 查询参数
            
        Returns:
            查询结果DataFrame
        """
        try:
            connection = self.get_connection()
            result = pd.read_sql(sql, connection, params=params)
            return result
        except Exception as e:
            print(f"SQL查询执行失败: {e}")
            raise
    
    def execute_query_dict(self, sql: str, params: Optional[tuple] = None) -> list:
        """
        执行SQL查询，返回字典列表，支持自动重连
        
        Args:
            sql: SQL语句
            params: 查询参数
            
        Returns:
            查询结果字典列表
        """
        max_retries = 3
        for attempt in range(max_retries):
            try:
                connection = self.get_connection()
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)
                    # 使用DictCursor，直接返回字典列表
                    rows = cursor.fetchall()
                    return rows
            except Exception as e:
                print(f"SQL查询执行失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    # 重置连接，准备重试
                    self.close_connection()
                    continue
                else:
                    # 最后一次尝试失败，抛出异常
                    raise
    
    def execute_insert(self, sql: str, params: Optional[tuple] = None) -> bool:
        """
        执行插入操作，支持自动重连
        
        Args:
            sql: SQL语句
            params: 插入参数
            
        Returns:
            是否成功
        """
        max_retries = 3
        for attempt in range(max_retries):
            try:
                connection = self.get_connection()
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)
                return True
            except Exception as e:
                print(f"SQL插入执行失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    # 重置连接，准备重试
                    self.close_connection()
                    continue
                else:
                    # 最后一次尝试失败，返回False
                    return False
    
    def test_connection(self) -> bool:
        """测试数据库连接"""
        try:
            result = self.execute_query("SELECT 1 as test")
            return len(result) > 0
        except:
            return False
    
    def close_connection(self):
        """关闭数据库连接"""
        if self.connection:
            try:
                self.connection.close()
                self.connection = None
            except:
                pass

# 全局数据库配置实例
db_config = DatabaseConfig()

def get_db_config() -> DatabaseConfig:
    """获取数据库配置实例"""
    return db_config