import api from '../utils/request';

// 获取API密钥（从环境变量或配置中获取）
const getApiKey = () => {
  return process.env.REACT_APP_CUSTOMER_API_KEY || 'your-api-key-here';
};

export const customerServiceApi = {
  // 设备故障诊断分析
  analyzeTroubleshooting: async (formData) => {
    // 处理设备型号
    let finalModelNumber = formData.modelNumber;
    if (formData.modelNumber === '其它' && formData.customModelNumber) {
      finalModelNumber = formData.customModelNumber;
    }
    
    // 处理宠物类型
    let finalPetType = formData.petType;
    if (formData.petType === '其它' && formData.customPetType) {
      finalPetType = formData.customPetType;
    }
    
    // 根据API文档格式化请求参数
    const requestData = {
      language: formData.language || '英文', // 新增语言字段
      deviceSn: formData.deviceSN || '',
      memberId: formData.memberId || '',
      modelNumber: finalModelNumber || '',
      petType: finalPetType || '',
      problemType: formData.problemType || '',
      problemDescription: formData.detailedDescription || '',
      startTime: formData.startTime || new Date().toISOString().slice(0, 16), // 必填，有默认值
      endTime: formData.endTime || new Date().toISOString().slice(0, 16), // 必填，有默认值
      history: [], // 可选的历史记录数组
      test_mode: false // 可选，默认false
    };
    
    try {
      console.log('发送请求数据1:', requestData);
      
      // 只使用代理方式
      const response = await api.post('/customer-service/ai/device/troubleshooting', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      console.log('API响应:', response);
      return response;
    } catch (error) {
      console.error('API调用失败:', error);
      throw error;
    }
  },

  // 获取分析历史记录（可选功能）
  getAnalysisHistory: async (params = {}) => {
    const response = await api.get('/ai/device/analysis-history', {
      params,
      headers: {
        'X-API-Key': getApiKey(),
      },
    });
    
    return response;
  },

  // 获取常见问题解决方案（可选功能）
  getCommonSolutions: async (problemType) => {
    const response = await api.get('/ai/device/common-solutions', {
      params: { problemType },
      headers: {
        'X-API-Key': getApiKey(),
      },
    });
    
    return response;
  },
}; 