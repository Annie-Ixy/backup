const { createOpenAIConfig, getProxyStatus } = require('./utils/openaiConfig');

console.log('=== OpenAI 代理配置测试 ===\n');

// 测试不同环境变量组合
const testCases = [
  {
    name: '开发环境 (NODE_ENV=development)',
    env: { NODE_ENV: 'development' }
  },
  {
    name: '生产环境 (NODE_ENV=production)',
    env: { NODE_ENV: 'production' }
  },
  {
    name: '强制使用代理 (USE_PROXY=true)',
    env: { USE_PROXY: 'true' }
  },
  {
    name: '强制不使用代理 (USE_PROXY=false)',
    env: { USE_PROXY: 'false' }
  },
  {
    name: '启用代理 (PROXY_ENABLED=true)',
    env: { PROXY_ENABLED: 'true' }
  },
  {
    name: '自定义代理地址',
    env: { USE_PROXY: 'true', PROXY_URL: 'http://127.0.0.1:8080' }
  }
];

testCases.forEach((testCase, index) => {
  console.log(`测试 ${index + 1}: ${testCase.name}`);
  
  // 临时设置环境变量
  const originalEnv = {};
  Object.keys(testCase.env).forEach(key => {
    originalEnv[key] = process.env[key];
    process.env[key] = testCase.env[key];
  });
  
  try {
    const status = getProxyStatus();
    const config = createOpenAIConfig();
    
    console.log('  代理状态:', status.useProxy ? '✅ 使用代理' : '❌ 不使用代理');
    console.log('  代理地址:', status.proxyUrl);
    console.log('  配置对象:', {
      hasHttpAgent: !!config.httpAgent,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    });
  } catch (error) {
    console.log('  错误:', error.message);
  }
  
  // 恢复原始环境变量
  Object.keys(originalEnv).forEach(key => {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  });
  
  console.log('');
});

console.log('=== 当前实际配置 ===');
const currentStatus = getProxyStatus();
console.log('当前代理状态:', currentStatus);
console.log('当前配置:', createOpenAIConfig()); 