const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { createOpenAIInstance } = require('../utils/openaiConfig');

const router = express.Router();

// 配置OpenAI - 使用公共方法
const openai = createOpenAIInstance();

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

// 解析文件内容为结构化数据
async function parseFileContent(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const data = [];
  
  if (ext === '.csv') {
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', () => resolve(data))
        .on('error', reject);
    });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
  } else if (ext === '.txt') {
    const content = fs.readFileSync(filePath, 'utf8');
    // 简单的文本分割，假设每行是一条记录
    return content.split('\n').filter(line => line.trim()).map((line, index) => ({
      id: index + 1,
      content: line.trim(),
      timestamp: new Date().toISOString()
    }));
  }
  
  return data;
}

// 1. 上传问卷数据
router.post('/upload-questionnaire', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    
    // 解析文件内容为结构化数据
    const parsedData = await parseFileContent(filePath, fileName);
    
    // 生成唯一ID
    const analysisId = Date.now().toString();
    
    // 存储文件信息
    analysisResults.set(analysisId, {
      id: analysisId,
      fileName: fileName,
      uploadTime: new Date().toISOString(),
      fileContent: fs.readFileSync(filePath, 'utf8'),
      parsedData: parsedData,
      analysis: null,
      statistics: null,
      trends: null,
      status: 'uploaded'
    });
    
    res.json({
      success: true,
      analysisId: analysisId,
      message: `成功上传文件: ${fileName}`,
      data: {
        fileName: fileName,
        fileSize: fs.statSync(filePath).size,
        totalRecords: parsedData.length,
        preview: parsedData.slice(0, 3),
        columns: parsedData.length > 0 ? Object.keys(parsedData[0]) : []
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
    const parsedData = analysisData.parsedData;
    
    if (!parsedData || parsedData.length === 0) {
      return res.status(400).json({ error: '文件内容为空' });
    }
    
    // 开始分析
    analysisData.status = 'analyzing';
    analysisResults.set(analysisId, analysisData);
    
    // 执行详细分析
    const analysisResultsRes = await performDetailedAnalysis(parsedData, analysisType, customTags, summaryDimensions);
    
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

// 3. 数据汇总统计接口
router.post('/statistics', async (req, res) => {
  try {
    const { analysisId, groupBy, filters } = req.body;
    if (!analysisId || !analysisResults.has(analysisId)) {
      return res.status(400).json({ error: '无效的分析ID' });
    }
    
    const analysisData = analysisResults.get(analysisId);
    const parsedData = analysisData.parsedData;
    const analysis = analysisData.analysis;
    
    if (!parsedData || !analysis) {
      return res.status(400).json({ error: '请先完成文本分析' });
    }
    
    // 执行统计分析
    const statistics = await performStatistics(parsedData, analysis, groupBy, filters);
    
    // 更新统计结果
    analysisData.statistics = statistics;
    analysisResults.set(analysisId, analysisData);
    
    res.json({
      success: true,
      analysisId: analysisId,
      statistics: statistics
    });
  } catch (error) {
    console.error('统计分析错误:', error);
    res.status(500).json({ error: '统计分析失败: ' + error.message });
  }
});

// 4. 趋势分析接口
router.post('/trend-analysis', async (req, res) => {
  try {
    const { analysisId, timeField, trendType, comparisonFields } = req.body;
    if (!analysisId || !analysisResults.has(analysisId)) {
      return res.status(400).json({ error: '无效的分析ID' });
    }
    
    const analysisData = analysisResults.get(analysisId);
    const parsedData = analysisData.parsedData;
    const analysis = analysisData.analysis;
    
    if (!parsedData || !analysis) {
      return res.status(400).json({ error: '请先完成文本分析' });
    }
    
    // 执行趋势分析
    const trends = await performTrendAnalysis(parsedData, analysis, timeField, trendType, comparisonFields);
    
    // 更新趋势结果
    analysisData.trends = trends;
    analysisResults.set(analysisId, analysisData);
    
    res.json({
      success: true,
      analysisId: analysisId,
      trends: trends
    });
  } catch (error) {
    console.error('趋势分析错误:', error);
    res.status(500).json({ error: '趋势分析失败: ' + error.message });
  }
});

// 5. 获取分析结果
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

// 6. 获取分析历史
router.get('/analysis-history', (req, res) => {
  try {
    const history = Array.from(analysisResults.values()).map(item => ({
      id: item.id,
      fileName: item.fileName,
      uploadTime: item.uploadTime,
      completedTime: item.completedTime,
      status: item.status,
      totalRecords: item.parsedData ? item.parsedData.length : 0,
      hasAnalysis: !!item.analysis,
      hasStatistics: !!item.statistics,
      hasTrends: !!item.trends
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

// 7. 导出分析结果
router.get('/export/:analysisId', (req, res) => {
  try {
    const { analysisId } = req.params;
    const { format = 'json' } = req.query;
    
    if (!analysisResults.has(analysisId)) {
      return res.status(404).json({ error: '分析结果不存在' });
    }
    
    const result = analysisResults.get(analysisId);
    
    if (format === 'csv') {
      // 导出CSV格式
      const csvData = convertToCSV(result);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analysis-${analysisId}.csv`);
      res.send(csvData);
    } else {
      // 导出JSON格式
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=analysis-${analysisId}.json`);
      res.json(result);
    }
  } catch (error) {
    console.error('导出错误:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

// 辅助函数
async function performDetailedAnalysis(parsedData, analysisType, customTags, summaryDimensions) {
  const results = {};
  const textContent = parsedData.map(item => {
    // 尝试找到文本内容字段
    const textFields = ['content', 'text', 'comment', 'feedback', 'answer', 'response'];
    for (const field of textFields) {
      if (item[field]) return item[field];
    }
    // 如果没有找到特定字段，使用第一个非空字段
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  }).filter(text => text.trim()).join('\n');

  // 情绪分析 - 增强版
  if (analysisType && analysisType.includes('sentiment')) {
    results.sentiment = await performSentimentAnalysis(parsedData, textContent);
  }
  
  // 话题分类 - 增强版
  if (analysisType && analysisType.includes('topics')) {
    results.topics = await performTopicAnalysis(parsedData, textContent, customTags);
  }
  
  // 关键词提取 - 增强版
  if (analysisType && analysisType.includes('keywords')) {
    results.keywords = await performKeywordAnalysis(parsedData, textContent);
  }
  
  // 内容摘要 - 增强版
  if (analysisType && analysisType.includes('summary')) {
    results.summary = await performSummaryAnalysis(parsedData, textContent, summaryDimensions);
  }
  
  return results;
}

// 情绪分析 - 详细分类
async function performSentimentAnalysis(parsedData, textContent) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { 
          role: 'system', 
          content: '你是一个专业的情感分析专家。请对文本进行详细的情感分析，包括：1. 整体情感倾向（正面/中性/负面）2. 情感强度（1-5分）3. 主要情感类型（如满意、失望、愤怒等）4. 情感分布统计。请以JSON格式返回结果。' 
        },
        { 
          role: 'user', 
          content: `请分析以下问卷数据的情感特征：\n\n${textContent}` 
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });
    
    const result = response.choices[0].message.content.trim();
    try {
      return JSON.parse(result);
    } catch {
      return { analysis: result, error: '解析失败' };
    }
  } catch (error) {
    return { error: '情绪分析失败', details: error.message };
  }
}

// 话题分析 - 自动聚类
async function performTopicAnalysis(parsedData, textContent, customTags) {
  try {
    let prompt = '请对以下问卷数据进行话题分析，包括：1. 自动识别主要话题类别 2. 每个话题的关键词 3. 话题分布统计 4. 代表性语句。请以JSON格式返回结果。';
    
    if (customTags && customTags.length > 0) {
      prompt += `\n\n请结合这些自定义标签进行分类：${customTags.join('、')}`;
    }
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { role: 'system', content: '你是一个专业的话题分析专家。' },
        { role: 'user', content: `${prompt}\n\n${textContent}` }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });
    
    const result = response.choices[0].message.content.trim();
    try {
      return JSON.parse(result);
    } catch {
      return { analysis: result, error: '解析失败' };
    }
  } catch (error) {
    return { error: '话题分析失败', details: error.message };
  }
}

// 关键词分析 - 高频词统计
async function performKeywordAnalysis(parsedData, textContent) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { 
          role: 'system', 
          content: '你是一个专业的关键词分析专家。请提取文本中的关键词，包括：1. 高频词汇（出现频率最高的词）2. 关键表述（重要短语）3. 词汇云数据 4. 关键词分类。请以JSON格式返回结果。' 
        },
        { role: 'user', content: `请分析以下文本的关键词：\n\n${textContent}` }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });
    
    const result = response.choices[0].message.content.trim();
    try {
      return JSON.parse(result);
    } catch {
      return { analysis: result, error: '解析失败' };
    }
  } catch (error) {
    return { error: '关键词分析失败', details: error.message };
  }
}

// 摘要分析 - 多维度摘要
async function performSummaryAnalysis(parsedData, textContent, summaryDimensions) {
  try {
    let prompt = '请对以下问卷数据进行内容摘要，包括：1. 整体内容概述 2. 主要发现 3. 关键洞察 4. 建议和行动点。';
    
    if (summaryDimensions && summaryDimensions.length > 0) {
      prompt += `\n\n请重点关注这些维度：${summaryDimensions.join('、')}`;
    }
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { role: 'system', content: '你是一个专业的数据分析师。' },
        { role: 'user', content: `${prompt}\n\n${textContent}` }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    return '摘要分析失败';
  }
}

// 统计分析
async function performStatistics(parsedData, analysis, groupBy, filters) {
  const statistics = {
    totalRecords: parsedData.length,
    sentimentDistribution: {},
    topicDistribution: {},
    keywordFrequency: {},
    representativeQuotes: {},
    crossAnalysis: {}
  };
  
  // 情感分布统计
  if (analysis.sentiment) {
    try {
      const sentimentData = typeof analysis.sentiment === 'string' 
        ? JSON.parse(analysis.sentiment) 
        : analysis.sentiment;
      
      if (sentimentData.distribution) {
        statistics.sentimentDistribution = sentimentData.distribution;
      }
    } catch (e) {
      // 如果解析失败，进行简单统计
      statistics.sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
    }
  }
  
  // 话题分布统计
  if (analysis.topics) {
    try {
      const topicData = typeof analysis.topics === 'string' 
        ? JSON.parse(analysis.topics) 
        : analysis.topics;
      
      if (topicData.topics) {
        statistics.topicDistribution = topicData.topics.reduce((acc, topic) => {
          acc[topic.name] = topic.count || 0;
          return acc;
        }, {});
      }
    } catch (e) {
      statistics.topicDistribution = {};
    }
  }
  
  // 关键词频率统计
  if (analysis.keywords) {
    try {
      const keywordData = typeof analysis.keywords === 'string' 
        ? JSON.parse(analysis.keywords) 
        : analysis.keywords;
      
      if (keywordData.frequency) {
        statistics.keywordFrequency = keywordData.frequency;
      }
    } catch (e) {
      statistics.keywordFrequency = {};
    }
  }
  
  // 代表性语句提取
  statistics.representativeQuotes = await extractRepresentativeQuotes(parsedData, analysis);
  
  // 交叉分析
  if (groupBy) {
    statistics.crossAnalysis = await performCrossAnalysis(parsedData, analysis, groupBy, filters);
  }
  
  return statistics;
}

// 提取代表性语句
async function extractRepresentativeQuotes(parsedData, analysis) {
  const quotes = {
    positive: [],
    negative: [],
    neutral: [],
    topics: {}
  };
  
  // 简单实现：随机选择一些语句作为代表性语句
  const sampleSize = Math.min(5, Math.floor(parsedData.length * 0.1));
  const samples = parsedData.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
  
  samples.forEach(item => {
    const text = item.content || item.text || item.comment || '';
    if (text.length > 10) {
      quotes.neutral.push(text.substring(0, 100) + '...');
    }
  });
  
  return quotes;
}

// 交叉分析
async function performCrossAnalysis(parsedData, analysis, groupBy, filters) {
  const crossAnalysis = {};
  
  // 按指定字段分组分析
  if (groupBy && parsedData.length > 0 && parsedData[0][groupBy]) {
    const groups = {};
    parsedData.forEach(item => {
      const groupValue = item[groupBy] || '未知';
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(item);
    });
    
    // 计算每组的统计信息
    Object.keys(groups).forEach(groupName => {
      crossAnalysis[groupName] = {
        count: groups[groupName].length,
        percentage: (groups[groupName].length / parsedData.length * 100).toFixed(2),
        averageRating: calculateAverageRating(groups[groupName]),
        sentimentDistribution: calculateSentimentDistribution(groups[groupName])
      };
    });
  }
  
  return crossAnalysis;
}

// 趋势分析
async function performTrendAnalysis(parsedData, analysis, timeField, trendType, comparisonFields) {
  const trends = {
    timeSeries: [],
    trendSummary: '',
    comparisons: {},
    recommendations: []
  };
  
  // 时间序列分析
  if (timeField && parsedData.length > 0 && parsedData[0][timeField]) {
    trends.timeSeries = await analyzeTimeSeries(parsedData, timeField, analysis);
  }
  
  // 趋势摘要
  trends.trendSummary = await generateTrendSummary(parsedData, analysis, trendType);
  
  // 对比分析
  if (comparisonFields && comparisonFields.length > 0) {
    trends.comparisons = await performComparisonAnalysis(parsedData, analysis, comparisonFields);
  }
  
  // 生成建议
  trends.recommendations = await generateRecommendations(parsedData, analysis, trends);
  
  return trends;
}

// 时间序列分析
async function analyzeTimeSeries(parsedData, timeField, analysis) {
  const timeSeries = [];
  
  // 按时间分组
  const timeGroups = {};
  parsedData.forEach(item => {
    const timeValue = item[timeField];
    if (timeValue) {
      const date = new Date(timeValue);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!timeGroups[month]) {
        timeGroups[month] = [];
      }
      timeGroups[month].push(item);
    }
  });
  
  // 计算每月趋势
  Object.keys(timeGroups).sort().forEach(month => {
    const groupData = timeGroups[month];
    timeSeries.push({
      period: month,
      count: groupData.length,
      sentiment: calculateAverageSentiment(groupData),
      topics: extractTopTopics(groupData),
      keywords: extractTopKeywords(groupData)
    });
  });
  
  return timeSeries;
}

// 生成趋势摘要
async function generateTrendSummary(parsedData, analysis, trendType) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { 
          role: 'system', 
          content: '你是一个专业的数据分析师，擅长识别数据趋势和模式。' 
        },
        { 
          role: 'user', 
          content: `请分析以下问卷数据的趋势特征，重点关注${trendType}方面的变化：\n\n${JSON.stringify(analysis, null, 2)}` 
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    return '趋势分析失败';
  }
}

// 对比分析
async function performComparisonAnalysis(parsedData, analysis, comparisonFields) {
  const comparisons = {};
  
  comparisonFields.forEach(field => {
    if (parsedData.length > 0 && parsedData[0][field]) {
      const fieldGroups = {};
      parsedData.forEach(item => {
        const value = item[field] || '未知';
        if (!fieldGroups[value]) {
          fieldGroups[value] = [];
        }
        fieldGroups[value].push(item);
      });
      
      comparisons[field] = Object.keys(fieldGroups).map(key => ({
        value: key,
        count: fieldGroups[key].length,
        percentage: (fieldGroups[key].length / parsedData.length * 100).toFixed(2),
        sentiment: calculateAverageSentiment(fieldGroups[key])
      }));
    }
  });
  
  return comparisons;
}

// 生成建议
async function generateRecommendations(parsedData, analysis, trends) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20',
      messages: [
        { 
          role: 'system', 
          content: '你是一个专业的业务分析师，基于数据分析结果提供 actionable 的建议。' 
        },
        { 
          role: 'user', 
          content: `基于以下分析结果，请提供3-5条具体的改进建议：\n\n分析结果：${JSON.stringify(analysis, null, 2)}\n\n趋势分析：${JSON.stringify(trends, null, 2)}` 
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });
    
    return response.choices[0].message.content.split('\n').filter(line => line.trim());
  } catch (error) {
    return ['建议生成失败'];
  }
}

