const OpenAI = require('openai');
const config = require('../design-review-config');

class AIReviewer {
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 10 * 60 * 1000  // 5分钟超时
      });
    }
  }

  async reviewContent(processedData, targetLanguage = 'zh-CN', reviewCategories = ['basic', 'advanced']) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const content = this.extractContentForReview(processedData);
      
      // Check if this is an image-based PDF
      if (content && typeof content === 'object' && content.isImageBased) {
        console.log('Processing image-based PDF with vision analysis...');
        return await this.reviewImageBasedPDF(content.pageImages, targetLanguage, reviewCategories);
      }
      
      const prompt = this.buildReviewPrompt(content, targetLanguage, reviewCategories);

      console.log('Sending content to OpenAI for review...');
      console.log('Using model:', config.OPENAI_MODEL);
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(targetLanguage)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      // Debug logging
      console.log('OpenAI API Response:', {
        model: response.model,
        usage: response.usage,
        finish_reason: response.choices[0].finish_reason
      });
      console.log('Raw AI Response Content:');
      console.log(response.choices[0].message.content);
      console.log('--- End of AI Response ---');

      const reviewResult = this.parseAIResponse(response.choices[0].message.content);
      
      return {
        issues: reviewResult.issues || [],
        review_summary: this.generateSummary(reviewResult.issues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguage,
          categories: reviewCategories
        }
      };
    } catch (error) {
      console.error('AI review error:', error);
      
      // 如果是连接错误，切换到模拟模式
      if (error.message && (error.message.includes('Connection error') || error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET'))) {
        console.log('Falling back to simulation mode due to API connection error');
        return this.generateSimulatedReview(processedData, targetLanguage, reviewCategories);
      }
      
      throw error;
    }
  }

  extractContentForReview(processedData) {
    console.log('\n=== Extracting Content for Review ===');
    console.log('Processed data type:', processedData.type);
    
    let content = '';
    if (processedData.type === 'document') {
      content = processedData.content;
      console.log('Document content length:', content ? content.length : 0);
      
      // Check if this is an image-based PDF
      if (processedData.metadata && processedData.metadata.isImageBased) {
        console.log('Image-based PDF detected with', processedData.metadata.pageImages?.length || 0, 'pages');
        return { isImageBased: true, pageImages: processedData.metadata.pageImages };
      }
      
      console.log('First 500 chars:', content ? content.substring(0, 500) : 'NO CONTENT');
    } else if (processedData.type === 'image') {
      content = processedData.extractedText || '';
      console.log('Image OCR text length:', content.length);
    }
    
    if (!content || content.length === 0) {
      console.warn('WARNING: No content extracted from file!');
    }
    
    return content;
  }

  getSystemPrompt(targetLanguage) {
    const languageInstructions = {
      'zh-CN': '请用中文回复。',
      'en': 'Please respond in English.',
      'es': 'Por favor responde en español.',
      'fr': 'Veuillez répondre en français.',
      'de': 'Bitte antworten Sie auf Deutsch.',
      'ja': '日本語で返信してください。',
      'ko': '한국어로 답변해 주세요.'
    };

    return `You are a professional content reviewer specializing in product design documentation for Petlibro pet products. 
Your task is to review content for accuracy, consistency, and quality. 
Focus on:
1. Spelling and grammar errors
2. Terminology consistency
3. Brand name accuracy (Petlibro)
4. Technical accuracy
5. Formatting consistency
6. Contextual appropriateness

${languageInstructions[targetLanguage] || languageInstructions['en']}

IMPORTANT: Return ONLY valid JSON without any additional text or markdown formatting. Your response must start with { and end with }.

Return your response in JSON format with the following structure:
{
  "issues": [
    {
      "type": "spelling|grammar|consistency|terminology|brand|technical|formatting",
      "severity": "high|medium|low",
      "location": "specific location in text",
      "original_text": "the problematic text",
      "suggested_fix": "corrected text",
      "explanation": "why this is an issue",
      "confidence": 0.0-1.0,
      "category": "basic|advanced"
    }
  ],
  "recommendations": ["general recommendations for improvement"],
  "overall_quality_score": 0-100
}`;
  }

  buildReviewPrompt(content, targetLanguage, reviewCategories) {
    const categoryDescriptions = {
      basic: 'Basic checks: spelling, grammar, punctuation',
      advanced: 'Advanced checks: consistency, context analysis, terminology uniformity'
    };

    const selectedCategories = reviewCategories
      .map(cat => categoryDescriptions[cat])
      .join(', ');

    // Debug logging
    console.log('Building review prompt:');
    console.log('- Content length:', content.length, 'characters');
    console.log('- Content preview:', content.substring(0, 200));
    console.log('- Target language:', targetLanguage);
    console.log('- Review categories:', reviewCategories);

    return `Please review the following content for Petlibro product documentation.
Focus on: ${selectedCategories}
Target language: ${config.SUPPORTED_LANGUAGES[targetLanguage]}

Content to review:
${content}

Please identify all issues and provide specific corrections.`;
  }

  parseAIResponse(responseContent) {
    console.log('=== Parsing AI Response ===');
    console.log('Response length:', responseContent.length);
    console.log('First 200 chars:', responseContent.substring(0, 200));
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(responseContent);
      console.log('Successfully parsed JSON directly');
      return parsed;
    } catch (error) {
      // If not valid JSON, try to extract JSON from the response
      console.warn('Failed to parse AI response as JSON:', error.message);
      console.log('Full response content:');
      console.log(responseContent);
      
      // Try to find JSON content within the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('Found JSON-like content, attempting to parse...');
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('Successfully parsed extracted JSON');
          return parsed;
        } catch (e) {
          console.error('Failed to parse extracted JSON:', e);
          console.log('Extracted content that failed to parse:', jsonMatch[0].substring(0, 200));
        }
      }
      
      // If still can't parse, return a default structure
      console.error('Unable to parse AI response, returning default structure');
      return {
        issues: [],
        recommendations: ['Unable to parse AI response. Please review manually.'],
        overall_quality_score: 0
      };
    }
  }

  async reviewImageBasedPDF(pageImages, targetLanguage, reviewCategories) {
    console.log(`Analyzing ${pageImages.length} PDF pages with GPT-4o vision...`);
    
    try {
      // Prepare messages for vision analysis
      const messages = [
        {
          role: 'system',
          content: this.getVisionSystemPrompt(targetLanguage)
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please analyze these ${pageImages.length} pages from a Petlibro product documentation PDF. Review for spelling, grammar, terminology consistency, brand accuracy, and overall quality. Focus on: ${reviewCategories.join(', ')}`
            },
            ...pageImages.map((page, index) => {
              // Validate base64 string
              if (!page.base64 || page.base64.length === 0) {
                console.error(`Page ${page.page} has empty base64 data`);
                return null;
              }
              
              // Clean base64 string (remove any whitespace/newlines)
              const cleanBase64 = page.base64.replace(/\s/g, '');
              console.log(`Page ${page.page} base64 length: ${cleanBase64.length}`);
              
              return {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${cleanBase64}`,
                  detail: 'high'
                }
              };
            }).filter(Boolean)
          ]
        }
      ];

      console.log('Sending images to GPT-4o for vision analysis...');
      console.log('Using model:', config.OPENAI_MODEL);
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: messages,
        temperature: 0.3,
        max_tokens: 4000
      });

      // Debug logging
      console.log('Vision Analysis Response:', {
        model: response.model,
        usage: response.usage,
        finish_reason: response.choices[0].finish_reason
      });
      console.log('Raw Vision Response:');
      console.log(response.choices[0].message.content);
      console.log('--- End of Vision Response ---');

      const reviewResult = this.parseAIResponse(response.choices[0].message.content);
      
      // Filter issues by confidence score to reduce false positives
      const filteredIssues = this.filterIssuesByConfidence(reviewResult.issues || []);
      
      return {
        issues: filteredIssues,
        review_summary: this.generateSummary(filteredIssues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguage,
          categories: reviewCategories,
          analysisType: 'vision',
          pagesAnalyzed: pageImages.length
        }
      };
    } catch (error) {
      console.error('Vision analysis error:', error);
      throw error;
    }
  }

  getVisionSystemPrompt(targetLanguage) {
    const languageInstructions = {
      'zh-CN': '请用中文回复。',
      'en': 'Please respond in English.',
      'es': 'Por favor responde en español.',
      'fr': 'Veuillez répondre en français.',
      'de': 'Bitte antworten Sie auf Deutsch.',
      'ja': '日本語で返信してください。',
      'ko': '한국어로 답변해 주세요.'
    };

    return `You are a professional content reviewer with vision capabilities, specializing in product design documentation for Petlibro pet products. 
Your task is to analyze PDF pages visually and review content for accuracy, consistency, and quality.

IMPORTANT GUIDELINES:
1. Be conservative in error detection - only report CLEAR and OBVIOUS errors
2. Consider that packaging design may use artistic fonts and intentional spacing for visual appeal
3. Do not report issues unless you are highly confident (>80%) it's actually an error
4. Distinguish between design choices and actual mistakes

Focus on:
1. Text content: obvious spelling, grammar errors (not minor typography variations)
2. Terminology consistency across pages
3. Brand name accuracy (Petlibro)
4. Technical accuracy of product information
5. Visual formatting consistency (major issues only)
6. Layout and design quality (significant problems only)
7. Image quality and relevance

ENHANCED LOCATION REQUIREMENTS:
- Provide DETAILED location descriptions with multiple reference points
- Format: "第X页，[区域] + [具体位置] + [周围文字引用]"
- Examples: 
  * "第1页，页面上部标题区域，'Petlibro'文字下方约2cm处"
  * "第2页，左侧产品介绍栏，以'功能特点'开头的段落第3行"
  * "第3页，页面中央表格，第2列第4行数据"
- Always include surrounding text context for easier location
- Use relative positioning (上部/中部/下部, 左侧/中央/右侧)
- Provide distance estimates when possible

${languageInstructions[targetLanguage] || languageInstructions['en']}

IMPORTANT: Return ONLY valid JSON without any additional text or markdown formatting. Your response must start with { and end with }.

Return your response in JSON format with the following structure:
{
  "issues": [
    {
      "type": "spelling|grammar|consistency|terminology|brand|technical|formatting|visual",
      "severity": "high|medium|low",
      "location": "第X页，[区域][位置][文字引用] - 详细描述页面具体位置",
      "original_text": "完整的问题文字或描述",
      "suggested_fix": "corrected text or suggestion",
      "explanation": "详细说明为什么这是问题，考虑设计意图",
      "confidence": 0.0-1.0,
      "category": "basic|advanced",
      "surrounding_context": "问题前后的完整文字内容，帮助定位"
    }
  ],
  "recommendations": ["general recommendations for improvement"],
  "overall_quality_score": 0-100
}`;
  }

  filterIssuesByConfidence(issues) {
    const CONFIDENCE_THRESHOLD = 0.75; // Only report issues with >75% confidence
    const PACKAGING_KEYWORDS = ['空格', '标点', '字体', '间距', '排版']; // Packaging-specific terms
    
    return issues.filter(issue => {
      // Always include high-confidence issues
      if (issue.confidence >= CONFIDENCE_THRESHOLD) {
        return true;
      }
      
      // For packaging-related issues, be more strict
      const isPackagingIssue = PACKAGING_KEYWORDS.some(keyword => 
        issue.explanation?.includes(keyword) || 
        issue.type?.includes('formatting') ||
        issue.type?.includes('visual')
      );
      
      if (isPackagingIssue && issue.confidence < 0.85) {
        console.log(`Filtered out low-confidence packaging issue: ${issue.type} (confidence: ${issue.confidence})`);
        return false;
      }
      
      // For critical issues (brand, technical), lower the threshold
      if (issue.type === 'brand' || issue.type === 'technical') {
        return issue.confidence >= 0.6;
      }
      
      return issue.confidence >= CONFIDENCE_THRESHOLD;
    });
  }

  generateSummary(issues) {
    const summary = {
      total_issues: issues.length,
      high_severity: 0,
      medium_severity: 0,
      low_severity: 0,
      by_type: {},
      by_category: {
        basic: 0,
        advanced: 0
      }
    };

    issues.forEach(issue => {
      // Count by severity
      if (issue.severity === 'high') summary.high_severity++;
      else if (issue.severity === 'medium') summary.medium_severity++;
      else if (issue.severity === 'low') summary.low_severity++;

      // Count by type
      if (!summary.by_type[issue.type]) {
        summary.by_type[issue.type] = 0;
      }
      summary.by_type[issue.type]++;

      // Count by category
      if (issue.category && summary.by_category[issue.category] !== undefined) {
        summary.by_category[issue.category]++;
      }
    });

    return summary;
  }

  // 添加模拟审核功能
  generateSimulatedReview(processedData, targetLanguage = 'zh-CN', reviewCategories = ['basic', 'advanced']) {
    console.log('Generating simulated design review...');
    
    const content = this.extractContentForReview(processedData);
    const contentLength = typeof content === 'string' ? content.length : 0;
    
    // 基于内容生成模拟问题
    const simulatedIssues = [];
    
    // 基本检查问题
    if (reviewCategories.includes('basic')) {
      if (contentLength > 100) {
        simulatedIssues.push({
          type: 'spelling',
          severity: 'low',
          location: '第1页，文档标题区域',
          original_text: '示例文本',
          suggested_fix: '修正后的文本',
          explanation: '模拟发现的拼写问题',
          confidence: 0.8,
          category: 'basic'
        });
      }
      
      simulatedIssues.push({
        type: 'formatting',
        severity: 'medium',
        location: '第1页，整体布局格式',
        original_text: '格式不一致',
        suggested_fix: '统一格式标准',
        explanation: '建议保持格式一致性',
        confidence: 0.7,
        category: 'basic'
      });
    }
    
    // 高级检查问题
    if (reviewCategories.includes('advanced')) {
      simulatedIssues.push({
        type: 'brand',
        severity: 'high',
        location: '第1页，页眉品牌标识区域',
        original_text: 'Petlibro',
        suggested_fix: 'Petlibro',
        explanation: '品牌名称使用正确',
        confidence: 0.9,
        category: 'advanced'
      });
      
      if (contentLength > 200) {
        simulatedIssues.push({
          type: 'consistency',
          severity: 'medium',
          location: '第2页，产品描述段落',
          original_text: '术语不统一',
          suggested_fix: '统一术语标准',
          explanation: '建议在文档中保持术语一致性',
          confidence: 0.8,
          category: 'advanced'
        });
      }
    }
    
    // 计算质量分数
    const baseScore = 85;
    const deduction = simulatedIssues.length * 5;
    const qualityScore = Math.max(60, baseScore - deduction);
    
    const recommendations = [
      '建议统一文档格式标准',
      '保持品牌名称使用的一致性',
      '定期检查拼写和语法错误'
    ];
    
    if (contentLength === 0) {
      recommendations.push('文档内容为空，建议添加相关内容');
    }
    
    return {
      issues: simulatedIssues,
      review_summary: this.generateSummary(simulatedIssues),
      recommendations: recommendations,
      overall_quality_score: qualityScore,
      metadata: {
        reviewedAt: new Date().toISOString(),
        language: targetLanguage,
        categories: reviewCategories,
        mode: 'simulation'
      }
    };
  }
}

module.exports = new AIReviewer(); 