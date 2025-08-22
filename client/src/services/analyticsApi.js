import request from '../utils/request';

// 记录工具访问
export const recordToolVisit = async (toolKey, username) => {
  console.log(`开始记录工具访问: ${toolKey}, 用户: ${username}`);
  if (window.location.hostname.includes('localhost') || window.location.hostname.includes('dope-test')){
    return console.log('localhost or dope-test not record');
  } 
  try {
    const response = await request.post('/test/analytics/record-visit', {
      toolKey,
      username
    });
    
    if (response.data && response.data.alreadyVisitedToday) {
      console.log(`ℹ️ 用户 ${username} 今天已经访问过工具 ${toolKey}，不重复记录`);
    } else {
      console.log(`✅ 工具访问记录成功: ${toolKey}, 用户: ${username}`, response);
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ 记录工具访问失败: ${toolKey}, 用户: ${username}`, error);
    // 不抛出错误，避免影响正常功能
    return { success: false, error: error.message };
  }
};

// 获取所有工具的访问统计
export const getToolStats = async () => {
  try {
    const response = await request.get('/test/analytics/stats');
    return response;
  } catch (error) {
    console.error('获取工具统计失败:', error);
    return { success: false, data: { tools: [], totalVisits: 0 } };
  }
};

// 获取单个工具的访问统计
export const getSingleToolStats = async (toolKey) => {
  try {
    const response = await request.get(`/test/analytics/stats/${toolKey}`);
    return response.data;
  } catch (error) {
    console.error('获取单个工具统计失败:', error);
    return { success: false, data: null };
  }
};

// 重置统计数据
export const resetToolStats = async () => {
  try {
    const response = await request.post('/test/analytics/reset-stats');
    return response.data;
  } catch (error) {
    console.error('重置统计数据失败:', error);
    return { success: false };
  }
}; 