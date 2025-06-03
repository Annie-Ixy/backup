module.exports = {
  port: process.env.PORT || 5000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  upload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['application/zip'],
    uploadDir: 'uploads'
  },
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:9000'
    ]
  }
}; 