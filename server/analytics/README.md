# 工具访问统计功能

## 功能概述

这个模块提供了自动统计各个AI工具访问人数的功能，数据保存在JSON文件中，支持实时更新和历史记录。

## 支持的工具

- `home` - 首页
- `customer-service` - 客服工具
- `design-review` - 设计审查
- `questionnaire-analysis` - 问卷分析
- `resume` - 简历分析
- `social-media` - 社媒分析
- `voice-cloning` - 语音克隆

## API接口

### 1. 记录工具访问
- **POST** `/analytics/record-visit`
- **请求体**: `{ "toolKey": "工具标识" }`
- **功能**: 记录指定工具的访问次数

### 2. 获取所有工具统计
- **GET** `/analytics/stats`
- **功能**: 获取所有工具的访问统计数据，按访问量排序

### 3. 获取单个工具统计
- **GET** `/analytics/stats/:toolKey`
- **功能**: 获取指定工具的访问统计数据

### 4. 重置统计数据
- **POST** `/analytics/reset-stats`
- **功能**: 重置所有工具的统计数据（谨慎使用）

## 数据存储

统计数据保存在 `tool_usage_stats.json` 文件中，包含以下信息：

```json
{
  "home": {
    "name": "首页",
    "visitCount": 0,
    "lastVisit": "2024-01-01T00:00:00.000Z",
    "firstVisit": "2024-01-01T00:00:00.000Z"
  }
}
```

## 前端集成

### 自动统计
前端使用 `useAnalytics` Hook 自动记录页面访问：

```javascript
import { useAnalytics } from '../hooks/useAnalytics';

function MyComponent() {
  useAnalytics(); // 自动记录访问
  // ... 组件逻辑
}
```

### 手动统计
也可以手动调用统计接口：

```javascript
import { recordToolVisit } from '../services/analyticsApi';

// 手动记录访问
recordToolVisit('customer-service');
```

## 访问统计页面

访问 `/analytics` 路径可以查看完整的统计数据，包括：

- 总访问量
- 各工具访问次数排名
- 首次和最后访问时间
- 数据刷新和重置功能

## 注意事项

1. **数据准确性**: 统计数据基于页面加载次数，不是独立用户数
2. **性能影响**: 统计接口调用是异步的，不会影响页面加载速度
3. **数据持久性**: 数据保存在服务器本地，重启服务器数据不会丢失
4. **安全性**: 所有接口都需要登录验证，防止恶意调用

## 部署说明

1. 确保 `analytics` 目录已创建
2. 重启服务器以加载新的路由
3. 访问统计页面验证功能是否正常

## 故障排除

如果统计数据不更新：

1. 检查浏览器控制台是否有错误信息
2. 确认后端服务是否正常运行
3. 验证用户是否已登录
4. 检查网络请求是否成功 