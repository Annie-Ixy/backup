const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// 获取文件列表
router.get('/sample-files', (req, res) => {
  try {
    const fileDir = path.join(__dirname, 'file');
    const files = fs.readdirSync(fileDir);
    
    const fileList = files.map(filename => {
      const filePath = path.join(fileDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        lastModified: stats.mtime,
        downloadUrl: `/download-sample-file/${encodeURIComponent(filename)}`
      };
    });
    
    res.json({
      success: true,
      data: fileList
    });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件列表失败',
      error: error.message
    });
  }
});

// 下载单个文件
router.get('/download-sample-file/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(__dirname, 'file', filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
    
    // 检查文件路径是否安全（防止目录遍历攻击）
    const resolvedPath = path.resolve(filePath);
    const expectedDir = path.resolve(path.join(__dirname, 'file'));
    
    if (!resolvedPath.startsWith(expectedDir)) {
      return res.status(403).json({
        success: false,
        message: '访问被拒绝'
      });
    }
    
    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', getContentType(filename));
    
    // 创建文件流并发送
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('文件读取错误:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '文件读取失败'
        });
      }
    });
    
  } catch (error) {
    console.error('文件下载失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: '文件下载失败',
        error: error.message
      });
    }
  }
});

// 获取文件内容类型
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
