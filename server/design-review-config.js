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
  
  // Supported languages - 支持九种主要语言
  SUPPORTED_LANGUAGES: {
    'en': 'English (英语)',
    'de': 'Deutsch (德语)',
    'fr': 'Français (法语)',
    'es': 'Español (西班牙语)',
    'it': 'Italiano (意大利语)',
    'nl': 'Nederlands (荷兰语)',
    'pl': 'Polski (波兰语)',
    'sv': 'Svenska (瑞典语)',
    'ja': '日本語 (日语)',
    'zh-CN': '中文 (简体中文)'
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