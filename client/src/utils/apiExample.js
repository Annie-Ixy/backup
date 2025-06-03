// API使用示例文件
// 展示如何在React组件中使用封装的请求函数

import { useState } from 'react';
import { api, userAPI, resumeAPI } from './request';

// 示例1: 在React组件中使用基础API
export const useBasicAPI = () => {
  // 基础GET请求
  const fetchData = async () => {
    try {
      const response = await api.get('/data', { page: 1, limit: 10 });
      console.log('获取数据成功:', response);
      return response;
    } catch (error) {
      console.error('获取数据失败:', error);
      throw error;
    }
  };

  // 基础POST请求
  const createData = async (data) => {
    try {
      const response = await api.post('/data', data);
      console.log('创建数据成功:', response);
      return response;
    } catch (error) {
      console.error('创建数据失败:', error);
      throw error;
    }
  };

  return { fetchData, createData };
};

// 示例2: 用户相关操作
export const useUserAPI = () => {
  // 用户登录
  const login = async (email, password) => {
    try {
      const response = await userAPI.login({ email, password });
      
      // 登录成功后保存token
      if (response.token) {
        sessionStorage.setItem('token', response.token);
      }
      
      console.log('登录成功:', response);
      return response;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  };

  // 获取用户信息
  const getUserProfile = async () => {
    try {
      const response = await userAPI.getUserInfo();
      console.log('获取用户信息成功:', response);
      return response;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw error;
    }
  };

  // 用户注册
  const register = async (userData) => {
    try {
      const response = await userAPI.register(userData);
      console.log('注册成功:', response);
      return response;
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  };

  return { login, getUserProfile, register };
};

// 示例3: 简历相关操作
export const useResumeAPI = () => {
  // 上传简历
  const uploadResume = async (file) => {
    try {
      const response = await resumeAPI.uploadResume(file);
      console.log('简历上传成功:', response);
      return response;
    } catch (error) {
      console.error('简历上传失败:', error);
      throw error;
    }
  };

  // 获取简历列表
  const getResumeList = async (filters = {}) => {
    try {
      const response = await resumeAPI.getResumeList(filters);
      console.log('获取简历列表成功:', response);
      return response;
    } catch (error) {
      console.error('获取简历列表失败:', error);
      throw error;
    }
  };

  // 筛选简历
  const screenResumes = async (criteria) => {
    try {
      const response = await resumeAPI.screenResumes(criteria);
      console.log('简历筛选成功:', response);
      return response;
    } catch (error) {
      console.error('简历筛选失败:', error);
      throw error;
    }
  };

  return { uploadResume, getResumeList, screenResumes };
};

// 示例4: 在React Hook中使用
export const useAPIWithState = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchDataWithState = async (url, params = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(url, params);
      setData(response);
      return response;
    } catch (err) {
      setError(err.message || '请求失败');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, data, fetchDataWithState };
};

// 示例5: 文件上传进度监控
export const uploadFileWithProgress = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.upload('/upload', formData, {
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        if (onProgress) {
          onProgress(percentCompleted);
        }
      },
    });
    
    console.log('文件上传成功:', response);
    return response;
  } catch (error) {
    console.error('文件上传失败:', error);
    throw error;
  }
};

// 示例6: 批量请求
export const batchRequests = async (requests) => {
  try {
    const responses = await Promise.all(requests);
    console.log('批量请求成功:', responses);
    return responses;
  } catch (error) {
    console.error('批量请求失败:', error);
    throw error;
  }
};

// 使用示例:
// const requests = [
//   api.get('/users'),
//   api.get('/posts'),
//   api.get('/comments')
// ];
// batchRequests(requests);

// 示例7: 请求重试机制
export const requestWithRetry = async (requestFn, maxRetries = 3) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await requestFn();
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`请求失败，第 ${i + 1} 次重试...`);
      
      // 等待一段时间后重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

// 使用示例:
// requestWithRetry(() => api.get('/unstable-endpoint')); 