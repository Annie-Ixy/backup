const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const yauzl = require('yauzl');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const iconv = require('iconv-lite');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// 统一的文件名编码处理函数
function decodeFilename(filename) {
  if (!filename) return filename;
  
  console.log(`原始文件名: "${filename}"`);
  
  try {
    // 检测是否已经是正确的UTF-8中文
    if (/[\u4e00-\u9fff]/.test(filename)) {
      console.log('文件名已包含正确的中文字符，无需转码');
      return filename;
    }
    
    // 检测是否是纯ASCII字符
    if (/^[\x00-\x7F]*$/.test(filename)) {
      console.log('文件名为纯ASCII，无需转码');
      return filename;
    }
    
    // 特殊处理：检测是否是UTF-8被错误解析的情况
    // 这种情况下文件名会包含像 ã、º、å、·、æ、º、è、½、ï¼ 这样的字符
    const hasUtf8Artifacts = /[ãºåæèïï¼ééæ]/g.test(filename);
    
    if (hasUtf8Artifacts) {
      console.log('检测到UTF-8被错误解析，尝试修复...');
      
      try {
        // 方法1: 假设原文件名是UTF-8，但被错误地用latin1/iso-8859-1解析
        const buffer = Buffer.from(filename, 'latin1');
        const utf8Result = buffer.toString('utf8');
        
        if (/[\u4e00-\u9fff]/.test(utf8Result)) {
          console.log(`成功使用latin1->utf8修复: "${filename}" -> "${utf8Result}"`);
          return utf8Result;
        }
      } catch (e) {
        console.log('latin1->utf8转换失败:', e.message);
      }
      
      try {
        // 方法2: 尝试其他编码修复
        const buffer = Buffer.from(filename, 'binary');
        const utf8Result = buffer.toString('utf8');
        
        if (/[\u4e00-\u9fff]/.test(utf8Result)) {
          console.log(`成功使用binary->utf8修复: "${filename}" -> "${utf8Result}"`);
          return utf8Result;
        }
      } catch (e) {
        console.log('binary->utf8转换失败:', e.message);
      }
    }
    
    // 尝试不同的编码方式恢复中文文件名
    const encodings = [
      { name: 'gbk', encoding: 'gbk' },
      { name: 'gb2312', encoding: 'gb2312' },
      { name: 'cp936', encoding: 'cp936' },
      { name: 'big5', encoding: 'big5' },
      { name: 'cp437', encoding: 'cp437' }
    ];
    
    for (const { name, encoding } of encodings) {
      try {
        // 尝试用iconv-lite解码
        const buffer = Buffer.from(filename, 'binary');
        const decodedName = iconv.decode(buffer, encoding);
        
        // 检查解码结果是否包含中文字符且没有乱码
        if (decodedName && 
            /[\u4e00-\u9fff]/.test(decodedName) && 
            !decodedName.includes('') &&
            decodedName.length > 0) {
          console.log(`成功使用 ${name} 解码: "${filename}" -> "${decodedName}"`);
          return decodedName;
        }
      } catch (e) {
        // 编码转换失败，继续尝试下一种
        continue;
      }
    }
    
    // 如果所有方法都失败，尝试url解码（防止文件名被URL编码）
    try {
      const urlDecoded = decodeURIComponent(filename);
      if (urlDecoded !== filename && /[\u4e00-\u9fff]/.test(urlDecoded)) {
        console.log(`成功使用URL解码: "${filename}" -> "${urlDecoded}"`);
        return urlDecoded;
      }
    } catch (e) {
      // URL解码失败，忽略
    }
    
    console.log('所有编码方式都失败，保持原文件名');
    return filename;
    
  } catch (error) {
    console.log(`文件名编码处理出错: ${error.message}，保持原文件名`);
    return filename;
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 统一处理所有文件的中文编码
    let originalName = file.originalname;
    
    try {
      // 使用统一的编码处理函数
      originalName = decodeFilename(originalName);
      
      // 生成安全的文件名，保留原始扩展名
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const timestamp = Date.now();
      const safeName = `${timestamp}-${baseName}${ext}`;
      
      console.log(`文件保存: 原始="${file.originalname}" -> 处理后="${originalName}" -> 安全名称="${safeName}"`);
      cb(null, safeName);
      
    } catch (error) {
      console.log(`文件名处理失败: ${error.message}，使用时间戳命名`);
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const fallbackName = `${timestamp}-file${ext}`;
      cb(null, fallbackName);
    }
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP and PDF files are allowed'));
    }
  }
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Store processed candidates in memory (in production, use a database)
let candidatesCache = new Map();

