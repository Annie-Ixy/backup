# 环境变量配置说明

## 概述
本系统支持通过环境变量配置数据库连接，支持SSL和非SSL连接，适用于不同的部署环境。

## 基础配置

### 必需的环境变量
```bash
# 数据库连接信息
DB_HOST=10.51.32.12          # 数据库服务器地址
DB_PORT=4000                  # 数据库端口
DB_DATABASE=mkt               # 数据库名称
DB_USERNAME=root              # 用户名
DB_PASSWORD=your_password     # 密码
DB_CHARSET=utf8mb4           # 字符集
```

### 可选的环境变量
```bash
# SSL配置
DB_SSL_MODE=DISABLED         # SSL模式 (DISABLED/REQUIRED/VERIFY_CA/VERIFY_IDENTITY)
DB_SSL_CA=/path/to/ca.pem    # CA证书路径
DB_SSL_CERT=/path/to/cert.pem # 客户端证书路径
DB_SSL_KEY=/path/to/key.pem  # 客户端私钥路径
```

## SSL模式说明

### 1. DISABLED (默认)
- **用途**: 本地开发、内网环境
- **安全性**: 无加密
- **配置**: 无需额外配置
- **示例**: 
```bash
DB_SSL_MODE=DISABLED
```

### 2. REQUIRED
- **用途**: 测试环境、需要加密但不需要证书验证
- **安全性**: 基本加密保护
- **配置**: 无需证书文件
- **示例**: 
```bash
DB_SSL_MODE=REQUIRED
```

### 3. VERIFY_CA
- **用途**: 生产环境、需要验证服务器身份
- **安全性**: 高安全性
- **配置**: 需要CA证书
- **示例**: 
```bash
DB_SSL_MODE=VERIFY_CA
DB_SSL_CA=./certs/ca-cert.pem
```

### 4. VERIFY_IDENTITY
- **用途**: 高安全环境、双向SSL认证
- **安全性**: 最高安全性
- **配置**: 需要CA证书、客户端证书和私钥
- **示例**: 
```bash
DB_SSL_MODE=VERIFY_IDENTITY
DB_SSL_CA=./certs/ca-cert.pem
DB_SSL_CERT=./certs/client-cert.pem
DB_SSL_KEY=./certs/client-key.pem
```

## 不同环境的配置示例

### 本地开发环境
```bash
# .env.local
DB_HOST=localhost
DB_PORT=4000
DB_DATABASE=mkt_dev
DB_USERNAME=root
DB_PASSWORD=dev_password
DB_CHARSET=utf8mb4
DB_SSL_MODE=DISABLED
```

### 内网测试环境
```bash
# .env.test
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt_test
DB_USERNAME=test_user
DB_PASSWORD=test_password
DB_CHARSET=utf8mb4
DB_SSL_MODE=REQUIRED
```

### 生产环境
```bash
# .env.prod
DB_HOST=prod-db.example.com
DB_PORT=4000
DB_DATABASE=mkt_prod
DB_USERNAME=prod_user
DB_PASSWORD=prod_password
DB_CHARSET=utf8mb4
DB_SSL_MODE=VERIFY_CA
DB_SSL_CA=./certs/ca-cert.pem
```

### 云服务环境
```bash
# .env.cloud
DB_HOST=cloud-db.example.com
DB_PORT=4000
DB_DATABASE=mkt_cloud
DB_USERNAME=cloud_user
DB_PASSWORD=cloud_password
DB_CHARSET=utf8mb4
DB_SSL_MODE=VERIFY_IDENTITY
DB_SSL_CA=./certs/ca-cert.pem
DB_SSL_CERT=./certs/client-cert.pem
DB_SSL_KEY=./certs/client-key.pem
```

## 兼容性说明

### 向后兼容性
- **不设置SSL**: 默认使用非SSL连接，完全兼容现有配置
- **设置SSL**: 自动启用SSL连接，支持证书验证

### 自动降级机制
- 如果配置了 `VERIFY_CA` 但CA证书不存在，自动降级到 `REQUIRED` 模式
- 如果配置了 `VERIFY_IDENTITY` 但证书文件缺失，自动降级到 `VERIFY_CA` 模式
- 系统会输出警告信息，但不会中断连接

### 环境检测
系统会自动检测环境变量并应用相应配置：
```bash
# 调试输出示例
调试 - 环境变量读取结果:
  DB_HOST: 10.51.32.12
  DB_PORT: 4000
  DB_DATABASE: mkt
  DB_USERNAME: root
  DB_CHARSET: utf8mb4
  DB_SSL_MODE: REQUIRED
  SSL配置: {'ssl': True}
  最终配置: {...}
```

## 部署建议

### 开发环境
- 使用 `DISABLED` 模式，简化配置
- 无需证书文件

### 测试环境
- 使用 `REQUIRED` 模式，提供基本加密
- 无需证书文件

### 生产环境
- 使用 `VERIFY_CA` 模式，验证服务器身份
- 配置CA证书文件

### 高安全环境
- 使用 `VERIFY_IDENTITY` 模式，双向认证
- 配置完整的证书链

## 故障排除

### 常见问题

1. **SSL连接失败**
   - 检查 `DB_SSL_MODE` 设置
   - 验证证书文件路径和权限
   - 确认数据库服务器支持SSL

2. **证书验证失败**
   - 检查CA证书是否有效
   - 确认证书文件格式正确
   - 验证证书是否过期

3. **权限错误**
   - 确保应用有读取证书文件的权限
   - 检查证书文件的用户和组权限

### 调试步骤

1. 检查环境变量是否正确设置
2. 查看连接日志中的SSL配置信息
3. 验证证书文件是否存在和可读
4. 测试数据库服务器的SSL支持

## 相关文档

- [SSL配置说明](./SSL_CONFIG_README.md)
- [数据库配置类](./database_config.py)
- [PyMySQL SSL文档](https://pymysql.readthedocs.io/en/latest/user/examples.html#using-ssl-connections)