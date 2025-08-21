const { createOpenAIInstance } = require('../utils/openaiConfig');
const config = require('../design-review-config');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const Tesseract = require('tesseract.js');

class AIReviewer {
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = createOpenAIInstance();
    }
  }

  // Validate target language
  validateTargetLanguage(targetLanguage) {
    if (!targetLanguage) {
      console.warn('Target language is not provided, using default: zh-CN');
      return 'zh-CN';
    }
    
    if (!config.SUPPORTED_LANGUAGES[targetLanguage]) {
      console.warn(`Unsupported target language: ${targetLanguage}, using default: zh-CN`);
      return 'zh-CN';
    }
    
    return targetLanguage;
  }

  async reviewContent(processedData, targetLanguages, reviewCategories = ['basic', 'advanced'], progressCallback = null) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Handle both single language and multiple languages
    const languageArray = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
    
    // Validate target languages
    const validatedLanguages = languageArray.map(lang => this.validateTargetLanguage(lang));

    // Report initial progress
    if (progressCallback) {
      progressCallback({ stage: 'starting', progress: 0, message: '开始内容分析...' });
    }

    try {
      const content = this.extractContentForReview(processedData);
      
      // Report content extraction progress
      if (progressCallback) {
        progressCallback({ stage: 'extracting', progress: 10, message: '提取文件内容...' });
      }
      
      // Check if this is an image-based PDF
      if (content && typeof content === 'object' && content.isImageBased) {
        console.log('Processing image-based PDF with vision analysis...');
        if (progressCallback) {
          progressCallback({ stage: 'analyzing', progress: 20, message: '使用AI视觉分析PDF页面...' });
        }
        return await this.reviewImageBasedPDF(content.pageImages, validatedLanguages, reviewCategories, progressCallback);
      }
      
      // Check if this is a single image with poor OCR results
      if (processedData.type === 'image' && this.shouldUseVisionAnalysis(processedData)) {
        console.log('OCR confidence too low, switching to vision analysis...');
        if (progressCallback) {
          progressCallback({ stage: 'analyzing', progress: 20, message: '使用AI视觉分析图像内容...' });
        }
        return await this.reviewSingleImageWithVision(processedData, validatedLanguages, reviewCategories, progressCallback);
      }
      
      const prompt = this.buildReviewPrompt(content, validatedLanguages, reviewCategories);

      console.log('Sending content to OpenAI for review...');
      console.log('Using model:', config.OPENAI_MODEL);
      
      // Report AI analysis progress
      if (progressCallback) {
        progressCallback({ stage: 'ai_analysis', progress: 30, message: '正在进行AI内容分析...' });
      }
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(validatedLanguages) // Always use English for analysis
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

      // Report parsing progress
      if (progressCallback) {
        progressCallback({ stage: 'parsing', progress: 70, message: '解析AI分析结果...' });
      }

      const reviewResult = this.parseAIResponse(response.choices[0].message.content);
      
      // Filter out false positives
      if (reviewResult.issues) {
        // Get the original content for validation
        const originalContent = this.extractContentForReview(processedData);
        const contentText = typeof originalContent === 'string' ? originalContent : '';
        
        const originalIssueCount = reviewResult.issues.length;
        console.log(`\n=== AI Result Validation ===`);
        console.log(`Original issues count: ${originalIssueCount}`);
        
        reviewResult.issues = reviewResult.issues.filter(issue => {
          // First apply OCR-specific validation if applicable
          const ocrValid = this.validateOCRResult(issue);
          if (!ocrValid) {
            console.log(`Filtering out OCR issue: "${issue.original_text}" (confidence: ${issue.confidence})`);
            return false;
          }
          
          // Then apply AI result validation
          const aiValid = this.validateAIResult(issue, contentText);
          if (!aiValid) {
            console.log(`Filtering out AI issue: "${issue.original_text}" - not found in original content or false positive`);
            return false;
          }
          
          return true;
        });
        
        const filteredIssueCount = reviewResult.issues.length;
        const filteredCount = originalIssueCount - filteredIssueCount;
        console.log(`Filtered issues count: ${filteredIssueCount}`);
        console.log(`Issues filtered out: ${filteredCount}`);
        console.log(`=== End AI Result Validation ===\n`);
        
        // Report validation progress
        if (progressCallback) {
          progressCallback({ stage: 'validating', progress: 85, message: '验证分析结果...' });
        }
      }
      
      // === 精确位置补充 begin ===
      function addPreciseLocationToIssues(issues, fullText) {
        if (!Array.isArray(issues) || !fullText) return issues;
        const lines = fullText.split('\n');
        return issues.map(issue => {
          const searchText = (issue.original_text || '').trim();
          if (!searchText) return issue;
          const startIdx = fullText.indexOf(searchText);
          if (startIdx === -1) return issue;
          // 计算行号
          let charCount = 0;
          let lineNumber = 1;
          for (let i = 0; i < lines.length; i++) {
            if (charCount + lines[i].length >= startIdx) {
              lineNumber = i + 1;
              break;
            }
            charCount += lines[i].length + 1; // +1 for '\n'
          }
          return {
            ...issue,
            precise_location: {
              line: lineNumber,
              start: startIdx,
              end: startIdx + searchText.length,
              context: lines[lineNumber - 1]
            }
          };
        });
      }
      if (processedData.type === 'document' && processedData.content && reviewResult.issues) {
        reviewResult.issues = addPreciseLocationToIssues(reviewResult.issues, processedData.content);
      }
      // === 精确位置补充 end ===

      // Generate summary after filtering to ensure consistency
      const finalIssues = reviewResult.issues || [];
      
      // Report completion progress
      if (progressCallback) {
        progressCallback({ stage: 'completing', progress: 100, message: '分析完成！' });
      }
      
      return {
        issues: finalIssues,
        review_summary: this.generateSummary(finalIssues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          languages: validatedLanguages,
          categories: reviewCategories,
          analysisType: 'text',
          analysisLanguage: 'en' // Indicate that analysis was done in English
        }
      };
    } catch (error) {
      console.error('Review error:', error);
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

  getSystemPrompt(targetLanguages) {
    const languageArray = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
    const languageNames = languageArray.map(lang => config.SUPPORTED_LANGUAGES[lang] || lang).join(', ');
    
    return `You are a professional content reviewer specializing in product design documentation for Petlibro pet products. 
Your task is to review content for accuracy, consistency, and quality. 
Focus on:
1. Spelling and grammar errors
2. Terminology consistency
3. Brand name accuracy (Petlibro)
4. Technical accuracy
5. Formatting consistency
6. Contextual appropriateness

CRITICAL REQUIREMENTS:
- ONLY report issues that actually exist in the provided content
- DO NOT generate or invent spelling errors that are not present in the text
- DO NOT report common words like "the", "and", "is", "are" as spelling errors
- DO NOT report hyphenated words at line breaks as spelling or formatting errors (e.g., "instal-lation", "interfer-ence", "encour-aged" are NORMAL line-breaking hyphenation, NOT errors)
- Be cautious about reporting partial words or OCR artifacts. However, if a word seems like a clear misspelling of a common English word (e.g., 'Pres' instead of 'Press'), you should report it.
- Verify that each reported issue actually appears in the original content before reporting it
- If you're unsure about a potential issue, do not report it

HYPHENATION GUIDELINES:
- Hyphenated line breaks are NORMAL and CORRECT in professional documentation
- Words like "instal-lation", "interfer-ence", "encour-aged", "connec-tion", "informa-tion" at line breaks are proper formatting
- DO NOT suggest removing hyphens from line-broken words
- Only report hyphenation issues if hyphens appear incorrectly within a single line

MULTI-LANGUAGE SUPPORT:
- The content may contain multiple languages: ${languageNames}
- Review each language according to its specific grammar and spelling rules
- Pay attention to language-specific terminology and conventions
- Identify which language each issue belongs to in your analysis
- Support mixed-language content where multiple languages appear in the same document
- For each language, apply appropriate linguistic rules:
  * English: Standard grammar, spelling, and punctuation rules
  * German (Deutsch): Capitalization of nouns, compound words, umlauts (ä, ö, ü, ß)
  * French (Français): Accents (é, è, à, ç), gender agreement, liaison rules
  * Spanish (Español): Accents (á, é, í, ó, ú, ñ), gender agreement, inverted punctuation
  * Italian (Italiano): Accents (à, è, é, ì, ò, ù), double consonants, gender agreement
  * Dutch (Nederlands): Compound words, ij digraph, specific spelling patterns
  * Polish (Polski): Diacritical marks (ą, ć, ę, ł, ń, ó, ś, ź, ż), complex grammar
  * Swedish (Svenska): Å, ä, ö characters, compound words, definite article suffixes
  * Japanese (日本語): Hiragana, katakana, kanji usage, particle usage, honorifics

IMPORTANT: 
- Analysis language: English (always)
- Target languages: ${languageNames}
- Please respond in English regardless of the target languages
- When reporting issues, specify which language the issue belongs to
- Be culturally sensitive and aware of language-specific conventions

Return your response in JSON format with the following structure:
{
  "issues": [
    {
      "type": "spelling|grammar|consistency|terminology|brand|technical|formatting",
      "severity": "high|medium|low",
      "location": "specific location in text",
      "original_text": "the problematic text (must exist in content)",
      "suggested_fix": "corrected text",
      "explanation": "why this is an issue",
      "confidence": 0.0-1.0,
      "category": "basic|advanced",
      "language": "language code (en, de, fr, es, it, nl, pl, sv, ja, zh-CN) of the issue"
    }
  ],
  "recommendations": ["general recommendations for improvement"],
  "overall_quality_score": 0-100,
  "language_analysis": {
    "detected_languages": ["list of detected language codes"],
    "primary_language": "most common language in the content",
    "mixed_language_content": true/false
  }
}`;
  }

  buildReviewPrompt(content, targetLanguages, reviewCategories) {
    const languageArray = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
    const languageNames = languageArray.map(lang => config.SUPPORTED_LANGUAGES[lang] || lang).join(', ');
    
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
    console.log('- Target languages:', languageNames);
    console.log('- Review categories:', reviewCategories);
    console.log('- Analysis language: English (always)');

    return `Please review the following content for Petlibro product documentation.
Focus on: ${selectedCategories}

Language Information:
- Analysis language: English (always)
- Target languages: ${languageNames}
- The content may contain multiple languages - please review each according to its specific rules
- Please provide analysis and corrections in English

Content to review:
${content}

Please identify all issues and provide specific corrections in English.`;
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

  async reviewImageBasedPDF(pageImages, targetLanguages, reviewCategories, progressCallback = null) {
    console.log(`分析包含${pageImages.length}页的PDF，使用分批处理避免超时...`);
    
    // Report initial progress for PDF processing
    if (progressCallback) {
      progressCallback({ stage: 'pdf_processing', progress: 25, message: `开始处理PDF文档，共${pageImages.length}页...` });
    }
    
    try {
      // 如果页面太多，使用分批处理
      const maxPagesPerBatch = 5; // 每批最多处理5页
      let allResults = {
        issues: [],
        recommendations: [],
        overall_quality_score: 0
      };
      
      if (pageImages.length > maxPagesPerBatch) {
        console.log(`页面数量(${pageImages.length})超过批次限制，使用分批处理模式...`);
        
        const batches = [];
        for (let i = 0; i < pageImages.length; i += maxPagesPerBatch) {
          batches.push(pageImages.slice(i, i + maxPagesPerBatch));
        }
        
        console.log(`将分为${batches.length}个批次处理`);
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`处理第${batchIndex + 1}/${batches.length}批次，包含${batch.length}页...`);
          
          // Report batch progress
          if (progressCallback) {
            const batchProgress = 25 + Math.round((batchIndex / batches.length) * 60);
            progressCallback({ 
              stage: 'batch_processing', 
              progress: batchProgress, 
              message: `处理第${batchIndex + 1}/${batches.length}批次，包含${batch.length}页...` 
            });
          }
          
          try {
            const batchResult = await this.processBatchPages(batch, targetLanguages, reviewCategories, batchIndex + 1);
            
            // 合并结果
            allResults.issues.push(...(batchResult.issues || []));
            allResults.recommendations.push(...(batchResult.recommendations || []));
            allResults.overall_quality_score = Math.min(allResults.overall_quality_score + batchResult.overall_quality_score, 100);
            
            console.log(`批次${batchIndex + 1}完成，发现${batchResult.issues?.length || 0}个问题`);
            
            // 批次间增加短暂延迟，避免API限流
            if (batchIndex < batches.length - 1) {
              console.log('等待2秒后处理下一批次...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (batchError) {
            console.error(`批次${batchIndex + 1}处理失败:`, batchError.message);
            allResults.recommendations.push(`第${batchIndex + 1}批次页面分析失败，可能需要手动检查这些页面的内容质量`);
          }
        }
        
        // 计算平均质量分数
        allResults.overall_quality_score = Math.round(allResults.overall_quality_score / batches.length);
        
      } else {
        // 页面数量较少，直接处理
        console.log('页面数量较少，直接进行视觉分析...');
        if (progressCallback) {
          progressCallback({ stage: 'single_batch', progress: 40, message: '直接处理所有页面...' });
        }
        const singleBatchResult = await this.processBatchPages(pageImages, targetLanguages, reviewCategories, 1);
        
        // 即使是单批次，也需要格式化结果以确保包含review_summary
        allResults.issues.push(...(singleBatchResult.issues || []));
        allResults.recommendations.push(...(singleBatchResult.recommendations || []));
        allResults.overall_quality_score = singleBatchResult.overall_quality_score || 0;
      }
      
      // Report completion for PDF processing
      if (progressCallback) {
        progressCallback({ stage: 'completing', progress: 100, message: 'PDF分析完成！' });
      }
      
      return this.formatBatchResults(allResults, targetLanguages, reviewCategories, pageImages.length);
      
    } catch (error) {
      console.error('PDF视觉分析失败:', error);
      throw error;
    }
  }

  // 处理一批页面的方法
  async processBatchPages(pageImages, targetLanguages, reviewCategories, batchNumber) {
      // Prepare messages for vision analysis
      const messages = [
        {
          role: 'system',
          content: this.getVisionSystemPrompt(targetLanguages) // Use target languages for vision analysis
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
            text: `Please analyze these ${pageImages.length} pages from a Petlibro product documentation PDF (Batch ${batchNumber}). Review for spelling, grammar, terminology consistency, brand accuracy, and overall quality. Focus on: ${reviewCategories.join(', ')}`
            },
            ...pageImages.map((page, index) => {
              // Validate base64 string
              if (!page.base64 || page.base64.length === 0) {
                console.error(`Page ${page.page} has empty base64 data`);
                return null;
              }
              
              // Clean base64 string (remove any whitespace/newlines)
              const cleanBase64 = page.base64.replace(/\s/g, '');
            console.log(`批次${batchNumber} - 页面${page.page} base64长度: ${cleanBase64.length}`);
              
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

    console.log(`发送批次${batchNumber}到GPT-4o进行视觉分析...`);
    console.log('使用模型:', config.OPENAI_MODEL);
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: messages,
        temperature: 0.3,
        max_tokens: 4000
      });

      // Debug logging
    console.log(`批次${batchNumber}视觉分析响应:`, {
        model: response.model,
        usage: response.usage,
        finish_reason: response.choices[0].finish_reason
      });
    console.log(`批次${batchNumber}原始响应:`);
      console.log(response.choices[0].message.content);
    console.log('--- 批次响应结束 ---');

      const reviewResult = this.parseAIResponse(response.choices[0].message.content);
      
    // 为多页PDF的视觉分析结果添加页面信息
      if (reviewResult.issues) {
      reviewResult.issues = reviewResult.issues.map(issue => {
        if (!issue.location || !issue.location.includes('Page')) {
          // 如果缺少页面信息，添加批次页面范围
          const pageRange = pageImages.length === 1 ? 
            `Page ${pageImages[0].page}` : 
            `Pages ${pageImages[0].page}-${pageImages[pageImages.length-1].page}`;
          issue.location = `${pageRange}, ${issue.location || 'content area'}`;
        }
        return issue;
      });
      }
      
      return {
        issues: reviewResult.issues || [],
        recommendations: reviewResult.recommendations || [],
      overall_quality_score: reviewResult.overall_quality_score || 0
    };
  }

  // 格式化分批处理的最终结果
  formatBatchResults(allResults, targetLanguages, reviewCategories, totalPages) {
    // 去重推荐建议
    const uniqueRecommendations = [...new Set(allResults.recommendations)];
    
    return {
      issues: allResults.issues,
      review_summary: this.generateSummary(allResults.issues),
      recommendations: uniqueRecommendations,
      overall_quality_score: allResults.overall_quality_score,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguages,
          categories: reviewCategories,
        analysisType: 'vision_batch_processing',
        totalPages: totalPages,
        totalIssues: allResults.issues.length,
        analysisLanguage: 'en',
        processingNote: `PDF分析采用分批处理模式，每批最多5页，总共${totalPages}页`
      }
    };
  }

  getVisionSystemPrompt(targetLanguages) {
    const languageArray = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
    const languageNames = languageArray.map(lang => config.SUPPORTED_LANGUAGES[lang] || lang).join(', ');
    
    return `You are a professional content reviewer with vision capabilities, specializing in product design documentation for Petlibro pet products. 
Your task is to analyze PDF pages visually and review content for accuracy, consistency, and quality. 
Focus on:
1. Text content: spelling, grammar, punctuation errors
2. Terminology consistency across pages
3. Brand name accuracy (Petlibro)
4. Technical accuracy of product information
5. Visual formatting consistency
6. Layout and design quality
7. Image quality and relevance

CRITICAL REQUIREMENTS:
- ONLY report issues that actually exist in the provided images
- DO NOT generate or invent spelling errors that are not visible in the text
- DO NOT report common words like "the", "and", "is", "are" as spelling errors
- DO NOT report hyphenated words at line breaks as formatting or spelling errors (e.g., "instal-lation", "interfer-ence", "encour-aged" are NORMAL line-breaking hyphenation, NOT errors)
- Be cautious about reporting partial words or OCR artifacts. However, if a word seems like a clear and obvious misspelling of a common English word (e.g., 'Pres' instead of 'Press', 'wid' instead of 'with'), you MUST report it.
- Verify that each reported issue actually appears in the image before reporting it
- If you're unsure about a potential issue, do not report it

HYPHENATION GUIDELINES:
- Hyphenated line breaks are NORMAL and CORRECT in professional documentation
- Words like "instal-lation", "interfer-ence", "encour-aged", "connec-tion", "informa-tion" at line breaks are proper formatting
- DO NOT suggest removing hyphens from line-broken words
- Only report hyphenation issues if hyphens appear incorrectly within a single line

MULTI-LANGUAGE SUPPORT:
- The content may contain multiple languages: ${languageNames}
- Review each language according to its specific grammar and spelling rules
- Pay attention to language-specific terminology and conventions
- Identify which language each issue belongs to in your analysis

CRITICAL REQUIREMENT FOR LOCATION FIELD:
- Always specify the exact page number and detailed area description
- Format: "Page X, [specific area description]"
- Examples: "Page 1, title area", "Page 2, left side product description", "Page 3, footer contact information"
- Be as specific as possible about the location within each page

IMPORTANT: 
- Analysis language: English (always)
- Target languages: ${languageNames}
- Please respond in English regardless of the target languages

Return your response in JSON format with the following structure:
{
  "issues": [
    {
      "type": "spelling|grammar|consistency|terminology|brand|technical|formatting|visual",
      "severity": "high|medium|low",
      "location": "Page X, specific area description (detailed page location)",
      "original_text": "the problematic text or description (must exist in image)",
      "suggested_fix": "corrected text or suggestion",
      "explanation": "why this is an issue",
      "confidence": 0.0-1.0,
      "category": "basic|advanced"
    }
  ],
  "recommendations": ["general recommendations for improvement"],
  "overall_quality_score": 0-100
}`;
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

  async performOCR(imagePath) {
    let preprocessedPath = null;
    try {
      // 1. Enhanced image preprocessing with better optimization for text
      preprocessedPath = imagePath + '_preprocessed.png';
      await sharp(imagePath)
        .grayscale() // Convert to grayscale
        .normalize() // Normalize the image contrast
        .modulate({
          brightness: 1.1,  // Slightly increase brightness
          contrast: 1.2    // Increase contrast
        })
        .threshold(200) // Increased threshold for better text/background separation
        .sharpen({ // Enhanced sharpening for better text clarity
          sigma: 1.2,
          m1: 1.0,
          m2: 2.0,
          x1: 2,
          y2: 10,
          y3: 15
        })
        .toFile(preprocessedPath);

      // 2. Configure Tesseract with optimized settings
      const result = await Tesseract.recognize(preprocessedPath, 'eng', {  // Changed to English only
        logger: m => console.log(m),
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?()-_°()• ',
        tessedit_pageseg_mode: '6',
        tessedit_do_invert: '0',
        language_model_penalty_non_dict_word: '0.8',
        language_model_penalty_spacing: '0.5',
        textord_heavy_nr: '1',
        preserve_interword_spaces: '1',
        tessedit_enable_dict_correction: '1',
        tessedit_enable_bigram_correction: '1',
        tessedit_write_images: '1',
        tessedit_create_hocr: '1',
        tessedit_ocr_engine_mode: '3',
        load_system_dawg: '1',
        load_freq_dawg: '1',
        tessedit_char_blacklist: '{}[]|\\'
      });

      console.log('Original OCR text:', result.data.text);
      console.log('OCR confidence:', result.data.confidence);
      console.log('Number of words detected:', result.data.words.length);
      
      // 3. Process the OCR result with better debugging
      let processedText = await this.processOCRResult(result.data);
      console.log('After processOCRResult:', processedText);
      
      // 4. Apply bullet point fixes
      processedText = this.fixBulletPoints(processedText);
      console.log('After fixBulletPoints:', processedText);

      // 5. Delete temporary file
      await fs.unlink(preprocessedPath).catch(err => {
        console.warn('Failed to delete temporary file:', err);
      });

      // 6. Return processed results with confidence score
      return {
        text: processedText,
        confidence: result.data.confidence,
        words: result.data.words.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        }))
      };
    } catch (error) {
      console.error('Enhanced OCR error:', error);
      console.error('Error details:', error.stack);
      
      // Try to clean up temporary file even if OCR failed
      if (preprocessedPath) {
        try {
          await fs.unlink(preprocessedPath);
        } catch (unlinkError) {
          console.warn('Failed to delete temporary file after error:', unlinkError);
        }
      }
      
      return {
        text: '',
        confidence: 0,
        words: []
      };
    }
  }

  // Helper method to fix bullet points
  fixBulletPoints(text) {
    if (!text) return text;

    let processed = text;

    // Fix common bullet point issues
    processed = processed
      // Fix bullet points that got split
      .replace(/([•])\s+([A-Z])/g, '$1 $2')
      // Fix missing spaces after bullet points
      .replace(/([•])([A-Za-z])/g, '$1 $2')
      // Fix multiple bullet points
      .replace(/[•]{2,}/g, '•')
      // Fix bullet points with extra characters
      .replace(/[-~+]\s*[•]/g, '•')
      .replace(/[•]\s*[-~+]/g, '•')
      // Ensure proper spacing around bullet points
      .replace(/\s*[•]\s*/g, '\n• ')
      // Remove bullet points at the end of lines
      .replace(/[•]\s*$/g, '')
      // Remove bullet points at the start of the text
      .replace(/^\s*[•]\s*/g, '');

    return processed;
  }

  // Helper method to process OCR result
  async processOCRResult(ocrData) {
    if (!ocrData || !ocrData.text) return '';
    
    let processedText = ocrData.text;
    const lines = processedText.split('\n');
    
    // Process each line
    const processedLines = lines.map((line, index) => {
      // Check if this line might be a title
      if (this.isTitleLine(line, ocrData.words, index)) {
        return this.processTitleLine(line);
      }
      
      // Check if this is a bullet point line
      if (line.includes('•') || line.match(/^\s*[-*+]\s/)) {
        return this.processBulletPointLine(line);
      }
      
      return this.processContentLine(line);
    });
    
    return processedLines.join('\n');
  }

  // Helper method to identify title lines
  isTitleLine(line, words, lineIndex) {
    if (!line || !words) return false;
    
    // Title characteristics
    const isAllCaps = line.toUpperCase() === line;
    const hasUnderline = line.includes('_') || line.includes('-');
    const isShortLine = line.length < 50;
    const wordsInLine = line.trim().split(/\s+/).length;
    
    // Find words that belong to this line
    const lineWords = words.filter(word => {
      const wordText = word.text || '';
      return line.includes(wordText);
    });
    
    // Check font size (titles usually have larger font)
    const avgHeight = lineWords.reduce((sum, word) => sum + (word.bbox ? word.bbox.height : 0), 0) / (lineWords.length || 1);
    const isLargerFont = avgHeight > 20; // Adjust threshold as needed
    
    return (isAllCaps || hasUnderline) && isShortLine && isLargerFont && wordsInLine <= 5;
  }

  // Helper method to process title lines
  processTitleLine(line) {
    if (!line) return line;
    
    // Remove common OCR artifacts from titles
    let processed = this.cleanOCRText(line);
    
    // Special handling for known title patterns
    const titlePatterns = [
      {
        pattern: /和\s*\\\s*a\s*SR\s*2\s*、\s*SAFETY\s*ONS/i,
        replacement: 'SAFETY INSTRUCTIONS'
      },
      {
        pattern: /SAFETY\s*[A-Z]*\s*ONS/i,
        replacement: 'SAFETY INSTRUCTIONS'
      },
      {
        pattern: /SAFETY\s*[A-Z]*\s*IONS/i,
        replacement: 'SAFETY INSTRUCTIONS'
      }
    ];
    
    // Apply title patterns
    for (const pattern of titlePatterns) {
      if (pattern.pattern.test(processed)) {
        processed = pattern.replacement;
        break;
      }
    }
    
    // Ensure title is in uppercase
    processed = processed.toUpperCase();
    
    return processed;
  }

  // Helper method to process content lines
  processContentLine(line) {
    if (!line) return line;
    
    console.log('processContentLine input:', line);
    
    // First clean up obvious garbage and artifacts
    let processed = this.removeGarbage(line);
    console.log('After removeGarbage:', processed);
    
    // Then clean up OCR artifacts
    processed = this.cleanOCRText(processed);
    console.log('After cleanOCRText:', processed);
    
    // Fix temperature expressions
    processed = this.fixTemperatureFormat(processed);
    console.log('After fixTemperatureFormat:', processed);
    
    // Fix known patterns
    processed = this.fixKnownPatterns(processed);
    console.log('After fixKnownPatterns:', processed);
    
    // Final normalization
    processed = this.normalizeTextFormatting(processed);
    console.log('processContentLine output:', processed);
    
    return processed;
  }

  // Helper method to process bullet point lines
  processBulletPointLine(line) {
    if (!line) return line;
    
    // First clean up obvious garbage and artifacts
    let processed = this.removeGarbage(line);
    
    // Then clean up OCR artifacts
    processed = this.cleanOCRText(processed);
    
    // Fix bullet point format
    processed = processed
      // Normalize bullet point character
      .replace(/[-*+]\s/, '• ')
      // Ensure proper spacing after bullet point
      .replace(/^(•\s*)/, '• ')
      // Remove any extra bullet points
      .replace(/[•]{2,}/, '•')
      // Fix common OCR mistakes in bullet points
      .replace(/[oO0]\s+/, '• ')
      .replace(/[\[({]/, '•');
    
    // Fix temperature expressions if present
    processed = this.fixTemperatureFormat(processed);
    
    // Fix known patterns
    processed = this.fixKnownPatterns(processed);
    
    // Final normalization
    processed = this.normalizeTextFormatting(processed);
    
    return processed;
  }

  // New method to remove garbage text and symbols
  removeGarbage(text) {
    if (!text) return text;

    console.log('removeGarbage input:', text);

    // Remove common garbage patterns
    let cleaned = text
      // Remove "和 a SR 2 、 SAFETY ONS" pattern
      .replace(/和\s*a\s*SR\s*2\s*、\s*SAFETY\s*ONS/g, '')
      // Remove "«" and "»" symbols
      .replace(/[«»]/g, '')
      // More conservative: only remove specific problematic Chinese characters, not all
      .replace(/[和\s*\\\s*a\s*SR\s*2\s*、\s*SAFETY\s*ONS]/g, '')
      // Remove vertical bars and plus signs at the end
      .replace(/\s*\|\s*\+\s*$/, '')
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Trim the result
      .trim();

    console.log('removeGarbage output:', cleaned);

    return cleaned;
  }

  // Simplified temperature format fixing
  fixTemperatureFormat(text) {
    if (!text) return text;

    let processed = text;

    // Fix the specific temperature pattern
    processed = processed
      // Fix "orabove" -> "or above"
      .replace(/\s*orabove\s*/g, ' or above ')
      // Fix degree symbol and spaces around it
      .replace(/(\d+)\s*[°º]\s*([CF])/g, '$1°$2')
      // Fix spaces around parentheses
      .replace(/\s*\(\s*(\d+°[CF])\s*\)\s*/g, ' ($1) ')
      // Ensure proper spacing around "or"
      .replace(/\s*(or)\s*/g, ' $1 ')
      // Clean up any double spaces
      .replace(/\s+/g, ' ')
      .trim();

    return processed;
  }

  // Update cleanOCRText to be more focused
  cleanOCRText(text) {
    if (!text) return text;
    
    console.log('cleanOCRText input:', text);
    
    let cleaned = text;
    
    // Basic character replacements
    const replacements = {
      '°': '°',  // Keep degree symbol
      'º': '°',  // Standardize degree symbol
      '℃': '°C', // Convert single character Celsius
      '℉': '°F', // Convert single character Fahrenheit
      '（': '(',  // Convert full-width parentheses
      '）': ')',
      '·': '',   // Remove middle dots
      '…': '',   // Remove ellipsis
      '—': '-',  // Convert em dash to hyphen
      '–': '-',  // Convert en dash to hyphen
      '"': '"',  // Convert smart quotes
      "'": "'",  // Convert smart apostrophes
      "'": "'"
    };
    
    // Apply replacements
    Object.entries(replacements).forEach(([char, replacement]) => {
      cleaned = cleaned.replace(new RegExp(char, 'g'), replacement);
    });
    
    console.log('After character replacements:', cleaned);
    
    // More conservative character filtering - only remove truly problematic characters
    // Keep more valid characters including degree symbols, bullet points, etc.
    cleaned = cleaned.replace(/[^\x20-\x7E°•]/g, ' ');
    
    console.log('After character filtering:', cleaned);
    
    // Normalize spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    console.log('cleanOCRText output:', cleaned);
    
    return cleaned;
  }

  // Update normalizeTextFormatting to be more conservative
  normalizeTextFormatting(text) {
    if (!text) return text;
    
    let normalized = text;
    
    // Basic formatting fixes
    normalized = normalized
      // Fix multiple spaces
      .replace(/\s+/g, ' ')
      // Fix space before punctuation
      .replace(/\s+([.,!?])/g, '$1')
      // Ensure space after punctuation
      .replace(/([.,!?])([^\s])/g, '$1 $2')
      // Trim the result
      .trim();
    
    return normalized;
  }

  // Add a new method to validate OCR results
  validateOCRResult(issue) {
    // Skip validation for non-OCR related issues
    if (!issue.ocr_related) return true;

    const confidenceThreshold = 90; // Minimum confidence score to accept an issue
    
    // Validate based on issue type
    switch (issue.type) {
      case 'spelling':
        // Higher threshold for spelling issues
        return issue.confidence >= confidenceThreshold + 5;
      
      case 'punctuation':
        // Stricter validation for punctuation
        if (issue.original_text.match(/[,;]\s*[,;]/)) {
          return issue.confidence >= confidenceThreshold + 10;
        }
        return issue.confidence >= confidenceThreshold;
      
      case 'terminology':
        // Check for common false positives in terminology
        if (issue.original_text.match(/^[a-z]+$/i)) { // Single word
          return false; // Don't split single words
        }
        return issue.confidence >= confidenceThreshold;
      
      default:
        return issue.confidence >= confidenceThreshold;
    }
  }

  // New method to validate AI-generated issues against original content
  validateAIResult(issue, originalContent) {
    if (!issue || !originalContent) {
      console.log(`Skipping validation: issue=${!!issue}, content=${!!originalContent}`);
      return false;
    }
    
    const originalText = (issue.original_text || '').trim();
    const suggestedFix = (issue.suggested_fix || '').trim();
    
    if (!originalText) {
      console.log(`Skipping validation: empty original_text`);
      return false;
    }
    
    // Check if original text and suggested fix are identical (no real change)
    if (originalText === suggestedFix) {
      console.log(`Filtering out issue with identical original and suggested text: "${originalText}"`);
      return false;
    }
    
    // Check if the reported text actually exists in the original content
    const existsInContent = originalContent.includes(originalText);
    
    // Additional validation for common false positives
    const isFalsePositive = this.isFalsePositive(originalText, issue.type);
    
    // Log validation details for debugging
    console.log(`Validating issue: "${originalText}" (type: ${issue.type}, confidence: ${issue.confidence})`);
    console.log(`- Exists in content: ${existsInContent}`);
    console.log(`- Is false positive: ${isFalsePositive}`);
    
    // If it's a false positive (e.g., hyphenated line break), filter it out regardless of type
      if (isFalsePositive) {
      console.log(`Filtering out false positive ${issue.type} issue: "${originalText}"`);
        return false;
      }
      
    // For spelling issues, be extra careful
    if (issue.type === 'spelling') {
      // For spelling issues, require higher confidence and existence in content
      // Handle both percentage (0-100) and decimal (0-1) confidence formats
      const confidence = (issue.confidence || 0) <= 1 ? (issue.confidence || 0) * 100 : (issue.confidence || 0);
      const isValid = existsInContent && confidence >= 75; // Lowered threshold from 85 to 75
      if (!isValid) {
        console.log(`Filtering out spelling issue: "${originalText}" - exists: ${existsInContent}, confidence: ${confidence}%`);
      }
      return isValid;
    }
    
    // For other issue types, require existence in content and reasonable confidence
    // Handle both percentage (0-100) and decimal (0-1) confidence formats
    const confidence = (issue.confidence || 0) <= 1 ? (issue.confidence || 0) * 100 : (issue.confidence || 0);
    const isValid = existsInContent && confidence >= 70;
    if (!isValid) {
      console.log(`Filtering out issue: "${originalText}" - exists: ${existsInContent}, confidence: ${confidence}%`);
    }
    return isValid;
  }

  // Helper method to identify common false positives
  isFalsePositive(text, issueType) {
    if (!text) return false;

    const lowerCaseText = text.toLowerCase();
    
    // Check for hyphenated line breaks (applies to all issue types)
    const hyphenatedWords = [
      'instal-lation', 'interfer-ence', 'encour-aged', 'connec-tion', 'informa-tion', 
      'instruc-tions', 'equip-ment', 'opera-tion', 'protec-tion', 'communi-cation',
      'receiv-ing', 'transmit-ting', 'connect-ing', 'install-ing', 'operat-ing'
    ];
    
    if (hyphenatedWords.includes(lowerCaseText)) {
      console.log(`Filtering as false positive: "${text}" (Reason: Normal hyphenated line break)`);
      return true;
    }
    
    // Common false positive patterns
    const falsePositivePatterns = [
      // Common OCR artifacts that look like spelling errors
      { pattern: /^[a-z]{1,3}$/i, reason: 'Very short word (1-3 chars)' },
      { pattern: /^[0-9]+$/, reason: 'Pure number' },
      { pattern: /^[^a-zA-Z0-9\s]+$/, reason: 'Pure symbols' },
      { pattern: /^[a-z]+[0-9]+$/i, reason: 'Word with trailing number' },
      { pattern: /^[0-9]+[a-z]+$/i, reason: 'Number with trailing word' },
      { pattern: /^[a-z]+[^a-zA-Z0-9\s]+$/i, reason: 'Word with trailing symbol' },
      { pattern: /^[^a-zA-Z0-9\s]+[a-z]+$/i, reason: 'Symbol with trailing word' },
    ];
    
    // Check against patterns
    for (const { pattern, reason } of falsePositivePatterns) {
      if (pattern.test(text)) {
        console.log(`Filtering as false positive: "${text}" (Reason: ${reason})`);
        return true;
      }
    }
    
    // Specific false positive words for spelling issues
    if (issueType === 'spelling') {
      const commonFalsePositives = [
        'teh', 'th', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'and', 
        'or', 'but', 'if', 'of', 'it', 'its', "it's", 'he', 'she', 'they', 'we', 'you', 'this', 
        'that', 'these', 'those', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'will', 
        'would', 'could', 'should', 'may', 'might', 'not', 'no', 'yes', 'up', 'down', 'out', 
        'off', 'over', 'under', 'here', 'there', 'where', 'when', 'why', 'how', 'all', 'any', 
        'each', 'every', 'some', 'many', 'much', 'few', 'first', 'second', 'third', 'last', 
        'next', 'previous', 'good', 'bad', 'big', 'small', 'high', 'low', 'new', 'old', 
        'one', 'two', 'three'
      ];
      
      if (commonFalsePositives.includes(lowerCaseText)) {
        console.log(`Filtering as false positive: "${text}" (Reason: Common word list)`);
        return true;
      }
      
      // Check for common OCR artifacts that look like spelling errors
      const ocrArtifacts = [
        { pattern: /^[a-z]{1,2}$/i, reason: 'Very short word (1-2 chars)' },
        { pattern: /^[a-z]+[0-9]$/i, reason: 'Word ending with number' },
        { pattern: /^[0-9][a-z]+$/i, reason: 'Number followed by letters' },
        { pattern: /^[a-z]+[^a-zA-Z0-9\s]$/i, reason: 'Word ending with symbol' },
        { pattern: /^[^a-zA-Z0-9\s][a-z]+$/i, reason: 'Word starting with symbol' },
      ];
      
      for (const { pattern, reason } of ocrArtifacts) {
        if (pattern.test(text)) {
          console.log(`Filtering as false positive: "${text}" (Reason: OCR artifact pattern - ${reason})`);
          return true;
        }
      }
    }
    
    return false;
  }

  // Helper method to determine if vision analysis should be used
  shouldUseVisionAnalysis(processedData) {
    // 如果明确标记使用视觉分析，直接返回true
    if (processedData.useVisionAnalysis === true) {
      console.log('图像已标记为使用视觉分析，跳过OCR结果检查');
      return true;
    }
    
    // 对于图像类型，优先使用视觉分析
    if (processedData.type === 'image') {
      console.log('检测到图像文件，强制使用AI视觉分析进行文本识别');
      return true;
    }
    
    // 保留原有的OCR置信度检查逻辑作为备用
    if (processedData.ocrConfidence !== undefined) {
      const lowConfidence = processedData.ocrConfidence < 70;
      const shortText = (processedData.extractedText || '').trim().length < 100;
      
      console.log(`OCR置信度: ${processedData.ocrConfidence}%, 文本长度: ${(processedData.extractedText || '').length}`);
      console.log(`低置信度: ${lowConfidence}, 短文本: ${shortText}`);
      
      return lowConfidence || shortText;
    }
    
    // 如果没有OCR置信度数据，检查提取的文本是否为空或很短
    const extractedText = processedData.extractedText || '';
    const isEmptyOrShort = extractedText.trim().length === 0 || extractedText.trim().length < 50;
    
    console.log(`无OCR置信度数据。提取的文本长度: ${extractedText.length}`);
    console.log(`空文本或短文本: ${isEmptyOrShort}`);
    
    return isEmptyOrShort;
  }

  // Enhanced method for two-stage vision analysis: text extraction + content review
  async reviewSingleImageWithVision(processedData, targetLanguages, reviewCategories, progressCallback = null) {
    console.log('开始使用GPT-4o视觉分析进行两阶段处理：文本提取 + 内容审查...');
    
    if (progressCallback) {
      progressCallback({ stage: 'image_analysis', progress: 25, message: '开始图像视觉分析...' });
    }
    
    try {
      // Stage 1: 文本提取
      console.log('阶段1：从图像中提取文本内容...');
      if (progressCallback) {
        progressCallback({ stage: 'text_extraction', progress: 35, message: '从图像中提取文本内容...' });
      }
      let extractedText = await this.extractTextFromImage(processedData);
      
      // 如果AI视觉分析失败，尝试备用的直接图像分析方法
      if (!extractedText || extractedText.trim().length === 0) {
        console.warn('警告：第一次AI视觉分析未能提取到文本内容，尝试备用方法...');
        if (progressCallback) {
          progressCallback({ stage: 'fallback_extraction', progress: 45, message: '使用备用方法提取文本...' });
        }
        extractedText = await this.fallbackImageAnalysis(processedData);
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        console.warn('警告：所有文本提取方法都失败了');
        return {
          issues: [],
          review_summary: '无法从图像中提取到文本内容，请确认图像中包含可读的文本。可能的原因：图像分辨率过低、文本过小、手写字体或特殊字体。',
          recommendations: [
            '请确保图像清晰，分辨率足够高',
            '确认图像中包含可读的印刷体文本',
            '如果是手写文本，请尝试提供更清晰的图像',
            '检查文本大小是否足够大，易于识别',
            '避免使用过于花哨或特殊的字体'
          ],
          overall_quality_score: 0,
          metadata: {
            reviewedAt: new Date().toISOString(),
            language: targetLanguages,
            categories: reviewCategories,
            analysisType: 'vision_text_extraction_failed',
            extractedTextLength: 0,
            analysisLanguage: 'en',
            failureReason: 'All text extraction methods failed'
          }
        };
      }
      
      console.log(`成功提取文本，长度: ${extractedText.length} 字符`);
      console.log('提取的文本内容:', extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));
      
      // Stage 2: 内容审查
      console.log('阶段2：对提取的文本进行内容质量审查...');
      if (progressCallback) {
        progressCallback({ stage: 'content_review', progress: 65, message: '对提取的文本进行质量审查...' });
      }
      const reviewResult = await this.reviewExtractedText(extractedText, targetLanguages, reviewCategories);
      
      // Report completion
      if (progressCallback) {
        progressCallback({ stage: 'completing', progress: 100, message: '图像分析完成！' });
      }
      
      return {
        ...reviewResult,
        metadata: {
          ...reviewResult.metadata,
          analysisType: 'vision_two_stage',
          extractedText: extractedText,
          extractedTextLength: extractedText.length,
          textExtractionSuccess: true
        }
      };
    } catch (error) {
      console.error('视觉分析错误:', error);
      throw error;
    }
  }

  // Stage 1: 专门的文本提取方法
  async extractTextFromImage(processedData) {
    try {
      const imageUrl = `data:image/${processedData.metadata.format};base64,${processedData.data}`;
      
      const messages = [
        {
          role: 'system',
          content: this.getTextExtractionSystemPrompt()
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请仔细分析这张图像，提取其中的所有文本内容。保持文本的原始格式和结构，包括换行、空格等。'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ];

      console.log('发送图像到GPT-4o进行文本提取...');
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: messages,
        temperature: 0.1, // 降低温度以获得更准确的文本提取
        max_tokens: 2000
      });

      const extractedText = response.choices[0].message.content.trim();
      console.log('文本提取完成，提取的字符数:', extractedText.length);
      
      return extractedText;
    } catch (error) {
      console.error('文本提取错误:', error);
      return '';
    }
  }

  // Stage 2: 对提取的文本进行内容审查
  async reviewExtractedText(extractedText, targetLanguages, reviewCategories) {
    try {
      const prompt = this.buildReviewPrompt(extractedText, targetLanguages, reviewCategories);
      
      console.log('使用提取的文本进行内容审查...');
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(targetLanguages)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      console.log('内容审查完成');
      console.log('AI审查响应:', response.choices[0].message.content.substring(0, 300) + '...');

      const reviewResult = this.parseAIResponse(response.choices[0].message.content);
      
      // Generate summary after ensuring data consistency
      const finalIssues = reviewResult.issues || [];
      return {
        issues: finalIssues,
        review_summary: this.generateSummary(finalIssues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguages,
          categories: reviewCategories,
          analysisLanguage: 'en'
        }
      };
    } catch (error) {
      console.error('内容审查错误:', error);
      throw error;
    }
  }

  // 备用的图像分析方法，使用不同的提示策略
  async fallbackImageAnalysis(processedData) {
    try {
      console.log('执行备用图像分析方法...');
      const imageUrl = `data:image/${processedData.metadata.format};base64,${processedData.data}`;
      
      const messages = [
        {
          role: 'system',
          content: this.getFallbackExtractionSystemPrompt()
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '这是一张包含文本的图像。请逐行描述你在图像中看到的所有文字内容，无论字体大小如何。即使文字很小或不太清楚，也请尽力识别。'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: messages,
        temperature: 0.0, // 最低温度确保一致性
        max_tokens: 2000
      });

      let extractedText = response.choices[0].message.content.trim();
      
      // 清理AI可能添加的解释性文字
      extractedText = this.cleanExtractedText(extractedText);
      
      console.log('备用方法提取的文本长度:', extractedText.length);
      
      return extractedText;
    } catch (error) {
      console.error('备用图像分析错误:', error);
      return '';
    }
  }

  // 清理提取的文本，移除AI可能添加的解释
  cleanExtractedText(text) {
    if (!text) return '';
    
    // 移除常见的AI解释性前缀
    const cleanPatterns = [
      /^(我看到的文字是|我可以看到|图像中的文字包括|图像中显示的文本是|文字内容如下)[:：]/i,
      /^(In this image, I can see|The text in the image says|I can read the following text)[:：]/i,
      /^(这张图片中|这个图像中|我在图像中看到|我能识别出).*?[:：]/i
    ];
    
    let cleaned = text;
    for (const pattern of cleanPatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
    
    return cleaned;
  }

  // 专门的文本提取系统提示词
  getTextExtractionSystemPrompt() {
    return `你是一个专业的文本提取AI助手。你的任务是准确地从图像中提取所有可见的文本内容。

重要要求：
1. 提取图像中的所有文本，包括标题、正文、标签、按钮文字等
2. 保持文本的原始格式和结构
3. 保留换行符、空格和缩进
4. 按照文本在图像中的阅读顺序输出
5. 如果文本有明显的层次结构（如标题、段落），请保持这种结构
6. 不要添加任何解释或注释，只输出提取的文本内容
7. 如果某些文字模糊不清，请尽量根据上下文推断，并用[?]标记不确定的部分

输出格式：
- 直接输出提取的文本内容
- 保持原始的换行和格式
- 不需要任何JSON包装或额外说明`;
  }

  // 备用文本提取的系统提示词
  getFallbackExtractionSystemPrompt() {
    return `你是一个专业的图像文字识别专家。你需要仔细观察图像中的每一个文字和符号。

关键要求：
1. 仔细扫描整个图像，不要遗漏任何文字
2. 即使文字很小、模糊或颜色较淡，也要尽力识别
3. 包括所有类型的文本：标题、正文、标签、水印、按钮、图标文字等
4. 按照从上到下、从左到右的顺序报告文字
5. 保持原始的格式和换行
6. 如果无法完全确定某个字符，请用[?]表示
7. 直接输出识别的文字，不要添加"我看到"、"文字是"等说明

输出要求：
- 只输出识别的文字内容
- 保持原始格式
- 一行一行地输出
- 不要添加任何解释或描述`;
  }

  // Add a new method to fix known patterns
  fixKnownPatterns(text) {
    if (!text) return text;

    let processed = text;

    // Fix common OCR mistakes
    processed = processed
      // Fix "SAFETY INSTRUCTIONS" variations
      .replace(/和\s*\\\s*a\s*SR\s*2\s*、\s*SAFETY\s*ONS/gi, 'SAFETY INSTRUCTIONS')
      .replace(/SAFETY\s*[A-Z]*\s*ONS/gi, 'SAFETY INSTRUCTIONS')
      .replace(/SAFETY\s*[A-Z]*\s*IONS/gi, 'SAFETY INSTRUCTIONS')
      // Fix temperature patterns
      .replace(/(\d+)\s*[°º]\s*([CF])\s*or\s*above\s*(\d+)\s*[°º]\s*([CF])/gi, '$1°$2 or above $3°$4')
      // Fix bullet points
      .replace(/^\s*[-*+]\s/, '• ')
      // Fix common spacing issues
      .replace(/\s+/g, ' ')
      .trim();

    return processed;
  }

  // 测试 OpenAI 连接
  async testOpenAIConnection() {
    if (!this.openai) {
      console.error('OpenAI client not initialized - API key missing');
      return { success: false, error: 'API key not configured' };
    }

    try {
      console.log('Testing OpenAI connection...');
      console.log('API Key:', process.env.OPENAI_API_KEY ? 'Configured' : 'Missing');
      console.log('Model:', config.OPENAI_MODEL);
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a connection test. Please respond with "Connection successful" if you can see this message.'
          }
        ],
        max_tokens: 10,
        temperature: 0
      });

      console.log('OpenAI connection test successful!');
      console.log('Response:', response.choices[0].message.content);
      
      return { 
        success: true, 
        response: response.choices[0].message.content,
        model: response.model,
        usage: response.usage
      };
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      
      // 详细错误信息
      const errorDetails = {
        success: false,
        error: error.message,
        type: error.constructor.name,
        code: error.code,
        status: error.status
      };

      if (error.code === 'ETIMEDOUT') {
        errorDetails.suggestion = '网络连接超时，请检查网络连接或稍后重试';
      } else if (error.status === 401) {
        errorDetails.suggestion = 'API 密钥无效，请检查 OPENAI_API_KEY 环境变量';
      } else if (error.status === 429) {
        errorDetails.suggestion = 'API 请求频率过高，请稍后重试';
      } else if (error.status >= 500) {
        errorDetails.suggestion = 'OpenAI 服务器错误，请稍后重试';
      }

      return errorDetails;
    }
  }
}

module.exports = new AIReviewer(); 