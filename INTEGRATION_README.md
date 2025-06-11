# AI智能工具平台 - 集成版本

这个应用集成了两个主要的AI功能：
1. **简历筛选** - 原有功能
2. **设计稿审核** - 新集成功能

## 功能特性

### 1. 简历筛选功能
- 智能简历分析和排序
- 候选人匹配度评估
- 批量处理简历文件
- 详细的分析报告

### 2. 设计稿审核功能
- AI驱动的设计稿质量检测
- 多语言支持（中文、英文等）
- 多维度审核（基础检查、高级检查等）
- 支持多种文件格式（PDF、DOC、DOCX、图片等）
- Excel和HTML格式的详细报告导出

## 技术架构

### 前端
- React 18
- React Router DOM (路由管理)
- Tailwind CSS (样式)
- Framer Motion (动画)
- Lucide React (图标)
- React Dropzone (文件上传)

### 后端服务
- **简历筛选服务**: 端口 9000
- **设计稿审核服务**: 端口 5000
- **用户认证服务**: 远程API

## 启动说明

### 1. 启动前端应用
```bash
cd dl-ai-tools/resume-screening-app/client
npm install
npm start
```
前端将在 http://localhost:3000 启动

### 2. 启动后端服务

#### 简历筛选服务
```bash
cd dl-ai-tools/resume-screening-app/server
# 按照原有方式启动服务 (端口 9000)
```

#### 设计稿审核服务
```bash
cd dl-ai-tools/petlibro-design-review-react/server
# 按照原有方式启动服务 (端口 5000)
```

## 使用流程

### 1. 登录
- 访问 http://localhost:3000
- 使用现有的登录凭据进行登录

### 2. 选择功能
登录后在首页可以看到两个可用的AI工具：
- **简历筛选** (蓝色图标)
- **设计稿审核** (紫色图标)

### 3. 简历筛选
- 点击"简历筛选"进入原有的简历处理功能
- 上传简历文件进行分析

### 4. 设计稿审核
- 点击"设计稿审核"进入新的设计稿检查功能
- 配置语言和审核维度
- 上传需要检查的文件
- 查看详细的审核结果
- 导出Excel或HTML格式的报告

## 代理配置

应用使用了代理配置来连接不同的后端服务：
- `/api/*` → 设计稿审核服务 (localhost:5000)
- `/test/*` → 简历筛选服务 (localhost:9000)  
- `/dev-api/*` → 用户认证服务 (远程API)

## 文件结构

```
dl-ai-tools/resume-screening-app/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js          # 登录页面
│   │   │   ├── Home.js           # 首页 (集成了两个功能的入口)
│   │   │   ├── Resume.js         # 简历筛选页面
│   │   │   └── DesignReview.js   # 设计稿审核页面 (新增)
│   │   ├── components/
│   │   │   └── DesignFileUpload.js # 设计稿文件上传组件 (新增)
│   │   ├── services/
│   │   │   └── designReviewApi.js  # 设计稿审核API服务 (新增)
│   │   ├── App.js                # 路由配置 (已更新)
│   │   └── setupProxy.js         # 代理配置 (已更新)
│   └── package.json
└── server/                       # 简历筛选后端服务
```

## 注意事项

1. **端口冲突**: 确保端口 3000、5000、9000 没有被其他应用占用
2. **服务依赖**: 两个后端服务都需要正常运行才能使用对应功能
3. **文件上传**: 设计稿审核支持的文件格式由后端服务配置决定
4. **认证状态**: 登录状态在两个功能之间共享

## 扩展功能

未来可以继续添加更多AI工具：
- AI对话助手
- 图像分析
- 数据分析
- 文档解析

每个新功能只需要：
1. 在 `Home.js` 中添加工具配置
2. 创建对应的页面组件
3. 在 `App.js` 中添加路由
4. 如需要，在 `setupProxy.js` 中添加代理配置 