# SSL模式配置说明

## 概述

数据库连接现在支持根据`.env`文件中的`DB_SSL_MODE`字段值来动态判断是否启用SSL连接。

## 支持的SSL模式

### 1. DISABLED - 关闭SSL
- **用途**: 开发环境、内网环境
- **特点**: 不启用SSL连接，性能最好，安全性最低
- **配置**: `DB_SSL_MODE=DISABLED`

### 2. REQUIRED - 开启SSL
- **用途**: 测试环境、云数据库
- **特点**: 强制启用SSL连接，但不验证证书，平衡安全性和性能
- **配置**: `DB_SSL_MODE=REQUIRED`

### 3. VERIFY_CA - 验证CA证书
- **用途**: 生产环境
- **特点**: 启用SSL连接并验证CA证书，推荐用于生产环境
- **配置**: 
  ```bash
  DB_SSL_MODE=VERIFY_CA
  DB_SSL_CA=./certs/ca-cert.pem
  ```

### 4. VERIFY_IDENTITY - 双向SSL认证
- **用途**: 高安全环境
- **特点**: 启用SSL连接并验证服务器身份，最高安全性
- **配置**: 
  ```bash
  DB_SSL_MODE=VERIFY_IDENTITY
  DB_SSL_CA=./certs/ca-cert.pem
  DB_SSL_CERT=./certs/client-cert.pem
  DB_SSL_KEY=./certs/client-key.pem
  ```

## 配置示例

### 创建.env文件

在`server/socialmedia/`目录下创建`.env`文件：

```bash
# 基础数据库配置
DB_HOST=10.51.32.12
DB_PORT=4000
DB_DATABASE=mkt
DB_USERNAME=root
DB_PASSWORD=your_password_here
DB_CHARSET=utf8mb4

# SSL配置 - 选择一种模式
DB_SSL_MODE=REQUIRED

# 如果使用VERIFY_CA或VERIFY_IDENTITY模式，添加证书路径
# DB_SSL_CA=./certs/ca-cert.pem
# DB_SSL_CERT=./certs/client-cert.pem
# DB_SSL_KEY=./certs/client-key.pem
```

## 自动降级机制

系统具有智能的SSL配置处理：

1. **证书缺失自动降级**: 如果配置了`VERIFY_CA`但CA证书不存在，系统会自动降级到基本SSL模式
2. **路径解析**: 支持相对路径和绝对路径的证书文件
3. **错误处理**: 提供详细的日志输出，便于故障排除

## 日志输出

系统会在连接时输出详细的SSL配置信息：

```
SSL配置: ssl_mode=REQUIRED, ssl_ca=
SSL模式: REQUIRED - 启用SSL连接（不验证证书）
SSL已启用，配置: ['ssl']
添加SSL参数: ssl = {} (启用SSL连接)
```

## 注意事项

1. **文件位置**: `.env`文件必须放在`server/socialmedia/`目录下
2. **权限设置**: 确保`.env`文件有适当的读取权限
3. **证书文件**: 如果使用证书验证，确保证书文件存在且可读
4. **重启生效**: 修改`.env`文件后需要重启应用程序

## 故障排除

### 常见问题

1. **SSL连接失败**
   - 检查`DB_SSL_MODE`设置是否正确
   - 确认数据库服务器支持SSL连接
   - 查看日志输出中的错误信息

2. **证书文件找不到**
   - 检查证书文件路径是否正确
   - 确认文件权限设置
   - 系统会自动降级到基本SSL模式

3. **性能问题**
   - `DISABLED`模式性能最好
   - `REQUIRED`模式平衡性能和安全性
   - 证书验证模式会有轻微性能开销

### 调试方法

1. 查看控制台输出的SSL配置日志
2. 检查数据库连接是否成功
3. 验证环境变量是否正确加载
4. 确认证书文件路径和权限 