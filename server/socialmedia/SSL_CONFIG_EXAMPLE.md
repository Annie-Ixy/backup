# SSL配置示例

## 创建.env文件

在 `server/socialmedia/` 目录下创建 `.env` 文件，内容如下：

## 示例1: 禁用SSL（开发环境）

```bash
# 基础数据库配置
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_CHARSET=utf8mb4

# SSL配置
DB_SSL_MODE=DISABLED
```

## 示例2: 启用SSL但不验证证书（测试环境）

```bash
# 基础数据库配置
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_CHARSET=utf8mb4

# SSL配置
DB_SSL_MODE=REQUIRED
```

## 示例3: 验证CA证书（生产环境）

```bash
# 基础数据库配置
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_CHARSET=utf8mb4

# SSL配置
DB_SSL_MODE=VERIFY_CA
DB_SSL_CA=./certs/ca-cert.pem
```

## 示例4: 双向SSL认证（高安全环境）

```bash
# 基础数据库配置
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_CHARSET=utf8mb4

# SSL配置
DB_SSL_MODE=VERIFY_IDENTITY
DB_SSL_CA=./certs/ca-cert.pem
DB_SSL_CERT=./certs/client-cert.pem
DB_SSL_KEY=./certs/client-key.pem
```

## 注意事项

1. **文件位置**: `.env` 文件应放在 `server/socialmedia/` 目录下
2. **权限设置**: 确保 `.env` 文件有适当的读取权限
3. **证书路径**: 证书文件路径可以是相对路径或绝对路径
4. **自动降级**: 系统会自动处理证书缺失的情况，并降级到合适的SSL模式

## 故障排除

如果遇到SSL连接问题，请检查：

1. `.env` 文件是否存在且格式正确
2. 环境变量是否正确设置
3. 证书文件是否存在且可读
4. 数据库服务器是否支持SSL连接 