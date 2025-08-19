# 社媒AI分析工具 - Dash Social v1.0

基于Flask + Vue.js的社交媒体数据分析系统，专注于Dash Social数据的上传、存储和智能分析。

## 🎯 功能特性

### 核心功能
- **📊 数据上传**: 支持Excel/CSV格式文件上传，自动数据清洗和去重
- **🤖 智能分析**: 三大专项分析功能
  - **Brand Mention**: 品牌提及监控和统计
  - **Sentiment**: 情感分析和负面原因分类
  - **Bad Case**: 极端用户和异常情况检测
- **📈 可视化展示**: 丰富的图表和统计信息展示
- **🕒 历史记录**: 完整的上传和分析历史追踪

### 技术特点
- 响应式Web界面，支持PC和移动端
- 基于TiDB的分布式数据存储
- 实时数据处理和分析
- 完善的错误处理和用户反馈

## 🏗️ 系统架构

### 后端架构
```
backend/
├── app.py              # Flask主应用入口
├── models/             # 数据模型定义
├── controllers/        # 控制器层
├── services/           # 业务逻辑层
├── utils/              # 工具函数
└── uploads/            # 文件上传目录
```

### 前端架构
```
frontend/
├── src/
│   ├── views/          # 页面组件
│   ├── components/     # 通用组件
│   ├── api/            # API接口
│   └── router/         # 路由配置
└── package.json        # 前端依赖配置
```

### 数据库设计
```
config/
├── database_schema.sql    # 数据库表结构
├── database_config.py     # 数据库连接配置
└── cfg.yaml              # 系统配置文件
```

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- TiDB数据库（或兼容MySQL的数据库）

### 1. 数据库初始化

首先创建数据库和表结构：

```sql
-- 连接到你的TiDB数据库
mysql -h your-tidb-host -P 4000 -u your-username -p

-- 创建数据库
CREATE DATABASE social_media_analysis;
USE social_media_analysis;

-- 导入表结构
source config/database_schema.sql;
```

### 2. 后端设置

```bash
# 进入后端目录
cd socialmedia/backend

# 安装Python依赖
pip install -r requirements.txt

# 配置数据库连接
# 编辑 config/cfg.yaml 文件，设置你的TiDB连接信息

# 启动后端服务
python app.py
```

后端服务将在 `http://localhost:5000` 启动

### 3. 前端设置

```bash
# 进入前端目录
cd socialmedia/frontend

# 安装Node.js依赖
npm install

# 启动开发服务器
npm run dev
```

前端应用将在 `http://localhost:3000` 启动

### 4. 访问系统

打开浏览器访问 `http://localhost:3000`，即可开始使用系统。

## 📊 使用指南

### 数据上传
1. 准备Excel或CSV格式的社交媒体数据文件
2. 确保文件包含以下推荐字段：
   - `content`: 评论内容（必需）
   - `user_id`: 用户ID
   - `platform`: 平台名称
   - `timestamp`: 时间戳
   - `sentiment_score`: 情感分数
   - `sentiment_label`: 情感标签
3. 在"数据上传"页面选择文件并上传
4. 系统将自动进行数据清洗、去重和存储

### 数据分析
1. 在"数据分析"页面配置分析参数：
   - 选择或输入关键词
   - 设置时间范围
   - 选择分析类型
2. 点击"开始分析"执行分析
3. 查看三大专项分析结果：
   - **品牌提及监控**: 关键词提及次数、情感分布、平台分布
   - **情感分析**: 整体情感分布、负面原因分析、典型示例
   - **特殊情况分析**: 风险评估、极端用户、需要关注的内容

### 历史记录
- 查看所有上传文件的处理状态和统计信息
- 浏览历史分析任务和结果
- 重新分析已上传的数据

## 🔧 配置说明

### 数据库配置

编辑 `config/cfg.yaml` 文件：

```yaml
databases:
  tidb_social:
    host: your-tidb-host
    port: 4000
    database: social_media_analysis
    username: your-username
    password: your-password
    charset: utf8mb4
```

### 系统配置

在 `backend/app.py` 中可以调整：
- 文件上传大小限制（默认50MB）
- 服务器端口（默认5000）
- 调试模式开关

## 📝 API接口文档

### 文件上传
- `POST /api/upload` - 上传文件
- `GET /api/upload/history` - 获取上传历史
- `GET /api/upload/stats` - 获取上传统计

### 数据分析
- `POST /api/analyze` - 执行数据分析
- `GET /api/keywords` - 获取关键词配置
- `POST /api/keywords` - 添加关键词

### 系统状态
- `GET /api/health` - 健康检查
- `GET /api/database/status` - 数据库状态

## 🐛 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查 `cfg.yaml` 中的数据库配置
   - 确认TiDB服务正常运行
   - 验证网络连接和防火墙设置

2. **文件上传失败**
   - 检查文件格式是否为Excel或CSV
   - 确认文件大小不超过50MB
   - 检查文件内容格式是否正确

3. **分析结果为空**
   - 确认已上传相关数据
   - 检查关键词和时间范围设置
   - 验证数据库中是否有匹配的记录

### 日志查看

后端日志会显示在控制台，包含详细的错误信息和处理过程。

## 🔄 更新部署

### 开发环境更新
```bash
# 后端更新
cd socialmedia/backend
pip install -r requirements.txt
python app.py

# 前端更新
cd socialmedia/frontend
npm install
npm run dev
```

### 生产环境部署
```bash
# 前端构建
cd socialmedia/frontend
npm run build

# 后端生产部署
cd socialmedia/backend
# 使用gunicorn或其他WSGI服务器
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 📞 技术支持

如有问题或建议，请：
1. 查看本文档的故障排查部分
2. 检查系统日志和错误信息
3. 联系开发团队获取技术支持

## 📄 许可证

本项目采用 MIT 许可证，详情请查看 LICENSE 文件。

---

**版本**: v1.0.0  
**更新时间**: 2024年1月  
**开发团队**: AI开发团队