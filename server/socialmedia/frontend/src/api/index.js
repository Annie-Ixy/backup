import axios from 'axios'
import { ElMessage, ElLoading } from 'element-plus'

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
let loadingInstance = null

api.interceptors.request.use(
  config => {
    // 对于上传文件的请求，显示加载状态
    if (config.url.includes('upload') || config.url.includes('analyze')) {
      loadingInstance = ElLoading.service({
        lock: true,
        text: config.url.includes('upload') ? '正在上传文件...' : '正在分析数据...',
        background: 'rgba(0, 0, 0, 0.7)'
      })
    }
    
    return config
  },
  error => {
    if (loadingInstance) {
      loadingInstance.close()
      loadingInstance = null
    }
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 关闭加载状态
    if (loadingInstance) {
      loadingInstance.close()
      loadingInstance = null
    }
    
    // 检查响应状态
    if (response.status === 200) {
      const data = response.data
      
      // 如果后端返回了success字段，根据该字段判断
      if (data.hasOwnProperty('success')) {
        if (data.success) {
          // 成功时显示消息（如果有message字段）
          if (data.message && !data.message.includes('获取到')) {
            ElMessage.success(data.message)
          }
          return data
        } else {
          // 失败时显示错误消息
          const errorMsg = data.message || data.error || '操作失败'
          ElMessage.error(errorMsg)
          return Promise.reject(new Error(errorMsg))
        }
      }
      
      return data
    }
    
    return response.data
  },
  error => {
    // 关闭加载状态
    if (loadingInstance) {
      loadingInstance.close()
      loadingInstance = null
    }
    
    let errorMessage = '网络请求失败'
    
    if (error.response) {
      const { status, data } = error.response
      
      switch (status) {
        case 400:
          errorMessage = data.message || data.error || '请求参数错误'
          break
        case 401:
          errorMessage = '未授权访问'
          break
        case 403:
          errorMessage = '禁止访问'
          break
        case 404:
          errorMessage = 'API接口不存在'
          break
        case 413:
          errorMessage = '上传文件过大'
          break
        case 500:
          errorMessage = data.message || data.error || '服务器内部错误'
          break
        default:
          errorMessage = `网络错误 (${status})`
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = '请求超时，请稍后重试'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    ElMessage.error(errorMessage)
    return Promise.reject(error)
  }
)

export default api