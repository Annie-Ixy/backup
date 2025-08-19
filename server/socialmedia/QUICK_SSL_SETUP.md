# 快速SSL设置指南

## 🚀 快速开始

### 1. 创建.env文件

在 `server/socialmedia/` 目录下创建 `.env` 文件：

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
```

### 2. 选择SSL模式

| 模式 | 用途 | 配置 | 安全性 |
|------|------|------|--------|
| `DISABLED` | 开发环境 | `DB_SSL_MODE=DISABLED` | 最低 |
| `REQUIRED` | 测试环境 | `DB_SSL_MODE=REQUIRED` | 中等 |
| `VERIFY_CA` | 生产环境 | `DB_SSL_MODE=VERIFY_CA` | 高 |
| `VERIFY_IDENTITY` | 高安全环境 | `DB_SSL_MODE=VERIFY_IDENTITY` | 最高 |

### 3. 测试配置

运行测试脚本验证配置：

```bash
cd server/socialmedia
python test_ssl_simple.py
```

## 📋 配置示例

### 示例1: 开发环境（无SSL）
```bash
DB_SSL_MODE=DISABLED
```

### 示例2: 测试环境（基本SSL）
```bash
DB_SSL_MODE=REQUIRED
```

### 示例3: 生产环境（验证证书）
```bash
DB_SSL_MODE=VERIFY_CA
DB_SSL_CA=./certs/ca-cert.pem
```

### 示例4: 高安全环境（双向认证）
```bash
DB_SSL_MODE=VERIFY_IDENTITY
DB_SSL_CA=./certs/ca-cert.pem
DB_SSL_CERT=./certs/client-cert.pem
DB_SSL_KEY=./certs/client-key.pem
```

## ⚡ 快速切换

### 启用SSL
```bash
# 编辑.env文件
echo "DB_SSL_MODE=REQUIRED" >> .env
```

### 禁用SSL
```bash
# 编辑.env文件
echo "DB_SSL_MODE=DISABLED" >> .env
```

## 🔍 验证状态

查看当前SSL状态：

```bash
python test_ssl_simple.py
```

输出示例：
```
当前SSL配置:
  DB_SSL_MODE: 'REQUIRED'
  → SSL模式: REQUIRED - 启用SSL连接（不验证证书）

生成的SSL配置:
  SSL配置项: ['ssl']
    ssl: {} (启用SSL连接)
```

## 🚨 常见问题

### Q: 如何知道SSL是否生效？
A: 查看日志输出，会显示"SSL已启用"或"SSL未启用"

### Q: 证书文件找不到怎么办？
A: 系统会自动降级到基本SSL模式，不会影响连接

### Q: 性能影响大吗？
A: `DISABLED`模式性能最好，`REQUIRED`模式影响很小

### Q: 需要重启应用吗？
A: 是的，修改`.env`文件后需要重启应用

## 📚 更多信息

- 详细配置说明：`SSL_MODE_CONFIG.md`
- SSL配置示例：`SSL_CONFIG_EXAMPLE.md`
- 完整测试脚本：`test_ssl_config.py` 