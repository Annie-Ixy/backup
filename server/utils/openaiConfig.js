const { OpenAI } = require('openai');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * 根据环境判断是否使用代理
 * @returns {Object} OpenAI配置对象
 */
function createOpenAIConfig() {
  const config = {
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30 * 1000,  // 30秒连接超时
    maxRetries: 3,       // 最大重试次数
  };

  // 根据环境变量判断是否使用代理
  const useProxy = process.env.USE_PROXY === 'true' || 
                   process.env.NODE_ENV === 'development' ||
                   process.env.PROXY_ENABLED === 'true';
  
  const proxyUrl = process.env.PROXY_URL || '';

  if (useProxy) {
    try {
      const proxyAgent = new HttpsProxyAgent(proxyUrl);
      config.httpAgent = proxyAgent;
      console.log(`OpenAI配置: 使用代理 ${proxyUrl}`);
    } catch (error) {
      console.warn(`代理配置失败: ${error.message}, 将使用直连`);
    }
  } else {
    console.log('OpenAI配置: 使用直连');
  }

  return config;
}

/**
 * 创建OpenAI实例
 * @returns {OpenAI} OpenAI实例
 */
function createOpenAIInstance() {
  const config = createOpenAIConfig();
  return new OpenAI(config);
}

/**
 * 获取代理状态信息
 * @returns {Object} 代理状态信息
 */
function getProxyStatus() {
  const useProxy = process.env.USE_PROXY === 'true' || 
                   process.env.NODE_ENV === 'development' ||
                   process.env.PROXY_ENABLED === 'true';
  
  const proxyUrl = process.env.PROXY_URL || 'http://127.0.0.1:33210';
  
  return {
    useProxy,
    proxyUrl,
    nodeEnv: process.env.NODE_ENV,
    useProxyEnv: process.env.USE_PROXY,
    proxyEnabledEnv: process.env.PROXY_ENABLED
  };
}

module.exports = {
  createOpenAIConfig,
  createOpenAIInstance,
  getProxyStatus
}; 