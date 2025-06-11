require('dotenv').config();

module.exports = {
  // Server configuration
  PORT: process.env.PORT || 9000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // OpenAI configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
  
  // File upload configuration
  UPLOAD_DIR: './uploads',
  TEMP_DIR: './temp',
  OUTPUT_DIR: './outputs',
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  
  // Supported file types
  SUPPORTED_FILE_TYPES: {
    documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
    images: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff']
  },
  
  // Supported languages
  SUPPORTED_LANGUAGES: {
    'zh-CN': '中文',
    'en': 'English',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'ja': '日本語',
    'ko': '한국어'
  },
  
  // Review categories
  REVIEW_CATEGORIES: {
    basic: {
      name: '基本检查',
      description: '拼写、语法、标点符号'
    },
    advanced: {
      name: '进阶检查',
      description: '一致性检查、上下文分析、术语统一性'
    }
  }
}; 