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
    
    def _get_ssl_config(self, db_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        构建SSL配置
        
        Args:
            db_config: 数据库配置字典
            
        Returns:
            SSL配置字典
        """
        ssl_mode = os.getenv('DB_SSL_MODE', 'DISABLED').strip()
        ssl_ca = os.getenv('DB_SSL_CA', '').strip()
        ssl_cert = os.getenv('DB_SSL_CERT', '').strip()
        ssl_key = os.getenv('DB_SSL_KEY', '').strip()
        
        print(f"SSL配置: ssl_mode={ssl_mode}, ssl_ca={ssl_ca}")
        
        if ssl_mode == 'DISABLED':
            return {}
        
        ssl_config = {}
        
        # 根据SSL模式设置不同的配置
        if ssl_mode == 'REQUIRED':
            # 对于TiDB Cloud，只需要设置ssl=True即可
            ssl_config['ssl'] = True
            print("添加SSL参数: ssl = True")
        elif ssl_mode in ['VERIFY_CA', 'VERIFY_IDENTITY']:
            ssl_config['ssl'] = True
            if ssl_ca:
                resolved_ca_path = self._resolve_ssl_path(ssl_ca)
                if resolved_ca_path and os.path.exists(resolved_ca_path):
                    ssl_config['ssl_ca'] = resolved_ca_path
                    print(f"添加SSL参数: ssl_ca = {resolved_ca_path}")
                else:
                    print(f"警告: CA证书文件不存在: {ssl_ca}")
                    # 如果CA证书不存在，回退到基本SSL
                    print("回退到基本SSL配置")
        
        # 双向SSL认证（可选）
        if ssl_mode == 'VERIFY_IDENTITY' and ssl_cert and ssl_key:
            resolved_cert_path = self._resolve_ssl_path(ssl_cert)
            resolved_key_path = self._resolve_ssl_path(ssl_key)
            
            if resolved_cert_path and os.path.exists(resolved_cert_path):
                ssl_config['ssl_cert'] = resolved_cert_path
                print(f"添加SSL参数: ssl_cert = {resolved_cert_path}")
            
            if resolved_key_path and os.path.exists(resolved_key_path):
                ssl_config['ssl_key'] = resolved_key_path
                print(f"添加SSL参数: ssl_key = {resolved_key_path}")
        
        return ssl_config
    
    def _resolve_ssl_path(self, path: str) -> str:
        """
        解析SSL证书文件路径
        
        Args:
            path: 证书文件路径（相对或绝对）
            
        Returns:
            解析后的绝对路径
        """
        if os.path.isabs(path):
            return path
        
        # 尝试多种相对路径
        search_paths = [
            os.path.join(os.getcwd(), path),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', path),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', path),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
        ]
        
        for search_path in search_paths:
            if os.path.exists(search_path):
                return os.path.abspath(search_path)
        
        return path
    
    def _create_safe_connection_params(self, db_config: Dict[str, Any], ssl_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建安全的连接参数（隐藏敏感信息）
        
        Args:
            db_config: 数据库配置
            ssl_config: SSL配置
            
        Returns:
            安全的连接参数字典
        """
        # 合并配置
        connection_params = {**db_config, **ssl_config}
        
        # 隐藏敏感信息用于调试输出
        safe_params = connection_params.copy()
        if 'password' in safe_params:
            safe_params['password'] = '***'
        if 'ssl_key' in safe_params:
            safe_params['ssl_key'] = '***'
        
        print(f"连接参数: {safe_params}")
        return connection_params
    
    def get_database_config(self, db_name: str = 'mkt') -> Dict[str, Any]:
        """
        获取数据库配置
        现在数据库配置完全从环境变量读取(.env文件)
        cfg.yaml文件专用于业务配置
        """
        # 从环境变量获取配置，自动去除多余空格
        env_config = {
            'host': os.getenv('DB_HOST', '10.51.32.12').strip(),  # 去除空格
            'port': int(os.getenv('DB_PORT', 4000)),
            'database': os.getenv('DB_DATABASE', 'mkt').strip(),  # 去除空格
            'username': os.getenv('DB_USERNAME', 'root').strip(),  # 去除空格
            'password': os.getenv('DB_PASSWORD', '').strip(),      # 去除空格
            'charset': os.getenv('DB_CHARSET', 'utf8mb4').strip()  # 去除空格
        }
        
        # 调试信息：打印环境变量值（去除空格后）
        print(f"调试 - 环境变量读取结果:")
        print(f"  DB_HOST: '{os.getenv('DB_HOST', '未设置')}'")
        print(f"  DB_PORT: '{os.getenv('DB_PORT', '未设置')}'")
        print(f"  DB_DATABASE: '{os.getenv('DB_DATABASE', '未设置')}'")
        print(f"  DB_USERNAME: '{os.getenv('DB_USERNAME', '未设置')}'")
        print(f"  DB_CHARSET: '{os.getenv('DB_CHARSET', '未设置')}'")
        print(f"  最终配置: {env_config}")
        
        # 验证必需的环境变量
        if not env_config['host'] or not env_config['username'] or not env_config['password']:
            raise ValueError(
                "数据库配置缺失！请检查 .env 文件中的以下变量：\n"
                "DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE\n"
                f"当前配置: host='{env_config['host']}', username='{env_config['username']}', password={'已设置' if env_config['password'] else '未设置'}"
            )
        
        # 确保charset不为None，如果环境变量中没有设置，使用默认值
        if not env_config['charset']:
            env_config['charset'] = 'utf8mb4'
            print("警告: DB_CHARSET环境变量未设置，使用默认值: utf8mb4")
        
        return env_config
    
    def get_connection(self):
        """获取数据库连接，支持自动重连和SSL"""
        if self.connection is None or not self._is_connection_alive():
            # 关闭旧连接
            self.close_connection()
            
            # 创建新连接，增加超时和重连设置
            db_config = self.get_database_config()
            
            # 获取SSL配置
            ssl_config = self._get_ssl_config(db_config)
            
            # 创建连接参数
            connection_params = self._create_safe_connection_params(db_config, ssl_config)
            
            # 确保charset有有效值
            charset = connection_params.get('charset', 'utf8mb4')
            if not charset:
                charset = 'utf8mb4'
                print("警告: 字符集配置无效，使用默认值: utf8mb4")
            
            # 准备PyMySQL连接参数
            pymysql_params = {
                'host': connection_params.get('host', 'localhost'),
                'port': connection_params.get('port', 4000),
                'user': connection_params.get('username', 'root'),
                'password': connection_params.get('password', ''),
                'database': connection_params.get('database', 'mkt'),
                'charset': charset,
                'autocommit': True,
                'cursorclass': pymysql.cursors.DictCursor,
                # 连接超时设置
                'connect_timeout': 30,        # 连接超时30秒
                'read_timeout': 60,           # 读取超时60秒
                'write_timeout': 60,          # 写入超时60秒
                # 保持连接活跃
                'init_command': "SET SESSION wait_timeout=3600"  # 1小时会话超时
            }
            
            # 添加SSL配置
            if ssl_config:
                if 'ssl' in ssl_config and ssl_config['ssl']:
                    # 对于TiDB Cloud，使用基本的SSL配置
                    # PyMySQL期望ssl参数是一个字典，而不是布尔值
                    pymysql_params['ssl'] = {}
                    print("添加SSL参数: ssl = {}")
                
                # 添加其他SSL参数（如果存在）
                for key, value in ssl_config.items():
                    if key.startswith('ssl_') and key != 'ssl':
                        pymysql_params[key] = value
                        print(f"添加SSL参数: {key} = {value}")
            
            # 特殊处理：如果环境变量中有SSL_CA，直接添加到连接参数
            ssl_ca = os.getenv('DB_SSL_CA', '')
            if ssl_ca:
                resolved_ca_path = self._resolve_ssl_path(ssl_ca)
                if resolved_ca_path and os.path.exists(resolved_ca_path):
                    pymysql_params['ssl_ca'] = resolved_ca_path
                    print(f"添加SSL参数: ssl_ca = {resolved_ca_path}")
                else:
                    print(f"警告: CA证书文件不存在: {ssl_ca}")
            
            # 确保SSL参数存在（TiDB Cloud要求）
            if 'ssl' not in pymysql_params:
                pymysql_params['ssl'] = {}
                print("强制添加SSL参数: ssl = {} (TiDB Cloud要求)")
            
            # 调试：打印最终的连接参数（隐藏敏感信息）
            debug_params = pymysql_params.copy()
            if 'password' in debug_params:
                debug_params['password'] = '***'
            print(f"最终PyMySQL连接参数: {debug_params}")
            
            try:
                self.connection = pymysql.connect(**pymysql_params)
                print(f"数据库连接成功: {connection_params.get('host')}:{connection_params.get('port')}")
            except Exception as e:
                print(f"数据库连接失败: {e}")
                print(f"连接参数: {debug_params}")
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
            
            # 在Docker环境中，pandas可能无法正确处理PyMySQL连接
            # 使用cursor执行查询，然后转换为DataFrame
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                
                if not rows:
                    # 如果没有结果，返回空的DataFrame
                    return pd.DataFrame()
                
                # 获取列名
                if cursor.description:
                    columns = [desc[0] for desc in cursor.description]
                else:
                    # 如果没有列描述，使用默认列名
                    columns = [f'col_{i}' for i in range(len(rows[0]) if rows else 0)]
                
                # 创建DataFrame
                df = pd.DataFrame(rows, columns=columns)
                return df
                
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