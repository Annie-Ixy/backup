const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const designReviewConfig = require('../design-review-config');
const fileProcessor = require('../design-review-utils/fileProcessor');
const aiReviewer = require('../design-review-utils/aiReviewer');
const reportGenerator = require('../design-review-utils/reportGenerator');
const { decodeFilename } = require('../design-review-utils/filenameUtils');

const router = express.Router();

// 创建设计稿审核所需的目录
const createDesignReviewDirectories = async () => {
  const dirs = [designReviewConfig.UPLOAD_DIR, designReviewConfig.TEMP_DIR, designReviewConfig.OUTPUT_DIR];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
};

const designReviewStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await createDesignReviewDirectories();
    cb(null, designReviewConfig.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    let originalName = file.originalname;
    try {
      originalName = decodeFilename(originalName);
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const safeName = `${file.fieldname}-${timestamp}-${randomSuffix}${ext}`;
      file.decodedOriginalName = originalName;
      cb(null, safeName);
    } catch (error) {
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const fallbackName = `${file.fieldname}-${timestamp}-${randomSuffix}${ext}`;
      file.decodedOriginalName = file.originalname;
      cb(null, fallbackName);
    }
  }
});

const designReviewUpload = multer({
  storage: designReviewStorage,
  limits: { fileSize: designReviewConfig.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allSupportedTypes = [
      ...designReviewConfig.SUPPORTED_FILE_TYPES.documents,
      ...designReviewConfig.SUPPORTED_FILE_TYPES.images
    ];
    if (allSupportedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  }
});

// 路由实现
router.get('/api/design-review/config', (req, res) => {
  res.json({
    supportedLanguages: designReviewConfig.SUPPORTED_LANGUAGES,
    reviewCategories: designReviewConfig.REVIEW_CATEGORIES,
    supportedFileTypes: designReviewConfig.SUPPORTED_FILE_TYPES
  });
});

router.post('/api/design-review/upload', designReviewUpload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    req.files.forEach(file => {
      console.log('上传原始文件名:', file.originalname, '解码后:', file.decodedOriginalName);
    });
    const uploadedFiles = req.files.map(file => ({
      id: file.filename,
      originalName: file.decodedOriginalName || file.originalname,
      path: file.path,
      size: file.size,
      type: path.extname(file.originalname).toLowerCase()
    }));
    res.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Design review upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/design-review/process', async (req, res) => {
  try {
    const { fileIds, language, reviewCategories } = req.body;
    if (!fileIds || fileIds.length === 0) {
      return res.status(400).json({ error: 'No files specified' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }
    const results = [];
    for (const fileId of fileIds) {
      const filePath = path.join(designReviewConfig.UPLOAD_DIR, fileId);
      try {
        const processedData = await fileProcessor.processFile(filePath);
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
        console.log('results success', results);
      } catch (error) {
        console.error(`Error processing design review file ${fileId}:`, error);
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
    console.error('Design review processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/design-review/generate-report', async (req, res) => {
  try {
    const { fileId, reviewResult, processedData, format } = req.body;
    if (!fileId || !reviewResult || !processedData) {
      return res.status(400).json({ error: 'Missing required data' });
    }
    const reportFiles = await reportGenerator.generateReport(
      reviewResult,
      processedData,
      designReviewConfig.OUTPUT_DIR,
      format
    );
    res.json({
      success: true,
      reportFiles
    });
  } catch (error) {
    console.error('Design review report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/design-review/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const safeFilename = path.basename(filename);
    const filePath = path.join(designReviewConfig.OUTPUT_DIR, safeFilename);
    await fs.access(filePath);
    res.download(filePath, safeFilename);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// 新增删除文件接口
router.delete('/api/design-review/clear-folders', async (req, res) => {
  try {
    const { folders = ['outputs', 'uploads'] } = req.body;
    
    const results = {};
    
    for (const folder of folders) {
      try {
        let targetDir;
        if (folder === 'outputs') {
          targetDir = designReviewConfig.OUTPUT_DIR;
        } else if (folder === 'uploads') {
          targetDir = designReviewConfig.UPLOAD_DIR;
        } else {
          results[folder] = { success: false, error: 'Invalid folder name' };
          continue;
        }
        
        // 检查目录是否存在
        const exists = await fs.pathExists(targetDir);
        if (!exists) {
          results[folder] = { success: false, error: 'Folder does not exist' };
          continue;
        }
        
        // 读取目录内容
        const files = await fs.readdir(targetDir);
        
        // 删除所有文件
        for (const file of files) {
          const filePath = path.join(targetDir, file);
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            await fs.remove(filePath);
          } else if (stat.isDirectory()) {
            await fs.remove(filePath);
          }
        }
        
        results[folder] = { 
          success: true, 
          message: `Cleared ${files.length} items from ${folder}`,
          clearedItems: files.length
        };
        
        console.log(`Cleared ${folder} folder: ${files.length} items removed`);
        
      } catch (error) {
        console.error(`Error clearing ${folder} folder:`, error);
        results[folder] = { success: false, error: error.message };
      }
    }
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('Clear folders error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 