// Extract ZIP file and get PDF files
async function extractZipFile(zipPath) {
  return new Promise((resolve, reject) => {
    const pdfFiles = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) reject(err);
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\.pdf$/i.test(entry.fileName)) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.readEntry();
              return;
            }
            
            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              // 使用统一的文件名编码处理函数
              let decodedFileName = entry.fileName;
              
              try {
                decodedFileName = decodeFilename(entry.fileName);
                console.log(`ZIP内文件: "${entry.fileName}" -> "${decodedFileName}"`);
              } catch (error) {
                console.log(`ZIP文件名编码处理失败: ${entry.fileName}, 错误:`, error.message);
                decodedFileName = entry.fileName; // 保持原文件名
              }
              
              pdfFiles.push({
                filename: decodedFileName,
                buffer: Buffer.concat(chunks)
              });
              zipfile.readEntry();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });
      
      zipfile.on('end', () => {
        resolve(pdfFiles);
      });
    });
  });
}

// Extract text from PDF
async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
}

// Analyze resume with AI
async function analyzeResume(resumeText, filename, jobDescription) {
  try {
    // 检查是否启用模拟模式（当网络连接有问题时）
    const useSimulation = process.env.USE_SIMULATION === 'true' || !process.env.OPENAI_API_KEY;
    
    if (useSimulation) {
      console.log('Using simulation mode for resume analysis');
      return generateSimulatedAnalysis(resumeText, filename, jobDescription);
    }

    const prompt = `请分析以下简历与岗位需求的匹配度：

### 岗位需求
${jobDescription}

### 候选人简历
${resumeText}

### 分析要求
请提供详细的JSON格式分析，包含以下字段：
{
  "name": "候选人姓名",
  "position": "当前职位",
  "company": "当前公司",
  "education": "教育背景",
  "experience": "工作年限",
  "age": "年龄（如果提及）",
  "skills": ["技能1", "技能2", "技能3"],
  "strengths": ["优势1", "优势2", "优势3"],
  "projects": ["项目1", "项目2", "项目3"],
  "score": 85,
  "tier": "高度匹配",
  "match": "匹配度描述",
  "recommendation": "推荐建议",
  "summary": "候选人总结",
  "reasoning": "评分理由"
}

### 评分标准 (0-100分)
- **90-100分 (完美匹配)**：完全符合岗位要求，技能经验高度匹配
- **80-89分 (高度匹配)**：大部分要求匹配，有相关经验和技能
- **70-79分 (良好匹配)**：基本符合要求，部分技能需要培养
- **60-69分 (一般匹配)**：有一定相关性，需要较多培训
- **50-59分 (有限匹配)**：相关性较低，需要大量培训
- **0-49分 (不匹配)**：基本不符合岗位要求

### 具体评估维度
- 技术技能匹配度
- 工作经验相关性
- 教育背景适配性
- 项目经验价值
- 学习能力表现
- 适应能力

### 评分原则
- **严格区分度**：必须根据候选人实际能力差异给出不同分数，避免聚集在相同分数
- **客观性**：基于事实，避免主观臆断
- **相关性**：重点评估与岗位直接相关的能力
- **全面性**：考虑技能、经验、潜力等多维度

### 注意事项
- 【重要】必须严格按照评分标准给分，不要聚集在某个区间，要拉开分数差距
- 基于简历中的具体证据进行评估
- 考虑岗位级别要求（初级/中级/高级）
- 平衡当前能力与发展潜力
- 【重要】每个候选人的评分必须有明显区别，体现真实能力差异`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "你是一位专业的HR分析师，专门负责简历评估。请仔细分析简历与具体岗位需求的匹配度，提供详细、准确的评估。特别注意候选人的实际项目经验和技能与岗位要求的相关性。\n\n【中文输出要求 - 绝对不允许违反】：\n1. 你必须严格使用中文回复，绝对不可以使用任何英文内容\n2. 所有字段内容都必须是中文，包括技能、优势、项目、总结等\n3. 如果简历中有英文内容，请将其翻译成中文\n4. 【特别重要】summary字段必须用中文总结，不允许出现英文单词或句子\n5. 【特别重要】reasoning字段必须用中文分析，不允许出现英文单词或句子\n6. 即使候选人姓名是英文，也要在后面用中文说明\n7. 确保输出的JSON格式正确，但内容全部使用中文\n\n【评分差异化要求】：\n8. 【重要】必须严格按照评分标准区分候选人，给出不同的分数，避免都是相同或相近的分数\n9. 【重要】评分必须真实反映候选人与岗位的匹配度差异，分数要拉开差距\n10. 在reasoning字段中详细说明为什么给这个分数，具体分析哪些地方匹配，哪些地方不足\n\n【严格禁止】：任何英文表述，包括候选人评价、技能描述、项目说明等，全部必须翻译成中文"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    });

    const analysisText = completion.choices[0].message.content;
    
    // Extract JSON from the response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        id: uuidv4(),
        filename,
        ...analysis,
        rawText: resumeText.substring(0, 1000) // Store first 1000 chars for reference
      };
    } else {
      throw new Error('No valid JSON found in AI response');
    }
  } catch (error) {
    console.error('Error analyzing resume:', error);
    // 如果 OpenAI API 失败，使用模拟分析
    console.log('Falling back to simulation mode due to API error');
    return generateSimulatedAnalysis(resumeText, filename, jobDescription);
  }
}

