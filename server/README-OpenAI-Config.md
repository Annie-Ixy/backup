# OpenAI 配置说明

## 概述

本项目提供了一个统一的OpenAI配置管理方案，支持根据环境自动判断是否使用代理。

## 环境变量配置

### 代理控制选项

有三种方式可以控制是否使用代理：

1. **USE_PROXY** - 直接控制代理使用
   ```bash
   USE_PROXY=true    # 使用代理
   USE_PROXY=false   # 不使用代理
   ```

2. **NODE_ENV** - 通过环境控制
   ```bash
   NODE_ENV=development  # 开发环境自动使用代理
   NODE_ENV=production   # 生产环境不使用代理
   ```

3. **PROXY_ENABLED** - 显式启用代理
   ```bash
   PROXY_ENABLED=true    # 启用代理
   PROXY_ENABLED=false   # 禁用代理
   ```

### 代理服务器配置

```bash
# 代理服务器地址（可选，默认为 http://127.0.0.1:7890）
PROXY_URL=http://127.0.0.1:7890
```

## 使用方法

### 1. 创建OpenAI实例

```javascript
const { createOpenAIInstance } = require('./utils/openaiConfig');

// 自动根据环境配置创建OpenAI实例
const openai = createOpenAIInstance();
```

### 2. 获取配置信息

```javascript
const { getProxyStatus } = require('./utils/openaiConfig');

// 获取当前代理状态
const status = getProxyStatus();
console.log(status);
// 输出示例：
// {
//   useProxy: true,
//   proxyUrl: 'http://127.0.0.1:7890',
//   nodeEnv: 'development',
//   useProxyEnv: 'true',
//   proxyEnabledEnv: undefined
// }
```

### 3. 自定义配置

```javascript
const { createOpenAIConfig } = require('./utils/openaiConfig');

// 获取配置对象，可以进一步自定义
const config = createOpenAIConfig();
config.timeout = 60000; // 自定义超时时间

const openai = new OpenAI(config);
```

## 配置优先级

代理使用判断的优先级（从高到低）：

1. `USE_PROXY=true` - 强制使用代理
2. `PROXY_ENABLED=true` - 启用代理
3. `NODE_ENV=development` - 开发环境使用代理
4. 其他情况 - 不使用代理

## 示例环境变量文件

```bash
# .env 文件示例
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-2024-11-20

# 代理配置
USE_PROXY=true
PROXY_URL=http://127.0.0.1:7890

# 服务器配置
PORT=9000
NODE_ENV=development
```

## 测试连接

使用提供的测试脚本验证配置：

```bash
node test-openai-connection.js
```

测试脚本会显示：
- API密钥状态
- 代理配置状态
- 连接测试结果

## 注意事项

1. 确保代理服务器正在运行
2. 如果代理配置失败，系统会自动回退到直连模式
3. 生产环境建议不使用代理，直接连接OpenAI API
4. 所有配置变更后需要重启服务器 