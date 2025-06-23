const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

const router = express.Router();
const { HttpsProxyAgent } = require('https-proxy-agent');
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890');

// 配置OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30 * 1000,  // 30秒连接超时
    maxRetries: 3,       // 最大重试次数
    httpAgent: proxyAgent,
});

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/questionnaire');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV、Excel和TXT文件格式'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 存储分析结果的临时数据结构
let analysisResults = new Map();

// 1. 上传问卷数据
router.post('/upload-questionnaire', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    // 直接读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // 生成唯一ID
    const analysisId = Date.now().toString();
    // 存储文件信息
    analysisResults.set(analysisId, {
      id: analysisId,
      fileName: fileName,
      uploadTime: new Date().toISOString(),
      fileContent: fileContent,
      analysis: null,
      status: 'uploaded'
    });
    res.json({
      success: true,
      analysisId: analysisId,
      message: `成功上传文件: ${fileName}`,
      data: {
        fileName: fileName,
        fileSize: fileContent.length,
        preview: fileContent.substring(0, 500) + (fileContent.length > 500 ? '...' : '')
      }
    });
  } catch (error) {
    console.error('上传文件错误:', error);
    res.status(500).json({ error: '文件上传失败: ' + error.message });
  }
});

// 2. 文本分析接口
router.post('/analyze-text', async (req, res) => {
  try {
    const { analysisId, analysisType, customTags, summaryDimensions } = req.body;
    if (!analysisId || !analysisResults.has(analysisId)) {
      return res.status(400).json({ error: '无效的分析ID' });
    }
    const analysisData = analysisResults.get(analysisId);
    const fileContent = analysisData.fileContent;
    if (!fileContent || fileContent.trim().length === 0) {
      return res.status(400).json({ error: '文件内容为空' });
    }
    // 开始分析
    analysisData.status = 'analyzing';
    analysisResults.set(analysisId, analysisData);
    const analysisResultsRes = await performTextAnalysis(fileContent, analysisType, customTags, summaryDimensions);
    // 更新分析结果
    analysisData.analysis = analysisResultsRes;
    analysisData.status = 'completed';
    analysisData.completedTime = new Date().toISOString();
    analysisResults.set(analysisId, analysisData);
    res.json({
      success: true,
      analysisId: analysisId,
      results: analysisResultsRes
    });
  } catch (error) {
    console.error('文本分析错误:', error);
    res.status(500).json({ error: '文本分析失败: ' + error.message });
  }
});

// 3. 获取分析结果
router.get('/analysis-results/:analysisId', (req, res) => {
  try {
    const { analysisId } = req.params;
    if (!analysisResults.has(analysisId)) {
      return res.status(404).json({ error: '分析结果不存在' });
    }
    const result = analysisResults.get(analysisId);
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error('获取分析结果错误:', error);
    res.status(500).json({ error: '获取分析结果失败' });
  }
});

// 4. 获取分析历史
router.get('/analysis-history', (req, res) => {
  try {
    const history = Array.from(analysisResults.values()).map(item => ({
      id: item.id,
      fileName: item.fileName,
      uploadTime: item.uploadTime,
      completedTime: item.completedTime,
      status: item.status,
      fileSize: item.fileContent ? item.fileContent.length : 0
    }));
    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('获取历史记录错误:', error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

// 辅助函数
async function performTextAnalysis(fileContent, analysisType, customTags, summaryDimensions) {
  const results = {};
  // 情绪分析
  if (analysisType && analysisType.includes('sentiment')) {
    results.sentiment = await analyzeWithOpenAI(fileContent, '请分析以下文件内容的整体情绪，并给出简要说明。');
  }
  // 话题分类
  if (analysisType && analysisType.includes('topics')) {
    let prompt = '请分析以下文件内容的主要话题和主题。';
    if (customTags && customTags.length > 0) {
      prompt += `请结合这些标签进行分类：${customTags.join('、')}`;
    }
    results.topics = await analyzeWithOpenAI(fileContent, prompt);
  }
  // 关键词提取
  if (analysisType && analysisType.includes('keywords')) {
    results.keywords = await analyzeWithOpenAI(fileContent, '请提取以下文件内容的10个最重要关键词，用逗号分隔。');
  }
  // 内容摘要
  if (analysisType && analysisType.includes('summary')) {
    let prompt = '请对以下文件内容进行摘要，200字左右。';
    if (summaryDimensions && summaryDimensions.length > 0) {
      prompt += `摘要时请重点关注这些维度：${summaryDimensions.join('、')}`;
    }
    results.summary = await analyzeWithOpenAI(fileContent, prompt);
  }
  return results;
}

async function analyzeWithOpenAI(fileContent, prompt) {
  try {
    console.log(openai, 'openai-----开始分析-');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { role: 'system', content: '你是一个专业的数据分析师。' },
        { role: 'user', content: `${prompt}\n\n${fileContent}` }
      ],
      max_tokens: 4000,
      temperature: 0.3
    });
    console.log(response, 'response---分析结束--');
    return response.choices[0].message.content.trim();
  } catch (error) {
    return 'AI分析失败';
  }
}

module.exports = router;