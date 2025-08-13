import request from './request'

/**
 * 数据分析API
 */

/**
 * 执行数据分析
 * @param {Object} params - 分析参数
 * @param {Array<string>} params.keywords - 关键词列表
 * @param {string} params.start_date - 开始日期 (YYYY-MM-DD)
 * @param {string} params.end_date - 结束日期 (YYYY-MM-DD)  
 * @param {Array<string>} params.channels - 渠道列表 (可选)
 * @returns {Promise} 分析结果
 */
export const analyzeData = (params) => {
  return request.post('/analyze', {
    keywords: params.keywords || [],
    start_date: params.start_date,
    end_date: params.end_date,
    channels: params.channels || []
  })
}

/**
 * 获取数据概览
 * @returns {Promise} 数据概览信息
 */
export const getDataOverview = () => {
  return request.get('/data_overview')
}

/**
 * 获取可用的渠道列表
 * @returns {Promise} 渠道列表
 */
export const getAvailableChannels = () => {
  return request.get('/channels')
}

/**
 * 获取热门关键词
 * @param {number} limit - 返回数量限制，默认10
 * @returns {Promise} 热门关键词列表
 */
export const getPopularKeywords = (limit = 10) => {
  return request.get('/popular_keywords', {
    params: { limit }
  })
}