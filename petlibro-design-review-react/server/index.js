const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const fileProcessor = require('./utils/fileProcessor');
const aiReviewer = require('./utils/aiReviewer');
const reportGenerator = require('./utils/reportGenerator');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // For production, you should specify exact origins
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary directories
const createDirectories = async () => {
  const dirs = [config.UPLOAD_DIR, config.TEMP_DIR, config.OUTPUT_DIR];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await createDirectories();
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allSupportedTypes = [
      ...config.SUPPORTED_FILE_TYPES.documents,
      ...config.SUPPORTED_FILE_TYPES.images
    ];
    
    if (allSupportedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  }
});

// Routes
app.get('http://localhost:5000/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('http://localhost:5000/api/config', (req, res) => {
  res.json({
    supportedLanguages: config.SUPPORTED_LANGUAGES,
    reviewCategories: config.REVIEW_CATEGORIES,
    supportedFileTypes: config.SUPPORTED_FILE_TYPES
  });
});

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
      id: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      type: path.extname(file.originalname).toLowerCase()
    }));

    res.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process', async (req, res) => {
  try {
    const { fileIds, language, reviewCategories } = req.body;

    if (!fileIds || fileIds.length === 0) {
      return res.status(400).json({ error: 'No files specified' });
    }

    if (!config.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const results = [];

    for (const fileId of fileIds) {
      const filePath = path.join(config.UPLOAD_DIR, fileId);
      
      try {
        // Process file
        const processedData = await fileProcessor.processFile(filePath);
        
        // AI review
        const reviewResult = await aiReviewer.reviewContent(
          processedData,
          language || 'zh-CN',
          reviewCategories || ['basic', 'advanced']
        );

        results.push({
          fileId,
          success: true,
          processedData,
          reviewResult
        });
      } catch (error) {
        console.error(`Error processing file ${fileId}:`, error);
        results.push({
          fileId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const { fileId, reviewResult, processedData, format } = req.body;

    if (!fileId || !reviewResult || !processedData) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    const reportFiles = await reportGenerator.generateReport(
      reviewResult,
      processedData,
      config.OUTPUT_DIR,
      format
    );

    res.json({
      success: true,
      reportFiles
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(config.OUTPUT_DIR, filename);
    
    await fs.access(filePath);
    res.download(filePath);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
}); 