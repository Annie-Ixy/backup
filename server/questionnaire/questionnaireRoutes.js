const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { OpenAI } = require('openai');

const router = express.Router();

// 配置OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV和Excel文件格式'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 存储分析结果的临时数据结构
let analysisResults = new Map();
let uploadedData = [];

// 1. 上传问卷数据
router.post('/upload-questionnaire', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    let data = [];
    
    if (fileExt === '.csv') {
      // 解析CSV文件
      data = await parseCSVFile(filePath);
    } else {
      // 解析Excel文件
      data = await parseExcelFile(filePath);
    }

    // 生成唯一ID
    const analysisId = Date.now().toString();
    
    // 存储数据
    uploadedData = data;
    analysisResults.set(analysisId, {
      id: analysisId,
      fileName: req.file.originalname,
      uploadTime: new Date().toISOString(),
      data: data,
      analysis: null,
      status: 'uploaded'
    });

    res.json({
      success: true,
      analysisId: analysisId,
      message: `成功上传 ${data.length} 条数据`,
      data: {
        totalRecords: data.length,
        sampleData: data.slice(0, 5)
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
    const texts = analysisData.data.map(item => item.text || item.answer || item.content || item.feedback).filter(Boolean);

    if (texts.length === 0) {
      return res.status(400).json({ error: '没有找到可分析的文本数据' });
    }

    // 开始分析
    analysisData.status = 'analyzing';
    analysisResults.set(analysisId, analysisData);

    const analysisResults = await performTextAnalysis(texts, analysisType, customTags, summaryDimensions);
    
    // 更新分析结果
    analysisData.analysis = analysisResults;
    analysisData.status = 'completed';
    analysisData.completedTime = new Date().toISOString();
    analysisResults.set(analysisId, analysisData);

    res.json({
      success: true,
      analysisId: analysisId,
      results: analysisResults
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

// 4. 统计分析接口
router.post('/statistics', async (req, res) => {
  try {
    const { analysisId, groupBy, filters } = req.body;
    
    if (!analysisId || !analysisResults.has(analysisId)) {
      return res.status(400).json({ error: '无效的分析ID' });
    }

    const analysisData = analysisResults.get(analysisId);
    const statistics = await generateStatistics(analysisData, groupBy, filters);

    res.json({
      success: true,
      statistics: statistics
    });

  } catch (error) {
    console.error('统计分析错误:', error);
    res.status(500).json({ error: '统计分析失败: ' + error.message });
  }
});

// 5. 趋势分析接口
router.post('/trend-analysis', async (req, res) => {
  try {
    const { analysisId, timeField, timeRange, metrics } = req.body;
    
    if (!analysisId || !analysisResults.has(analysisId)) {
      return res.status(400).json({ error: '无效的分析ID' });
    }

    const analysisData = analysisResults.get(analysisId);
    const trends = await analyzeTrends(analysisData, timeField, timeRange, metrics);

    res.json({
      success: true,
      trends: trends
    });

  } catch (error) {
    console.error('趋势分析错误:', error);
    res.status(500).json({ error: '趋势分析失败: ' + error.message });
  }
});

// 6. 导出分析结果
router.get('/export/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { format = 'csv' } = req.query;
    
    if (!analysisResults.has(analysisId)) {
      return res.status(404).json({ error: '分析结果不存在' });
    }

    const analysisData = analysisResults.get(analysisId);
    const exportData = await generateExportData(analysisData, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analysis-${analysisId}.csv`);
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData
      });
    }

  } catch (error) {
    console.error('导出错误:', error);
    res.status(500).json({ error: '导出失败: ' + error.message });
  }
});

// 7. 获取分析历史
router.get('/analysis-history', (req, res) => {
  try {
    const history = Array.from(analysisResults.values()).map(item => ({
      id: item.id,
      fileName: item.fileName,
      uploadTime: item.uploadTime,
      completedTime: item.completedTime,
      status: item.status,
      totalRecords: item.data ? item.data.length : 0
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

// 解析CSV文件
async function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// 解析Excel文件
async function parseExcelFile(filePath) {
  // 这里需要添加Excel解析逻辑
  // 可以使用xlsx库
  throw new Error('Excel文件解析功能待实现');
}

// 执行文本分析
async function performTextAnalysis(texts, analysisType, customTags, summaryDimensions) {
  const results = {
    sentiment: [],
    topics: [],
    keywords: [],
    summary: null
  };

  // 情绪分析
  if (analysisType.includes('sentiment')) {
    results.sentiment = await analyzeSentiment(texts);
  }

  // 话题分类
  if (analysisType.includes('topics')) {
    results.topics = await analyzeTopics(texts, customTags);
  }

  // 关键词提取
  if (analysisType.includes('keywords')) {
    results.keywords = await extractKeywords(texts);
  }

  // 内容摘要
  if (analysisType.includes('summary')) {
    results.summary = await generateSummary(texts, summaryDimensions);
  }

  return results;
}

// 情绪分析
async function analyzeSentiment(texts) {
  const sentiments = [];
  
  for (const text of texts) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "你是一个专业的情绪分析专家。请分析以下文本的情绪，只返回：positive（正面）、neutral（中性）、negative（负面）中的一个。"
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const sentiment = response.choices[0].message.content.trim().toLowerCase();
      sentiments.push({
        text: text,
        sentiment: sentiment,
        confidence: 0.8 // 简化处理
      });
    } catch (error) {
      console.error('情绪分析错误:', error);
      sentiments.push({
        text: text,
        sentiment: 'neutral',
        confidence: 0.5
      });
    }
  }

  return sentiments;
}

// 话题分类
async function analyzeTopics(texts, customTags) {
  const topics = [];
  
  // 使用自定义标签或AI生成话题
  if (customTags && customTags.length > 0) {
    // 使用自定义标签进行分类
    for (const text of texts) {
      const topic = await classifyWithCustomTags(text, customTags);
      topics.push({
        text: text,
        topic: topic
      });
    }
  } else {
    // AI自动生成话题聚类
    const topicClusters = await generateTopicClusters(texts);
    topics.push(...topicClusters);
  }

  return topics;
}

// 关键词提取
async function extractKeywords(texts) {
  const keywords = [];
  
  for (const text of texts) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "请从以下文本中提取5-10个最重要的关键词，用逗号分隔。只返回关键词，不要其他内容。"
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      const keywordsStr = response.choices[0].message.content.trim();
      const keywordList = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
      
      keywords.push({
        text: text,
        keywords: keywordList
      });
    } catch (error) {
      console.error('关键词提取错误:', error);
      keywords.push({
        text: text,
        keywords: []
      });
    }
  }

  return keywords;
}

// 生成摘要
async function generateSummary(texts, dimensions) {
  try {
    const combinedText = texts.join('\n\n');
    const dimensionPrompt = dimensions ? `，重点关注以下维度：${dimensions.join('、')}` : '';
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `请对以下文本进行摘要分析${dimensionPrompt}，生成200-300字的摘要。`
        },
        {
          role: "user",
          content: combinedText
        }
      ],
      max_tokens: 500,
      temperature: 0.5
    });

    return {
      summary: response.choices[0].message.content.trim(),
      dimensions: dimensions || ['总体内容']
    };
  } catch (error) {
    console.error('生成摘要错误:', error);
    return {
      summary: '摘要生成失败',
      dimensions: dimensions || ['总体内容']
    };
  }
}

// 使用自定义标签分类
async function classifyWithCustomTags(text, tags) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `请将以下文本分类到给定的标签中：${tags.join('、')}。只返回最匹配的标签名称。`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 50,
      temperature: 0.1
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('自定义标签分类错误:', error);
    return tags[0] || '其他';
  }
}

// 生成话题聚类
async function generateTopicClusters(texts) {
  try {
    const combinedText = texts.join('\n\n');
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "请分析以下文本，识别主要话题，并为每个话题生成一个标签。返回格式：话题标签1,话题标签2,话题标签3"
        },
        {
          role: "user",
          content: combinedText
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });

    const topics = response.choices[0].message.content.trim().split(',').map(t => t.trim());
    
    // 为每个文本分配话题
    const results = [];
    for (const text of texts) {
      const topic = await classifyWithCustomTags(text, topics);
      results.push({
        text: text,
        topic: topic
      });
    }

    return results;
  } catch (error) {
    console.error('生成话题聚类错误:', error);
    return texts.map(text => ({
      text: text,
      topic: '其他'
    }));
  }
}

// 生成统计数据
async function generateStatistics(analysisData, groupBy, filters) {
  const data = analysisData.data;
  const analysis = analysisData.analysis;
  
  const statistics = {
    totalRecords: data.length,
    sentimentStats: {},
    topicStats: {},
    keywordStats: {},
    filteredStats: {}
  };

  // 情绪统计
  if (analysis && analysis.sentiment) {
    const sentimentCounts = {};
    analysis.sentiment.forEach(item => {
      const sentiment = item.sentiment;
      sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
    });
    
    statistics.sentimentStats = {
      counts: sentimentCounts,
      percentages: Object.keys(sentimentCounts).reduce((acc, key) => {
        acc[key] = ((sentimentCounts[key] / data.length) * 100).toFixed(2);
        return acc;
      }, {})
    };
  }

  // 话题统计
  if (analysis && analysis.topics) {
    const topicCounts = {};
    analysis.topics.forEach(item => {
      const topic = item.topic;
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
    
    statistics.topicStats = {
      counts: topicCounts,
      percentages: Object.keys(topicCounts).reduce((acc, key) => {
        acc[key] = ((topicCounts[key] / data.length) * 100).toFixed(2);
        return acc;
      }, {})
    };
  }

  // 关键词统计
  if (analysis && analysis.keywords) {
    const keywordCounts = {};
    analysis.keywords.forEach(item => {
      item.keywords.forEach(keyword => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
    });
    
    // 按频率排序
    const sortedKeywords = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20); // 取前20个高频词
    
    statistics.keywordStats = {
      topKeywords: sortedKeywords,
      totalUniqueKeywords: Object.keys(keywordCounts).length
    };
  }

  return statistics;
}

// 趋势分析
async function analyzeTrends(analysisData, timeField, timeRange, metrics) {
  const data = analysisData.data;
  
  // 按时间分组
  const timeGroups = {};
  data.forEach(item => {
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

  // 计算趋势
  const trends = Object.keys(timeGroups).sort().map(month => {
    const monthData = timeGroups[month];
    const trend = {
      month: month,
      count: monthData.length
    };

    // 计算各项指标
    if (metrics.includes('sentiment')) {
      const sentimentCounts = {};
      monthData.forEach(item => {
        // 这里需要根据实际数据结构调整
        const sentiment = item.sentiment || 'neutral';
        sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
      });
      trend.sentiment = sentimentCounts;
    }

    return trend;
  });

  return {
    timeRange: timeRange,
    trends: trends,
    totalMonths: trends.length
  };
}

// 生成导出数据
async function generateExportData(analysisData, format) {
  const data = analysisData.data;
  const analysis = analysisData.analysis;
  
  const exportData = data.map((item, index) => {
    const exportItem = { ...item };
    
    if (analysis) {
      if (analysis.sentiment && analysis.sentiment[index]) {
        exportItem.sentiment = analysis.sentiment[index].sentiment;
        exportItem.sentiment_confidence = analysis.sentiment[index].confidence;
      }
      
      if (analysis.topics && analysis.topics[index]) {
        exportItem.topic = analysis.topics[index].topic;
      }
      
      if (analysis.keywords && analysis.keywords[index]) {
        exportItem.keywords = analysis.keywords[index].keywords.join(', ');
      }
    }
    
    return exportItem;
  });

  if (format === 'csv') {
    // 生成CSV格式
    const csvWriter = createCsvWriter({
      path: 'temp-export.csv',
      header: Object.keys(exportData[0] || {}).map(key => ({ id: key, title: key }))
    });
    
    await csvWriter.writeRecords(exportData);
    const csvContent = fs.readFileSync('temp-export.csv', 'utf8');
    fs.unlinkSync('temp-export.csv');
    
    return csvContent;
  }
  
  return exportData;
}

module.exports = router; 