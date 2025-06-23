import { api } from '../utils/request';

export const questionnaireApi = {
  // 上传问卷数据
  upload: (file) => {
    let formData = new FormData();
    formData.append('file', file);
    console.log(formData, '333', file);
    return api.upload('/test/upload-questionnaire', formData);
  },

  // 发起文本分析
  analyze: (params) => api.post('/test/analyze-text', params),

  // 获取分析结果
  getResult: (analysisId) => api.get(`/test/analysis-results/${analysisId}`),

  // 统计分析
  statistics: (params) => api.post('/test/statistics', params),

  // 趋势分析
  trend: (params) => api.post('/test/trend-analysis', params),

  // 导出分析结果
  export: (analysisId, format = 'csv') => api.download(`/test/export/${analysisId}`, { format }, `analysis-${analysisId}.${format}`),

  // 获取分析历史
  history: () => api.get('/test/analysis-history'),
}; 