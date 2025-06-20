require('dotenv').config();

console.log('=== Environment Variables Test ===');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 
  process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL || 'NOT SET');
console.log('PORT:', process.env.PORT || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// Test OpenAI API key format
if (process.env.OPENAI_API_KEY) {
  const key = process.env.OPENAI_API_KEY;
  console.log('API Key length:', key.length);
  console.log('API Key starts with sk-:', key.startsWith('sk-'));
  console.log('API Key contains newlines:', key.includes('\n'));
} 