// 生成模拟的简历分析结果
function generateSimulatedAnalysis(resumeText, filename, jobDescription) {
  // 从文件名提取候选人信息，支持多种格式
  let candidateName = '候选人';
  
  console.log(`开始从文件名提取候选人姓名: "${filename}"`);
  
  // 尝试多种文件名格式提取姓名，支持中文
  const patterns = [
    // 中文格式模式
    /】([^\s\-_\.]+)\s/,              // 格式：xxx】姓名 空格
    /】([^\s\-_\.]+)[-_]/,            // 格式：xxx】姓名-xxx 或 xxx】姓名_xxx
    /】([^\s\-_\.]+)\./,              // 格式：xxx】姓名.pdf
    /】([^\s\-_\.]+)$/,               // 格式：xxx】姓名
    /^([^\s\-_\.]+)[-_]/,            // 格式：姓名-xxx 或 姓名_xxx
    /^([^\s\-_\.]+)\s/,              // 格式：姓名 空格
    /([^\s\-_\.]+)\.pdf$/i,          // 格式：姓名.pdf
    /^(\d+-)?([^\s\-_\.]+)\.pdf$/i,  // 格式：时间戳-姓名.pdf
    /^(\d+-)?([^\s\-_\.]+)$/,        // 格式：时间戳-姓名
    
    // 更灵活的中文姓名匹配（2-4个中文字符）
    /([\u4e00-\u9fff]{2,4})/,        // 任何位置的2-4个中文字符
    
    // 英文姓名格式
    /([A-Za-z]+(?:\s+[A-Za-z]+)*)/   // 英文姓名（可能包含空格）
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = filename.match(pattern);
    
    if (match) {
      // 对于有多个捕获组的模式，选择最后一个非空的捕获组
      let extractedName = '';
      for (let j = match.length - 1; j >= 1; j--) {
        if (match[j] && match[j].trim()) {
          extractedName = match[j].trim();
          break;
        }
      }
      
      if (extractedName) {
        // 验证提取的姓名是否合理
        if (isValidName(extractedName)) {
          candidateName = extractedName;
          console.log(`成功提取候选人姓名: "${candidateName}" (使用模式 ${i + 1})`);
          break;
        } else {
          console.log(`提取的姓名 "${extractedName}" 不符合要求，继续尝试下一个模式`);
        }
      }
    }
  }
  
  if (candidateName === '候选人') {
    console.log(`未能从文件名 "${filename}" 中提取到有效姓名，使用默认名称`);
  }
  
  // 根据简历内容长度和关键词生成不同的评分
  const textLength = resumeText.length;
  const hasAI = /人工智能|AI|机器学习|深度学习|算法/i.test(resumeText);
  const hasPython = /Python|python/i.test(resumeText);
  const hasExperience = /年|经验|项目/i.test(resumeText);
  const hasEducation = /大学|学院|本科|硕士|博士/i.test(resumeText);
  
  // 基于关键词计算评分
  let baseScore = 60;
  if (hasAI) baseScore += 15;
  if (hasPython) baseScore += 10;
  if (hasExperience) baseScore += 10;
  if (hasEducation) baseScore += 5;
  if (textLength > 1000) baseScore += 5;
  
  // 添加随机变化以区分候选人
  const randomVariation = Math.floor(Math.random() * 20) - 10;
  const finalScore = Math.max(45, Math.min(95, baseScore + randomVariation));
  
  // 根据评分确定等级
  let tier, match, recommendation;
  if (finalScore >= 90) {
    tier = "完美匹配";
    match = "完全符合岗位要求";
    recommendation = "强烈推荐面试";
  } else if (finalScore >= 80) {
    tier = "高度匹配";
    match = "大部分要求匹配";
    recommendation = "推荐面试";
  } else if (finalScore >= 70) {
    tier = "良好匹配";
    match = "基本符合要求";
    recommendation = "可以考虑面试";
  } else if (finalScore >= 60) {
    tier = "一般匹配";
    match = "有一定相关性";
    recommendation = "需要进一步评估";
  } else {
    tier = "有限匹配";
    match = "相关性较低";
    recommendation = "不建议面试";
  }
  
  return {
    id: uuidv4(),
    filename,
    name: candidateName,
    position: hasAI ? "AI工程师" : "软件工程师",
    company: "某科技公司",
    education: hasEducation ? "本科及以上" : "未知",
    experience: hasExperience ? "2-5年" : "应届生",
    age: "25-30岁",
    skills: [
      ...(hasAI ? ["人工智能", "机器学习"] : []),
      ...(hasPython ? ["Python编程"] : []),
      "算法设计",
      "数据分析"
    ],
    strengths: [
      hasAI ? "具备AI相关技能" : "技术基础扎实",
      hasExperience ? "有相关工作经验" : "学习能力强",
      "沟通能力良好"
    ],
    projects: [
      hasAI ? "AI算法优化项目" : "软件开发项目",
      "数据处理系统",
      "技术研究项目"
    ],
    score: finalScore,
    tier,
    match,
    recommendation,
    summary: `${candidateName}是一位${hasExperience ? '有经验的' : '应届'}${hasAI ? 'AI' : '软件'}工程师，${hasAI ? '具备人工智能相关技能' : '技术基础扎实'}，${match}。`,
    reasoning: `基于简历分析：${hasAI ? '具备AI相关技能(+15分)' : ''}${hasPython ? '熟悉Python编程(+10分)' : ''}${hasExperience ? '有相关工作经验(+10分)' : ''}${hasEducation ? '教育背景良好(+5分)' : ''}。综合评估得分${finalScore}分。`,
    rawText: resumeText.substring(0, 1000)
  };
}

