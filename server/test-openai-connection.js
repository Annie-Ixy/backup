require('dotenv').config();
const OpenAI = require('openai');

async function testOpenAIConnection() {
  console.log('=== OpenAI Connection Test ===');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ API Key found');
  console.log('Model:', process.env.OPENAI_MODEL || 'gpt-4o');
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000 // 60 seconds timeout
    });
    
    console.log('🔄 Testing OpenAI API connection...');
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "Connection successful!"'
        }
      ],
      max_tokens: 50
    });
    
    console.log('✅ OpenAI API connection successful!');
    console.log('Response:', response.choices[0].message.content);
    console.log('Model used:', response.model);
    console.log('Usage:', response.usage);
    
  } catch (error) {
    console.error('❌ OpenAI API connection failed:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.status) {
      console.error('HTTP status:', error.status);
    }
    
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    // 提供解决方案建议
    console.log('\n🔧 可能的解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 尝试使用VPN或代理');
    console.log('3. 检查防火墙设置');
    console.log('4. 稍后重试');
  }
}

testOpenAIConnection(); 