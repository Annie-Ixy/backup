const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const yauzl = require('yauzl');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.ensureDirSync(uploadsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
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
              pdfFiles.push({
                filename: entry.fileName,
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
    const prompt = `# 简历与岗位匹配度评估提示词

## 基本要求
分析候选人简历与岗位需求的匹配度，提供客观、准确的评估结果。

**输入：**
- 岗位需求：${jobDescription}
- 候选人简历：${resumeText}

## 输出格式
严格按照以下JSON格式返回，所有内容必须使用中文：

{
  "name": "候选人姓名",
  "position": "当前职位",
  "company": "当前公司",
  "education": "最高学历",
  "experience": "工作年限",
  "age": "年龄或学历级别",
  "skills": ["技能1", "技能2", "技能3"],
  "strengths": ["优势1", "优势2", "优势3"],
  "projects": ["项目1", "项目2", "项目3"],
  "score": 评分(0-100),
  "tier": "评级等级",
  "match": "匹配程度",
  "recommendation": "推荐级别",
  "summary": "候选人简要总结(必须中文，50字内)",
  "reasoning": "评分详细理由(必须中文，100字内)"
}

【绝对要求 - 不可违反】：
1. summary字段：必须用中文总结候选人情况，不允许任何英文内容
2. reasoning字段：必须用中文分析评分理由，不允许任何英文内容  
3. 所有技能、优势、项目描述：即使原文是英文也必须翻译成中文
4. 候选人评价：绝对不允许出现英文句子，必须全部用中文表述

## 评分标准（严格执行 - 必须拉开分数差距）

### 分数区间与标准
- **95-100分**：完美匹配，远超岗位要求
  - 具备所有核心技能且有深度
  - 有多个直接相关成功项目经验
  - 在相关领域有突出成就和创新

- **85-94分**：优秀匹配，完全胜任
  - 具备80%以上核心技能
  - 有相关项目经验且成果显著
  - 技术深度符合要求

- **75-84分**：良好匹配，基本胜任
  - 具备60-80%核心技能
  - 有一定相关经验
  - 需少量培训

- **65-74分**：一般匹配，有潜力
  - 具备40-60%核心技能
  - 基础扎实但缺乏经验
  - 需要培训指导

- **55-64分**：弱匹配，勉强可考虑
  - 仅具备基础技能
  - 几乎无相关经验
  - 需大量培训

- **50分以下**：不匹配，不建议
  - 技能与岗位无关
  - 无相关经验

### 评级等级
- **顶级推荐**：95-100分
- **优秀候选**：85-94分  
- **中等匹配**：75-84分
- **有限匹配**：65-74分
- **弱匹配**：55-64分
- **不太匹配**：50分以下

### 匹配程度
- **完美匹配**：技能经验完全吻合
- **高度匹配**：核心技能匹配度高
- **良好匹配**：基本技能匹配
- **潜力匹配**：基础好但需培养
- **一般匹配**：部分技能相关
- **不匹配**：技能不相关

### 推荐级别
- **强烈推荐**：立即考虑
- **推荐**：优先考虑
- **一般推荐**：可以考虑
- **可考虑**：备选
- **有限推荐**：条件性考虑
- **不推荐**：不建议

## 评估要点

### 核心评估维度
1. **技能匹配度**（40%权重）
   - 是否具备岗位要求的核心技能
   - 技术深度和广度
   - 相关工具和框架经验

2. **项目经验**（30%权重）
   - 相关项目的复杂度和成果
   - 项目中的角色和贡献
   - 解决问题的能力

3. **行业背景**（20%权重）
   - 相关行业工作经验
   - 对业务的理解程度
   - 行业特定知识

4. **学习潜力**（10%权重）
   - 教育背景
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
    // Return a default analysis if AI fails
    return {
      id: uuidv4(),
      filename,
      name: `候选人来自 ${filename}`,
      position: "未知",
      company: "未知",
      education: "未知",
      experience: "未知",
      age: "未知",
      skills: ["技术技能"],
      strengths: ["简历解析失败 - 需要人工审核"],
      projects: ["无法提取项目信息"],
      score: 50,
      tier: "有限匹配",
      match: "需要人工审核",
      recommendation: "手动评估",
      summary: "简历分析失败 - 需要人工审核",
      reasoning: "系统解析失败，无法进行准确评估",
      rawText: resumeText.substring(0, 1000)
    };
  }
}

// API Routes

// Upload and process resumes
app.post('/api/upload', upload.single('zipFile'), async (req, res) => {
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
async function processResumes(zipPath, jobId, jobDescription) {
  try {
    // Update status to processing
    candidatesCache.set(jobId, { status: 'processing', candidates: [], jobDescription });
    
    // Extract PDF files from ZIP
    const pdfFiles = await extractZipFile(zipPath);
    console.log(`Found ${pdfFiles.length} PDF files`);
    
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
    fs.remove(zipPath);
    
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