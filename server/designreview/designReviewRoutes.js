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

// Store active SSE connections
const activeConnections = new Map();

// Store processing status for polling fallback (similar to resume screening)
const processingCache = new Map();

// SSE endpoint for real-time progress updates
router.get('/api/design-review/progress/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log(`SSE connection request received for session: ${sessionId}`);
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Store connection
  activeConnections.set(sessionId, res);
  console.log(`SSE connection stored for session: ${sessionId}`);
  
  // Send initial connection confirmation
  const initialMessage = { type: 'connected', sessionId, timestamp: new Date().toISOString() };
  res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);
  console.log(`Sent initial SSE message:`, initialMessage);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`SSE connection closed for session: ${sessionId}`);
    activeConnections.delete(sessionId);
  });
  
  req.on('error', (err) => {
    console.error(`SSE connection error for session ${sessionId}:`, err);
    activeConnections.delete(sessionId);
  });
});

// Helper function to send progress updates
function sendProgressUpdate(sessionId, progressData) {
  console.log(`Attempting to send progress update to session ${sessionId}:`, progressData);
  
  // Update processing cache for polling fallback
  if (sessionId && processingCache.has(sessionId)) {
    const cachedStatus = processingCache.get(sessionId);
    const updatedStatus = {
      ...cachedStatus,
      ...progressData,
      lastUpdate: new Date().toISOString()
    };
    processingCache.set(sessionId, updatedStatus);
    console.log(`Updated processing cache for session ${sessionId}`);
  }
  
  // Send SSE message if connection exists
  const connection = activeConnections.get(sessionId);
  if (connection) {
    try {
      const message = { type: 'progress', ...progressData };
      console.log(`Sending SSE message:`, message);
      connection.write(`data: ${JSON.stringify(message)}\n\n`);
      console.log(`Progress update sent successfully to session ${sessionId}`);
    } catch (error) {
      console.error(`Error sending progress update to session ${sessionId}:`, error);
      activeConnections.delete(sessionId);
    }
  } else {
    console.warn(`No active SSE connection found for session ${sessionId}, but cache updated`);
    console.log(`Active connections:`, Array.from(activeConnections.keys()));
  }
}

// Add polling endpoint for status checking (fallback mechanism)
router.get('/api/design-review/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const status = processingCache.get(sessionId);
  
  if (status) {
    console.log(`Status check for session ${sessionId}:`, status);
    res.json(status);
  } else {
    console.log(`No status found for session ${sessionId}`);
    res.json({ 
      status: 'not_found', 
      message: 'Session not found or expired',
      sessionId 
    });
  }
});