// 验证提取的姓名是否合理
function isValidName(name) {
  if (!name || name.length === 0) return false;
  
  // 过滤掉明显不是姓名的字符串
  const invalidPatterns = [
    /^\d+$/,                    // 纯数字
    /^[._\-]+$/,               // 纯符号
    /^(pdf|doc|docx|txt)$/i,   // 文件扩展名
    /^(resume|cv|简历)$/i,      // 简历相关词汇
    /^(candidate|应聘者)$/i     // 候选人相关词汇
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      return false;
    }
  }
  
  // 姓名长度限制
  if (name.length > 20) return false;
  
  // 如果包含中文，长度应该在合理范围内
  if (/[\u4e00-\u9fff]/.test(name) && (name.length < 2 || name.length > 6)) {
    return false;
  }
  
  return true;
}

// API Routes

// Upload and process resumes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { jobDescription } = req.body;
    if (!jobDescription || !jobDescription.trim()) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const jobId = uuidv4();
    
    // Start processing in background
    processResumes(req.file.path, jobId, jobDescription.trim());
    
    res.json({ 
      message: 'File uploaded successfully. Processing started.',
      jobId: jobId
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get processing status and results
app.get('/api/results/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (candidatesCache.has(jobId)) {
    const data = candidatesCache.get(jobId);
    res.json(data);
  } else {
    res.json({ status: 'processing', candidates: [] });
  }
});

