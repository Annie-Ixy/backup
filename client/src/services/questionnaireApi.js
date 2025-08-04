import axios from 'axios';

// 创建专门用于问卷分析的axios实例（Python后端）
let baseURL = window.location.origin + '/dev-api-py';
if (window.location.hostname === 'localhost') {
  baseURL = 'http://localhost:9001';
}
 // Python后端端口
const questionnaireRequest = axios.create({
  baseURL, 
  timeout: 120 * 60 * 1000, // 请求超时时间
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

  // 翻译开放题 (修改为支持选择字段)
  translateOpenQuestions: (analysisId, selectedFields = null) => {
    const requestData = { analysisId };
    if (selectedFields && selectedFields.length > 0) {
      requestData.selectedFields = selectedFields;
    }
    return questionnaireRequest.post('/translate-open-questions', requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
    });
  },

  // 标准AI打标 (新增)
  standardLabeling: (analysisId) => questionnaireRequest.post('/standard-labeling', {
    analysisId
  }, {
    headers: {
      'Content-Type': 'application/json'
    },
  }),

  classification: (params) => questionnaireRequest.post('/classification', params, {
    headers: {
      'Content-Type': 'application/json'
    },
  }),

  // 基于参考标签重新打标 (修改)
  retagWithReference: (analysisId, referenceTags) => questionnaireRequest.post('/retag-with-reference', {
    analysisId,
    reference_tags: referenceTags
  }, {
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

// 获取API基础URL
const getApiBaseURL = () => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:9001';
  }
  return window.location.origin + '/dev-api-py';
};

// 手动编辑标签相关API
export const getTagsForEditing = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/get-tags-for-editing/${analysisId}`);
  if (!response.ok) {
    throw new Error('获取标签编辑数据失败');
  }
  return response.json();
};

// AI打标编辑API (新增)
export const getAITagsForEditing = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/get-ai-tags-for-editing/${analysisId}`);
  if (!response.ok) {
    throw new Error('获取AI打标编辑数据失败');
  }
  return response.json();
};

// 参考标签打标编辑API (新增)
export const getCustomTagsForEditing = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/get-custom-tags-for-editing/${analysisId}`);
  if (!response.ok) {
    throw new Error('获取参考标签编辑数据失败');
  }
  return response.json();
};

export const saveManualTags = async (analysisId, modifications) => {
  const response = await fetch(`${getApiBaseURL()}/save-manual-tags/${analysisId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modifications }),
  });
  
  if (!response.ok) {
    throw new Error('保存标签修改失败');
  }
  return response.json();
};

// AI打标保存API (新增)
export const saveAIManualTags = async (analysisId, modifications) => {
  const response = await fetch(`${getApiBaseURL()}/save-ai-manual-tags/${analysisId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modifications }),
  });
  
  if (!response.ok) {
    throw new Error('保存AI打标修改失败');
  }
  return response.json();
};

// 参考标签打标保存API (新增)
export const saveCustomManualTags = async (analysisId, modifications) => {
  const response = await fetch(`${getApiBaseURL()}/save-custom-manual-tags/${analysisId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modifications }),
  });
  
  if (!response.ok) {
    throw new Error('保存参考标签修改失败');
  }
  return response.json();
};

export const batchTagOperations = async (analysisId, operation, tagColumn, targetTag, replacementTag, affectedRows) => {
  const response = await fetch(`${getApiBaseURL()}/batch-tag-operations/${analysisId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation,
      tag_column: tagColumn,
      target_tag: targetTag,
      replacement_tag: replacementTag,
      affected_rows: affectedRows,
    }),
  });
  
  if (!response.ok) {
    throw new Error('批量标签操作失败');
  }
  return response.json();
};

export const downloadFinalResult = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/download-final-result/${analysisId}`);
  if (!response.ok) {
    throw new Error('下载最终结果失败');
  }
  return response.blob();
};

// 下载标准AI打标结果 (_standard_ 文件)
export const downloadStandardLabelingResult = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/download-standard-labeling/${analysisId}`);
  if (!response.ok) {
    throw new Error('下载标准AI打标结果失败');
  }
  return response.blob();
};

// 下载标准AI打标手动编辑结果 (_ai_manual_ 文件)
export const downloadAIManualResult = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/download-ai-manual-result/${analysisId}`);
  if (!response.ok) {
    throw new Error('下载AI手动编辑结果失败');
  }
  return response.blob();
};

// 下载参考标签打标结果 (_translate_custom_ 文件)
export const downloadCustomLabelingResult = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/download-custom-labeling/${analysisId}`);
  if (!response.ok) {
    throw new Error('下载参考标签打标结果失败');
  }
  return response.blob();
};

// 下载参考标签手动编辑结果 (_custom_manual_ 文件)
export const downloadCustomManualResult = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/download-custom-manual-result/${analysisId}`);
  if (!response.ok) {
    throw new Error('下载参考标签手动编辑结果失败');
  }
  return response.blob();
};

// 数据库相关API
export const testDatabaseConnection = async () => {
  const response = await fetch(`${getApiBaseURL()}/test-database-connection`);
  if (!response.ok) {
    throw new Error('测试数据库连接失败');
  }
  return response.json();
};

export const importToDatabase = async (analysisId, surveyTopic = '') => {
  const response = await fetch(`${getApiBaseURL()}/import-to-database/${analysisId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      survey_topic: surveyTopic
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '导入数据库失败');
  }
  
  return response.json();
};

export const getDatabaseStatus = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/database-status/${analysisId}`);
  if (!response.ok) {
    throw new Error('获取数据库状态失败');
  }
  return response.json();
};

export const getModificationHistory = async (analysisId) => {
  const response = await fetch(`${getApiBaseURL()}/get-modification-history/${analysisId}`);
  if (!response.ok) {
    throw new Error('获取修改历史失败');
  }
  return response.json();
}; 