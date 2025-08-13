import request from './request'

/**
 * 文件上传API
 */

/**
 * 上传文件
 * @param {File} file - 要上传的文件
 * @param {Function} onProgress - 上传进度回调函数
 * @returns {Promise} 上传结果
 */
export const uploadFile = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  
  return request.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
        onProgress(percentCompleted)
      }
    }
  })
}

/**
 * 获取上传历史记录
 * @returns {Promise} 上传历史列表
 */
export const getUploadHistory = () => {
  return request.get('/upload_history')
}

/**
 * 获取数据库统计信息
 * @returns {Promise} 数据库统计数据
 */
export const getDatabaseStats = () => {
  return request.get('/database_stats')
}