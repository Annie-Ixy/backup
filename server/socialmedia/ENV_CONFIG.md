# 环境变量配置说明

## 概述

该项目已支持使用环境变量进行配置，提高了安全性和部署灵活性。

## 配置优先级

系统按以下优先级读取配置：

1. **`.env` 文件** (最高优先级)
2. **系统环境变量**
3. **`cfg.yaml` 配置文件** (最低优先级)

## 快速开始

### 1. 创建环境配置文件

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置文件
# 填入你的实际配置值
```

### 2. 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DB_HOST` | TiDB数据库主机地址 | `10.51.32.12` |
| `DB_PORT` | TiDB数据库端口 | `4000` |
| `DB_DATABASE` | 数据库名称 | `mkt` |
| `DB_USERNAME` | 数据库用户名 | `root` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `DB_CHARSET` | 数据库字符集 | `utf8mb4` |

### 3. 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FRONTEND_PORT` | 前端服务端口 | `3002` |
| `BACKEND_PORT` | 后端服务端口 | `9002` |
| `MAX_FILE_SIZE` | 最大文件上传大小(字节) | `52428800` |
| `UPLOAD_FOLDER` | 文件上传目录 | `./uploads` |
| `LOG_LEVEL` | 日志级别 | `INFO` |
| `CORS_ORIGINS` | 跨域允许的源 | `http://localhost:3002,http://127.0.0.1:3002` |
| `RATE_LIMIT_PER_MINUTE` | API每分钟请求限制 | `60` |

## 安全注意事项

### ⚠️ 重要提醒

1. **永远不要提交 `.env` 文件到版本控制系统**
2. `.env` 文件包含敏感信息，应该保持私密
3. 使用 `.env.example` 作为模板分享配置结构

### 📁 文件说明

- **`.env`** - 包含实际配置值的文件（被git忽略）
- **`.env.example`** - 配置模板文件（可以提交到git）
- **`.gitignore`** - 确保敏感文件不被追踪

## 部署方式

### 开发环境

```bash
# 1. 复制配置文件
cp .env.example .env

# 2. 编辑 .env 文件，填入开发环境配置
# 3. 启动服务
./start.sh  # Linux/Mac
# 或
start.bat   # Windows
```

### 生产环境

```bash
# 方式1: 使用 .env 文件
cp .env.example .env
# 编辑 .env 文件，填入生产环境配置

# 方式2: 使用系统环境变量
export DB_HOST=production_host
export DB_PASSWORD=production_password
# ... 其他配置

# 启动服务
python backend/app.py
```

### Docker部署

```dockerfile
# Dockerfile示例
FROM python:3.11

# 设置环境变量
ENV DB_HOST=your_host
ENV DB_PASSWORD=your_password
# ... 其他配置

# 或者使用 .env 文件
COPY .env .env

# 其他Docker指令...
```

## 故障排除

### 常见问题

1. **配置不生效**
   - 检查 `.env` 文件是否存在且可读
   - 确认变量名拼写正确
   - 重启服务使配置生效

2. **数据库连接失败**
   - 验证数据库配置变量
   - 检查网络连接
   - 确认数据库服务正常运行

3. **端口冲突**
   - 修改 `FRONTEND_PORT` 或 `BACKEND_PORT`
   - 检查端口是否被其他程序占用

### 调试技巧

```python
# 在Python代码中检查环境变量
import os
print(f"DB_HOST: {os.getenv('DB_HOST')}")
print(f"BACKEND_PORT: {os.getenv('BACKEND_PORT')}")
```

## 迁移指南

### 从cfg.yaml迁移

1. 查看当前 `config/cfg.yaml` 中的配置
2. 复制 `.env.example` 为 `.env`
3. 将yaml中的值转移到 `.env` 文件
4. 测试服务启动和数据库连接
5. 删除或备份 `cfg.yaml`（可选）

## 更多信息

- [python-dotenv文档](https://python-dotenv.readthedocs.io/)
- [十二因子应用配置](https://12factor.net/config)
- [环境变量最佳实践](https://blog.bitsrc.io/environment-variables-in-node-js-the-right-way-e18ca6103fa7)