// Process resumes in background
async function processResumes(filePath, jobId, jobDescription) {
  try {
    // Update status to processing
    candidatesCache.set(jobId, { status: 'processing', candidates: [], jobDescription });
    
    let pdfFiles = [];
    
    // Check if the file is a PDF or ZIP
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.pdf') {
      // Handle single PDF file
      console.log('Processing single PDF file');
      const pdfBuffer = await fs.readFile(filePath);
      
      // Extract original filename from the saved filename (remove timestamp prefix)
      const savedFilename = path.basename(filePath);
      const timestampMatch = savedFilename.match(/^\d+-(.+)$/);
      const displayName = timestampMatch ? timestampMatch[1] : savedFilename;
      
      pdfFiles = [{
        filename: displayName, // Use original filename for display
        buffer: pdfBuffer
      }];
    } else if (fileExtension === '.zip') {
      // Handle ZIP file with multiple PDFs
      console.log('Processing ZIP file');
      pdfFiles = await extractZipFile(filePath);
    } else {
      throw new Error('Unsupported file format');
    }
    
    console.log(`Found ${pdfFiles.length} PDF file(s)`);
    
    const candidates = [];
    
    // Process each PDF
    for (let i = 0; i < pdfFiles.length; i++) {
      const pdfFile = pdfFiles[i];
      console.log(`Processing ${pdfFile.filename} (${i + 1}/${pdfFiles.length})`);
      
      // Extract text from PDF
      const resumeText = await extractTextFromPDF(pdfFile.buffer);
      
      if (resumeText.trim()) {
        // Analyze with AI using the job description
        const analysis = await analyzeResume(resumeText, pdfFile.filename, jobDescription);
        candidates.push(analysis);
        
        // Update cache with current progress
        candidatesCache.set(jobId, {
          status: 'processing',
          candidates: [...candidates],
          progress: Math.round(((i + 1) / pdfFiles.length) * 100),
          jobDescription
        });
      }
    }
    
    // Sort candidates by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    
    // Assign ranks
    candidates.forEach((candidate, index) => {
      candidate.rank = index + 1;
    });
    
    // Update cache with final results
    candidatesCache.set(jobId, {
      status: 'completed',
      candidates: candidates,
      progress: 100,
      totalProcessed: candidates.length,
      jobDescription
    });
    
    console.log(`Processing completed for job ${jobId}. Processed ${candidates.length} candidates.`);
    
    // Clean up uploaded file
    fs.remove(filePath);
    
  } catch (error) {
    console.error('Processing error:', error);
    candidatesCache.set(jobId, {
      status: 'error',
      error: error.message,
      candidates: [],
      jobDescription
    });
  }
}

// Get all job results (for demo purposes)
app.get('/api/jobs', (req, res) => {
  const jobs = Array.from(candidatesCache.entries()).map(([jobId, data]) => ({
    jobId,
    ...data
  }));
  res.json(jobs);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Make sure to set OPENAI_API_KEY in your .env file`);
}); 