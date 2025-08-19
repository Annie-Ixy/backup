# SSL证书配置说明

## 概述
本系统支持通过SSL证书安全连接到TiDB数据库，提供多种SSL验证模式以满足不同的安全需求。

## SSL模式说明

### 1. DISABLED（默认）
- 禁用SSL连接
- 适用于内网环境或不需要加密的场景

### 2. REQUIRED
- 要求SSL连接，但不验证证书
- 提供基本的加密保护
- 适用于需要加密但不需要证书验证的场景

### 3. VERIFY_CA
- 验证CA证书
- 确保连接到受信任的服务器
- 适用于生产环境

### 4. VERIFY_IDENTITY
- 验证CA证书和服务器身份
- 最高级别的安全保护
- 适用于高安全要求的场景

## 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# 基础数据库配置
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_CHARSET=utf8mb4

# SSL配置
DB_SSL_MODE=REQUIRED                    # SSL模式
DB_SSL_CA=/path/to/ca-cert.pem         # CA证书路径
DB_SSL_CERT=/path/to/client-cert.pem   # 客户端证书路径（可选）
DB_SSL_KEY=/path/to/client-key.pem     # 客户端私钥路径（可选）
```

## 证书文件要求

### CA证书 (ca-cert.pem)
- 格式：PEM格式
- 包含：根证书或中间证书
- 用途：验证服务器证书的有效性

### 客户端证书 (client-cert.pem)
- 格式：PEM格式
- 包含：客户端公钥证书
- 用途：双向SSL认证（可选）

### 客户端私钥 (client-key.pem)
- 格式：PEM格式
- 包含：客户端私钥
- 用途：双向SSL认证（可选）

## 配置示例

### 示例1：基本SSL连接
```bash
DB_SSL_MODE=REQUIRED
# 不需要配置证书文件
```

### 示例2：验证CA证书
```bash
DB_SSL_MODE=VERIFY_CA
DB_SSL_CA=/etc/ssl/certs/ca-certificates.crt
```

### 示例3：双向SSL认证
```bash
DB_SSL_MODE=VERIFY_IDENTITY
DB_SSL_CA=/path/to/ca-cert.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
```

## 证书文件路径

证书文件路径可以是：
- 绝对路径：`/etc/ssl/certs/ca-cert.pem`
- 相对路径：`./certs/ca-cert.pem`
- 相对于项目根目录：`certs/ca-cert.pem`

## 故障排除

### 常见错误

1. **SSL连接失败**
   - 检查证书文件是否存在
   - 验证证书文件格式是否正确
   - 确认证书文件权限设置

2. **证书验证失败**
   - 检查CA证书是否有效
   - 确认服务器证书是否由配置的CA签发
   - 验证证书是否过期

3. **权限错误**
   - 确保应用程序有读取证书文件的权限
   - 检查证书文件的用户和组权限

### 调试信息

系统会在连接时输出详细的SSL配置信息：
```
调试 - 环境变量读取结果:
  DB_SSL_MODE: REQUIRED
  DB_SSL_CA: /path/to/ca-cert.pem
  DB_SSL_CERT: /path/to/client-cert.pem
  DB_SSL_KEY: /path/to/client-key.pem
SSL配置: {'ssl': True, 'ssl_ca': '/path/to/ca-cert.pem'}
数据库连接成功: 10.51.32.12:4000 (SSL: True)
```

## 安全建议

1. **证书管理**
   - 定期更新证书
   - 安全存储私钥文件
   - 使用强密码保护私钥

2. **网络安全**
   - 限制数据库访问IP
   - 使用防火墙规则
   - 监控异常连接

3. **日志记录**
   - 记录SSL连接日志
   - 监控证书验证失败
   - 定期检查安全日志

## 相关文档

- [PyMySQL SSL配置](https://pymysql.readthedocs.io/en/latest/user/examples.html#using-ssl-connections)
- [TiDB安全配置](https://docs.pingcap.com/tidb/stable/security-overview)
- [SSL证书管理最佳实践](https://www.openssl.org/docs/man1.1.1/man1/x509.html) 