router.post('/api/design-review/process', async (req, res) => {
  console.log(`\n=== Design Review Process Started ===`);
  
  try {
    const { fileIds, language, reviewCategories, sessionId } = req.body;
    console.log(`Extracted parameters:`, { fileIds, language, reviewCategories, sessionId });
    // Support both single language (string) and multiple languages (array)
    const targetLanguages = Array.isArray(language) ? language : [language || 'en'];
    
    // 验证语言选择
    if (!targetLanguages || targetLanguages.length === 0) {
      return res.status(400).json({ error: 'At least one language must be selected' });
    }
    
    // 验证语言代码是否支持
    const supportedLanguageCodes = Object.keys(designReviewConfig.SUPPORTED_LANGUAGES);
    const invalidLanguages = targetLanguages.filter(lang => !supportedLanguageCodes.includes(lang));
    if (invalidLanguages.length > 0) {
      return res.status(400).json({ 
        error: `Unsupported languages: ${invalidLanguages.join(', ')}. Supported languages: ${supportedLanguageCodes.join(', ')}` 
      });
    }
    
    if (!fileIds || fileIds.length === 0) {
      return res.status(400).json({ error: 'No files specified' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }
    
    console.log(`Processing files with languages: ${targetLanguages.join(', ')}`);
    console.log(`Review categories: ${reviewCategories?.join(', ') || 'default'}`);
    console.log(`Session ID: ${sessionId}`);
    
    const results = [];
    const totalFiles = fileIds.length;
    
    // Initialize processing cache with starting status
    if (sessionId) {
      processingCache.set(sessionId, {
        status: 'processing',
        fileIds,
        totalFiles,
        completedFiles: 0,
        results: [],
        overallProgress: 0,
        currentFile: null,
        stage: 'starting',
        message: '开始处理文件...',
        startTime: new Date().toISOString()
      });
    }
    
    for (let fileIndex = 0; fileIndex < fileIds.length; fileIndex++) {
      const fileId = fileIds[fileIndex];
      const filePath = path.join(designReviewConfig.UPLOAD_DIR, fileId);
      
      // Send file-level progress
      if (sessionId) {
        sendProgressUpdate(sessionId, {
          fileIndex,
          totalFiles,
          currentFile: fileId,
          overallProgress: Math.round((fileIndex / totalFiles) * 100),
          message: `开始处理文件 ${fileIndex + 1}/${totalFiles}: ${fileId}`
        });
      }
      
      try {
        // 检查文件是否存在
        const fileExists = await fs.pathExists(filePath);
        if (!fileExists) {
          console.error(`File not found: ${filePath}`);
          results.push({
            fileId,
            success: false,
            error: `File not found: ${fileId}`
          });
          continue;
        }

        // 检查文件是否为文件（不是目录）
        const fileStat = await fs.stat(filePath);
        if (!fileStat.isFile()) {
          console.error(`Path is not a file: ${filePath}`);
          results.push({
            fileId,
            success: false,
            error: `Path is not a file: ${fileId}`
          });
          continue;
        }

        console.log(`开始处理文件: ${fileId}`);
        console.log(`文件路径: ${filePath}`);
        
        // Send file processing progress
        if (sessionId) {
          sendProgressUpdate(sessionId, {
            fileIndex,
            totalFiles,
            currentFile: fileId,
            stage: 'file_processing',
            message: `正在处理文件: ${fileId}`
          });
        }
        
        const processedData = await fileProcessor.processFile(filePath);
        console.log(`文件处理完成，类型: ${processedData.type}`);
        
        if (processedData.type === 'image') {
          console.log(`图像文件检测到，使用AI视觉分析模式`);
          console.log(`图像信息: ${processedData.metadata?.dimensions?.width}x${processedData.metadata?.dimensions?.height}`);
        }
        
        // Create progress callback for this file
        const progressCallback = sessionId ? (progressData) => {
          console.log(`Progress callback called for file ${fileId}:`, progressData);
          
          // Calculate overall progress based on file progress and AI progress
          let overallProgress = Math.round((fileIndex / totalFiles) * 100);
          if (progressData.progress !== undefined) {
            // Add AI progress within current file
            overallProgress = Math.round(((fileIndex / totalFiles) * 100) + ((progressData.progress / totalFiles)));
          }
          
          sendProgressUpdate(sessionId, {
            fileIndex,
            totalFiles,
            currentFile: fileId,
            overallProgress: Math.min(overallProgress, 100),
            ...progressData
          });
        } : null;
        
        console.log(`About to call AI reviewer with progressCallback:`, !!progressCallback);
        
        const reviewResult = await aiReviewer.reviewContent(
          processedData,
          targetLanguages,
          reviewCategories || ['basic', 'advanced'],
          progressCallback
        );
        
        console.log(`AI审查完成，发现问题数: ${reviewResult.issues?.length || 0}`);
        console.log(`分析类型: ${reviewResult.metadata?.analysisType}`);
        
        results.push({
          fileId,
          success: true,
          processedData,
          reviewResult
        });
        console.log('文件处理成功完成');
        
        // Send file completion progress
        if (sessionId) {
          sendProgressUpdate(sessionId, {
            fileIndex,
            totalFiles,
            currentFile: fileId,
            stage: 'completed',
            progress: 100,
            message: `文件 ${fileId} 处理完成`
          });
        }
        
      } catch (error) {
        console.error(`Error processing design review file ${fileId}:`, error);
        results.push({
          fileId,
          success: false,
          error: error.message
        });
        
        // Send error progress
        if (sessionId) {
          sendProgressUpdate(sessionId, {
            fileIndex,
            totalFiles,
            currentFile: fileId,
            stage: 'error',
            message: `文件 ${fileId} 处理失败: ${error.message}`
          });
        }
      }
    }
    
    // Send final completion
    if (sessionId) {
      const finalStatus = {
        status: 'completed',
        stage: 'all_completed',
        progress: 100,
        message: '所有文件处理完成',
        totalFiles,
        completedFiles: totalFiles,
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length,
        endTime: new Date().toISOString()
      };
      
      // Update cache with final status
      processingCache.set(sessionId, finalStatus);
      
      sendProgressUpdate(sessionId, finalStatus);
      
      // Close SSE connection after a short delay
      setTimeout(() => {
        const connection = activeConnections.get(sessionId);
        if (connection) {
          connection.write(`data: ${JSON.stringify({ type: 'close' })}\n\n`);
          connection.end();
          activeConnections.delete(sessionId);
        }
        
        // Keep cache for a while for polling fallback, then clean up
        setTimeout(() => {
          processingCache.delete(sessionId);
          console.log(`Cleaned up cache for session ${sessionId}`);
        }, 60000); // Keep for 1 minute after completion
      }, 1000);
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Design review processing error:', error);
    
    // Send error to SSE if available
    if (req.body.sessionId) {
      sendProgressUpdate(req.body.sessionId, {
        stage: 'error',
        message: `处理错误: ${error.message}`
      });
    }
    
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