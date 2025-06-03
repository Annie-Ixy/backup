import axios from 'axios';

// 创建axios实例
const request = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  timeout: 10000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 在发送请求之前做些什么
    // 可以在这里添加token
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 显示加载状态（可选）
    console.log('发送请求:', config.method?.toUpperCase(), config.url);
    
    return config;
  },
  (error) => {
    // 对请求错误做些什么
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 对响应数据做点什么
    console.log('响应成功:', response.status, response.config.url);
    
    // 统一处理响应数据格式
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }
    return response;
  },
  (error) => {
    // 对响应错误做点什么
    console.error('响应错误:', error);
    
    // 统一错误处理
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // 未授权，清除所有认证信息并跳转到登录页
          sessionStorage.removeItem('token');
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('username');
          window.location.href = '/login';
          break;
        case 403:
          console.error('权限不足');
          break;
        case 404:
          console.error('请求的资源不存在');
          break;
        case 500:
          console.error('服务器内部错误');
          break;
        default:
          console.error(`请求失败: ${status}`);
      }
      
      // 返回后端的错误信息
      return Promise.reject(data || error.response);
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.error('网络错误，请检查网络连接');
      return Promise.reject({ message: '网络错误，请检查网络连接' });
    } else {
      // 其他错误
      console.error('请求配置错误:', error.message);
      return Promise.reject({ message: error.message });
    }
  }
);

// 封装常用的请求方法
export const api = {
  // GET请求
  get: (url, params = {}, config = {}) => {
    return request.get(url, { params, ...config });
  },
  
  // POST请求
  post: (url, data = {}, config = {}) => {
    return request.post(url, data, config);
  },
  
  // PUT请求
  put: (url, data = {}, config = {}) => {
    return request.put(url, data, config);
  },
  
  // DELETE请求
  delete: (url, config = {}) => {
    return request.delete(url, config);
  },
  
  // PATCH请求
  patch: (url, data = {}, config = {}) => {
    return request.patch(url, data, config);
  },
  
  // 文件上传
  upload: (url, formData, config = {}) => {
    return request.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...config,
    });
  },
  
  // 下载文件
  download: (url, params = {}, filename = '') => {
    return request.get(url, {
      params,
      responseType: 'blob',
    }).then(response => {
      // 创建下载链接
      const blob = new Blob([response]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    });
  },
};

// 导出axios实例（用于更复杂的自定义请求）
export default request;

// 导出一些常用的请求函数示例
export const userAPI = {
  // 用户登录
  login: (credentials) => api.post('auth/login', credentials),
  
  // 用户注册
  register: (userData) => api.post('auth/register', userData),
  
  // 获取用户信息
  getUserInfo: () => api.get('user/profile'),
  
  // 更新用户信息
  updateUserInfo: (userData) => api.put('user/profile', userData),
  
  // 退出登录
  logout: () => api.post('auth/logout'),
};

// 简历相关API示例
export const resumeAPI = {
  // 上传简历
  uploadResume: (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.upload('resume/upload', formData);
  },
  
  // 获取简历列表
  getResumeList: (params) => api.get('resume/list', params),
  
  // 获取简历详情
  getResumeDetail: (id) => api.get(`resume/${id}`),
  
  // 删除简历
  deleteResume: (id) => api.delete(`resume/${id}`),
  
  // 筛选简历
  screenResumes: (criteria) => api.post('resume/screen', criteria),
};
