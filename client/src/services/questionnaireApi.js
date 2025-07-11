import axios from 'axios';

// 创建专门用于问卷分析的axios实例（Python后端）
let baseURL = window.location.origin + '/dev-api-py';
if (window.location.hostname === 'localhost') {
  baseURL = 'http://localhost:9001';
}
 // Python后端端口
const questionnaireRequest = axios.create({
  baseURL, 
  timeout: 60 * 60 * 1000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
questionnaireRequest.interceptors.request.use(
  (config) => {
    console.log('问卷分析API请求:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('问卷分析API请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
questionnaireRequest.interceptors.response.use(
  (response) => {
    console.log('问卷分析API响应成功:', response.status, response.config.url);
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }
    return response;
  },
  (error) => {
    console.error('问卷分析API响应错误:', error);
    if (error.response) {
      return Promise.reject(error.response.data || error.response);
    }
    return Promise.reject({ message: '网络错误，请检查Python后端是否启动' });
  }
);

export const questionnaireApi = {
  // 上传问卷数据
  upload: (file) => {
    let formData = new FormData();
    formData.append('file', file);
    console.log('上传问卷文件:', file);
    return questionnaireRequest.post('/upload-questionnaire', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  classification: (params) => questionnaireRequest.post('/classification', params, {
    headers: {
      'Content-Type': 'application/json'
    },
  }),

  // 统计分析
  statistics: (params) => questionnaireRequest.post('/statistics', params, {
    headers: {
      'Content-Type': 'application/json'
    },
  }),

  // 获取分析结果
  getAnalysisResults: (analysisId) => questionnaireRequest.get(`/analysis-results/${analysisId}`),

  // 下载Classification结果
  downloadClassification: (analysisId) => questionnaireRequest.get(`/download-classification/${analysisId}`)
}; 