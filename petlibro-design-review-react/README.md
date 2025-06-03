# Petlibro Design Review AI (React Version)

通过AI工具提高Petlibro产品设计稿的审核准确度和效率。支持PDF文档和图片文件的智能审核。

## 🚀 主要功能

- **多格式支持**: 支持PDF、Word、Excel、图片等多种文件格式
- **AI智能审核**: 使用OpenAI GPT-4o进行内容审核
- **多语言支持**: 支持中文、英文等7种语言
- **实时处理**: 上传文件后实时处理和显示结果
- **详细报告**: 生成Excel、HTML等格式的详细审核报告
- **现代化UI**: 基于React和Tailwind CSS的响应式界面

## 🏗️ 技术架构

### 前端
- **React 18**: 现代化前端框架
- **TypeScript**: 类型安全
- **Tailwind CSS**: 实用优先的CSS框架
- **Framer Motion**: 流畅动画
- **Lucide React**: 图标库
- **React Dropzone**: 文件拖拽上传
- **Axios**: HTTP客户端

### 后端
- **Node.js + Express**: 后端服务
- **OpenAI API**: AI内容审核
- **PDF-Parse**: PDF文件解析
- **Sharp**: 图片处理
- **Tesseract.js**: OCR文字识别
- **Mammoth**: Word文档处理
- **XLSX**: Excel文件处理

## 📋 系统要求

- Node.js 16+
- npm 或 yarn
- OpenAI API Key
- poppler-utils (用于PDF转图片功能)

## 🔧 安装配置

### 1. 克隆项目
```bash
git clone <repository-url>
cd petlibro-design-review-react
```

### 2. 安装系统依赖 (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install -y poppler-utils
```

### 3. 安装依赖
```bash
# 安装所有依赖
npm run install-all
```

### 4. 配置环境变量

在 `server` 目录下创建 `.env` 文件：
```bash
cd server
cp env.example .env
```

编辑 `.env` 文件，添加你的OpenAI API Key：
```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
PORT=5000
NODE_ENV=development
```

## 🚀 启动应用

### 开发模式
```bash
# 同时启动前端和后端
npm run dev
```

或者分别启动：
```bash
# 启动后端服务器 (端口5000)
npm run server

# 启动前端应用 (端口3000)
npm run client
```

### 生产模式
```bash
# 构建前端
npm run build

# 启动后端服务
npm start
```

## 📖 使用指南

### 1. 上传文件
- 打开应用后，选择审核语言和审核维度
- 拖拽或点击上传需要审核的文件
- 支持的文件格式：
  - 文档：PDF, DOC, DOCX, XLS, XLSX, TXT
  - 图片：JPG, JPEG, PNG, GIF, BMP, TIFF

### 2. 处理文件
- 点击"开始处理"按钮
- 系统会自动：
  - 提取文档内容
  - 对图片进行OCR识别
  - 使用AI进行内容审核
  - 生成审核结果

### 3. 查看结果
- 在"审核结果"标签页查看详细的问题列表
- 问题按严重程度分类：高、中、低
- 每个问题包含：
  - 问题类型
  - 具体位置
  - 原始文本
  - 修改建议
  - 问题说明

### 4. 导出报告
- 在"报告导出"标签页选择导出格式
- 支持的格式：
  - Excel报告：详细的问题列表和统计
  - HTML报告：可视化的网页报告
  - JSON报告：结构化数据

## 🎯 审核维度

### 基本检查
- 拼写错误
- 语法错误
- 标点符号使用

### 进阶检查
- 术语一致性
- 品牌名称准确性（Petlibro）
- 上下文分析
- 格式统一性

## 🔧 API端点

### 服务器健康检查
```
GET /api/health
```

### 获取配置信息
```
GET /api/config
```

### 上传文件
```
POST /api/upload
Content-Type: multipart/form-data
Body: files[]
```

### 处理文件
```
POST /api/process
Body: {
  fileIds: string[],
  language: string,
  reviewCategories: string[]
}
```

### 生成报告
```
POST /api/generate-report
Body: {
  fileId: string,
  reviewResult: object,
  processedData: object,
  format: string
}
```

### 下载报告
```
GET /api/download/:filename
```

## 🚨 注意事项

1. **API费用**: 使用OpenAI API会产生费用，请注意监控使用量
2. **文件大小**: 单个文件最大支持100MB
3. **并发限制**: 建议同时处理不超过10个文件
4. **OCR准确性**: 图片文字识别的准确性取决于图片质量
5. **隐私保护**: 请勿上传包含敏感信息的文件

## 🛠️ 故障排除

### 常见问题

**1. 无法连接到服务器**
- 检查后端服务是否正在运行
- 确认端口5000没有被占用
- 检查防火墙设置

**2. OpenAI API错误**
- 验证API Key是否正确
- 检查API余额
- 确认网络连接正常

**3. 文件处理失败**
- 检查文件格式是否支持
- 确认文件没有损坏
- 查看服务器日志获取详细错误信息

**4. OCR识别率低**
- 确保图片清晰度足够
- 图片中的文字应该是正向的
- 避免使用手写文字的图片

## 📈 后续优化

- [ ] 添加批量处理进度条
- [ ] 支持更多文件格式
- [ ] 添加历史记录功能
- [ ] 实现用户认证系统
- [ ] 添加自定义审核规则
- [ ] 支持团队协作功能
- [ ] 添加审核结果对比功能
- [ ] 实现自动修正功能

## 🤝 贡献指南

欢迎提交Issue和Pull Request来帮助改进这个项目。

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请通过Issue联系我们。 