import api from './index'

/**
 * 通用API接口
 */

// 健康检查
export const checkHealth = () => {
  return api.get('/health')
}

// 获取数据库状态
export const getDatabaseStatus = () => {
  return api.get('/database/status')
}