// 辅助计算函数
function calculateAverageRating(data) {
  const ratings = data.map(item => {
    const rating = item.rating || item.score || item.satisfaction;
    return typeof rating === 'number' ? rating : null;
  }).filter(r => r !== null);
  
  return ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : 0;
}

function calculateSentimentDistribution(data) {
  // 简单实现，实际应该基于AI分析结果
  return { positive: 0, neutral: 0, negative: 0 };
}

function calculateAverageSentiment(data) {
  // 简单实现，实际应该基于AI分析结果
  return 'neutral';
}

function extractTopTopics(data) {
  // 简单实现，实际应该基于AI分析结果
  return [];
}

function extractTopKeywords(data) {
  // 简单实现，实际应该基于AI分析结果
  return [];
}

function convertToCSV(result) {
  // 简单的CSV转换实现
  const headers = ['字段', '值'];
  const rows = [
    ['文件名', result.fileName],
    ['上传时间', result.uploadTime],
    ['状态', result.status],
    ['总记录数', result.parsedData ? result.parsedData.length : 0]
  ];
  
  if (result.analysis) {
    Object.keys(result.analysis).forEach(key => {
      rows.push([key, JSON.stringify(result.analysis[key])]);
    });
  }
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// 原有的简单分析函数（保留兼容性）
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