# 前端端口配置说明

## 可用的启动命令

### 1. 默认启动（端口3000）
```bash
npm start
```
- 端口：3000
- 用途：默认开发环境

### 2. 开发环境（端口3001）
```bash
npm run start:dev
```
- 端口：3001
- 用途：开发环境，避免端口冲突

### 3. 生产测试环境（端口3002）
```bash
npm run start:prod
```
- 端口：3002
- 用途：生产环境测试

## 自定义端口

如果需要使用其他端口，可以直接在命令行中指定：

```bash
# Windows
cross-env PORT=3005 npm start

# macOS/Linux
PORT=3005 npm start
```

## 环境变量文件配置

你也可以在项目根目录创建 `.env.local` 文件来设置端口：

```env
# .env.local
PORT=3000
REACT_APP_API_BASE_URL=/dev-api
BROWSER=none
HTTPS=false
```

## 注意事项

1. 确保选择的端口没有被其他应用占用
2. 代理配置在 `src/setupProxy.js` 中，会自动适配任何端口
3. 如果修改了端口，记得更新相关的API调用配置

## 常用端口分配建议

- 3000: React前端（默认）
- 3001: React前端（开发环境）
- 3002: React前端（测试环境）
- 5000: Node.js后端
- 5001: 其他后端服务 