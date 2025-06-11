# Axios 请求封装使用指南

这个目录包含了基于 axios 的请求封装，提供了统一的 API 调用方式和错误处理机制。

## 文件结构

- `request.js` - 主要的 axios 封装文件
- `apiExample.js` - 使用示例和最佳实践
- `README.md` - 使用说明文档

## 主要功能

### 1. 基础配置
- 统一的 baseURL 配置
- 请求超时设置（10秒）
- 自动添加 Authorization token
- 统一的请求/响应格式

### 2. 拦截器功能
- **请求拦截器**：自动添加 token、请求日志
- **响应拦截器**：统一错误处理、响应格式化

### 3. 错误处理
- 401: 自动清除 token 并跳转登录页
- 403: 权限不足提示
- 404: 资源不存在提示
- 500: 服务器错误提示
- 网络错误处理

## 使用方法

### 基础用法

```javascript
import { api } from '../utils/request';

// GET 请求
const getData = async () => {
  try {
    const response = await api.get('/users', { page: 1, limit: 10 });
    console.log(response);
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// POST 请求
const createUser = async (userData) => {
  try {
    const response = await api.post('/users', userData);
    console.log('用户创建成功:', response);
  } catch (error) {
    console.error('创建失败:', error);
  }
};
```

### 在 React 组件中使用

```javascript
import React, { useState, useEffect } from 'react';
import { api, userAPI } from '../utils/request';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await userAPI.getUserInfo();
        setUser(userData);
      } catch (error) {
        console.error('获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <h1>用户信息</h1>
      <p>姓名: {user?.name}</p>
      <p>邮箱: {user?.email}</p>
    </div>
  );
};
```

### 文件上传

```javascript
import { api } from '../utils/request';

const FileUpload = () => {
  const handleFileUpload = async (file) => {
    try {
      const response = await api.upload('/upload', file, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`上传进度: ${percentCompleted}%`);
        },
      });
      console.log('上传成功:', response);
    } catch (error) {
      console.error('上传失败:', error);
    }
  };

  return (
    <input
      type="file"
      onChange={(e) => handleFileUpload(e.target.files[0])}
    />
  );
};
```

### 预定义 API 函数

项目中已经预定义了一些常用的 API 函数：

#### 用户相关 API
```javascript
import { userAPI } from '../utils/request';

// 登录
const login = await userAPI.login({ email, password });

// 注册
const register = await userAPI.register(userData);

// 获取用户信息
const userInfo = await userAPI.getUserInfo();

// 更新用户信息
const updated = await userAPI.updateUserInfo(userData);
```

#### 简历相关 API
```javascript
import { resumeAPI } from '../utils/request';

// 上传简历
const uploadResult = await resumeAPI.uploadResume(file);

// 获取简历列表
const resumeList = await resumeAPI.getResumeList({ page: 1 });

// 获取简历详情
const resumeDetail = await resumeAPI.getResumeDetail(resumeId);

// 筛选简历
const screenResult = await resumeAPI.screenResumes(criteria);
```

## 环境配置

在项目根目录创建 `.env` 文件来配置 API 基础地址：

```env
REACT_APP_API_BASE_URL=http://localhost:5001/api
```

如果不设置，默认使用 `http://localhost:5001/api`。

## 高级用法

### 自定义请求配置

```javascript
import request from '../utils/request';

// 使用原始 axios 实例进行复杂请求
const customRequest = await request({
  method: 'POST',
  url: '/custom-endpoint',
  data: { key: 'value' },
  headers: {
    'Custom-Header': 'custom-value'
  },
  timeout: 5000
});
```

### 请求重试

```javascript
import { requestWithRetry } from '../utils/apiExample';

// 重试机制
const data = await requestWithRetry(
  () => api.get('/unstable-endpoint'),
  3 // 最大重试次数
);
```

### 批量请求

```javascript
import { batchRequests } from '../utils/apiExample';

const requests = [
  api.get('/users'),
  api.get('/posts'),
  api.get('/comments')
];

const results = await batchRequests(requests);
```

## 错误处理最佳实践

1. **总是使用 try-catch**：包装所有 API 调用
2. **用户友好的错误信息**：将技术错误转换为用户可理解的信息
3. **加载状态管理**：在请求期间显示加载指示器
4. **网络错误处理**：处理网络连接问题

```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchData = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const data = await api.get('/data');
    // 处理成功响应
  } catch (err) {
    setError('获取数据失败，请稍后重试');
    console.error('API Error:', err);
  } finally {
    setLoading(false);
  }
};
```

## 注意事项

1. **Token 管理**：登录成功后记得保存 token 到 localStorage
2. **请求取消**：对于长时间运行的请求，考虑实现取消机制
3. **缓存策略**：对于不经常变化的数据，考虑实现缓存
4. **安全性**：敏感信息不要在客户端存储，使用 HTTPS

## 扩展功能

如需添加新的 API 端点，可以在 `request.js` 文件中添加新的 API 对象：

```javascript
export const newFeatureAPI = {
  getData: (params) => api.get('/new-feature/data', params),
  createItem: (data) => api.post('/new-feature/items', data),
  updateItem: (id, data) => api.put(`/new-feature/items/${id}`, data),
  deleteItem: (id) => api.delete(`/new-feature/items/${id}`),
};
``` 