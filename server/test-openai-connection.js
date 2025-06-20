const OpenAI = require('openai');
require('dotenv').config();

async function testOpenAIConnection() {
  console.log('=== OpenAI API 连接测试 ===');
  
  // 检查环境变量
  console.log('1. 检查环境变量:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '已设置' : '未设置');
  console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL || '未设置');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY 未设置');
    return;
  }
  
  // 检查API Key格式
  console.log('\n2. 检查API Key格式:');
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('API Key 长度:', apiKey.length);
  console.log('API Key 前缀:', apiKey.substring(0, 10) + '...');
  
  if (!apiKey.startsWith('sk-')) {
    console.error('❌ API Key 格式不正确，应该以 sk- 开头');
    return;
  }
  
  // 创建OpenAI客户端
  console.log('\n3. 创建OpenAI客户端:');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30 * 1000  // 30秒超时
  });
  
  // 测试简单请求
  console.log('\n4. 测试API连接:');
  try {
    console.log('发送测试请求...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message.'
        }
      ],
      max_tokens: 10
    });
    
    console.log('✅ API连接成功!');
    console.log('响应模型:', response.model);
    console.log('响应内容:', response.choices[0].message.content);
    
  } catch (error) {
    console.error('❌ API连接失败:');
    console.error('错误类型:', error.constructor.name);
    console.error('错误消息:', error.message);
    
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    
    if (error.status) {
      console.error('HTTP状态码:', error.status);
    }
    
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    
    // 分析错误类型
    console.log('\n5. 错误分析:');
    if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET')) {
      console.log('🔍 网络连接问题:');
      console.log('- 可能是网络超时或连接重置');
      console.log('- 建议检查网络连接和防火墙设置');
      console.log('- 可能需要配置代理');
    } else if (error.message.includes('401')) {
      console.log('🔍 认证问题:');
      console.log('- API Key 可能无效或已过期');
      console.log('- 请检查API Key是否正确');
    } else if (error.message.includes('429')) {
      console.log('🔍 速率限制:');
      console.log('- 请求频率过高');
      console.log('- 请稍后重试');
    } else if (error.message.includes('500')) {
      console.log('🔍 服务器错误:');
      console.log('- OpenAI服务器内部错误');
      console.log('- 请稍后重试');
    }
  }
}

// 运行测试
testOpenAIConnection().catch(console.error); 