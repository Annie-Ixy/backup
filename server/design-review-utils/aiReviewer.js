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

  async reviewContent(processedData, targetLanguage, reviewCategories = ['basic', 'advanced']) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Validate target language
    targetLanguage = this.validateTargetLanguage(targetLanguage);

    try {
      const content = this.extractContentForReview(processedData);
      
      // Check if this is an image-based PDF
      if (content && typeof content === 'object' && content.isImageBased) {
        console.log('Processing image-based PDF with vision analysis...');
        return await this.reviewImageBasedPDF(content.pageImages, targetLanguage, reviewCategories);
      }
      
      // Check if this is a single image with poor OCR results
      if (processedData.type === 'image' && this.shouldUseVisionAnalysis(processedData)) {
        console.log('OCR confidence too low, switching to vision analysis...');
        return await this.reviewSingleImageWithVision(processedData, targetLanguage, reviewCategories);
      }
      
      const prompt = this.buildReviewPrompt(content, targetLanguage, reviewCategories);

      console.log('Sending content to OpenAI for review...');
      console.log('Using model:', config.OPENAI_MODEL);
      
      const response = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(targetLanguage) // Always use English for analysis
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
      
      // Filter out false positives
      if (reviewResult.issues) {
        // Get the original content for validation
        const originalContent = this.extractContentForReview(processedData);
        const contentText = typeof originalContent === 'string' ? originalContent : '';
        
        const originalIssueCount = reviewResult.issues.length;
        console.log(`\n=== AI Result Validation ===`);
        console.log(`Original issues count: ${originalIssueCount}`);
        
        // Temporarily disable filtering to see the raw AI output
        /*
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
        */
        
        const filteredIssueCount = reviewResult.issues.length;
        const filteredCount = originalIssueCount - filteredIssueCount;
        console.log(`Filtered issues count: ${filteredIssueCount}`);
        console.log(`Issues filtered out: ${filteredCount} (FILTERING DISABLED)`);
        console.log(`=== End AI Result Validation ===\n`);
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

      return {
        issues: reviewResult.issues || [],
        review_summary: this.generateSummary(reviewResult.issues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguage,
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

  getSystemPrompt(targetLanguage) {
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
- Be cautious about reporting partial words or OCR artifacts. However, if a word seems like a clear misspelling of a common English word (e.g., 'Pres' instead of 'Press'), you should report it.
- Verify that each reported issue actually appears in the original content before reporting it
- If you're unsure about a potential issue, do not report it

IMPORTANT: 
- Analysis language: English (always)
- Target language: ${config.SUPPORTED_LANGUAGES[targetLanguage] || 'Unknown'}
- Please respond in English regardless of the target language

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
    console.log('- Target language:', targetLanguage, `(${config.SUPPORTED_LANGUAGES[targetLanguage] || 'Unknown'})`);
    console.log('- Review categories:', reviewCategories);
    console.log('- Analysis language: English (always)');

    return `Please review the following content for Petlibro product documentation.
Focus on: ${selectedCategories}

Language Information:
- Analysis language: English (always)
- Target language: ${config.SUPPORTED_LANGUAGES[targetLanguage] || 'Unknown'}
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

  async reviewImageBasedPDF(pageImages, targetLanguage, reviewCategories) {
    console.log(`Analyzing ${pageImages.length} PDF pages with GPT-4o vision...`);
    
    try {
      // Prepare messages for vision analysis
      const messages = [
        {
          role: 'system',
          content: this.getVisionSystemPrompt('en') // Always use English for vision analysis
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
      
      // Filter out false positives for vision analysis
      if (reviewResult.issues) {
        // For vision analysis, we can't easily validate against text content
        // but we can still filter out obvious false positives
        const originalIssueCount = reviewResult.issues.length;
        console.log(`\n=== Vision Analysis Result Validation ===`);
        console.log(`Original issues count: ${originalIssueCount}`);
        
        reviewResult.issues = reviewResult.issues.filter(issue => {
          // Apply false positive detection
          const isFalsePositive = this.isFalsePositive(issue.original_text, issue.type);
          if (isFalsePositive) {
            console.log(`Filtering out vision analysis false positive: "${issue.original_text}"`);
            return false;
          }
          
          // Require reasonable confidence for vision analysis
          return (issue.confidence || 0) >= 75;
        });
        
        const filteredIssueCount = reviewResult.issues.length;
        const filteredCount = originalIssueCount - filteredIssueCount;
        console.log(`Filtered issues count: ${filteredIssueCount}`);
        console.log(`Issues filtered out: ${filteredCount}`);
        console.log(`=== End Vision Analysis Result Validation ===\n`);
      }
      
      return {
        issues: reviewResult.issues || [],
        review_summary: this.generateSummary(reviewResult.issues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguage,
          categories: reviewCategories,
          analysisType: 'vision',
          pagesAnalyzed: pageImages.length,
          analysisLanguage: 'en' // Indicate that analysis was done in English
        }
      };
    } catch (error) {
      console.error('Vision analysis error:', error);
      throw error;
    }
  }

  getVisionSystemPrompt(targetLanguage) {
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
- Be cautious about reporting partial words or OCR artifacts. However, if a word seems like a clear and obvious misspelling of a common English word (e.g., 'Pres' instead of 'Press', 'wid' instead of 'with'), you MUST report it.
- Verify that each reported issue actually appears in the image before reporting it
- If you're unsure about a potential issue, do not report it

CRITICAL REQUIREMENT FOR LOCATION FIELD:
- Always specify the exact page number and detailed area description
- Format: "Page X, [specific area description]"
- Examples: "Page 1, title area", "Page 2, left side product description", "Page 3, footer contact information"
- Be as specific as possible about the location within each page

IMPORTANT: 
- Analysis language: English (always)
- Target language: ${config.SUPPORTED_LANGUAGES[targetLanguage] || 'Unknown'}
- Please respond in English regardless of the target language

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
    if (!originalText) {
      console.log(`Skipping validation: empty original_text`);
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
    
    // For spelling issues, be extra careful
    if (issue.type === 'spelling') {
      // Check if it's a common OCR artifact or false positive
      if (isFalsePositive) {
        console.log(`Filtering out false positive spelling issue: "${originalText}"`);
        return false;
      }
      
      // For spelling issues, require higher confidence and existence in content
      const isValid = existsInContent && (issue.confidence || 0) >= 75; // Lowered threshold from 85 to 75
      if (!isValid) {
        console.log(`Filtering out spelling issue: "${originalText}" - exists: ${existsInContent}, confidence: ${issue.confidence}`);
      }
      return isValid;
    }
    
    // For other issue types, require existence in content and reasonable confidence
    const isValid = existsInContent && (issue.confidence || 0) >= 70;
    if (!isValid) {
      console.log(`Filtering out issue: "${originalText}" - exists: ${existsInContent}, confidence: ${issue.confidence}`);
    }
    return isValid;
  }

  // Helper method to identify common false positives
  isFalsePositive(text, issueType) {
    if (!text) return false;

    const lowerCaseText = text.toLowerCase();
    
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
    // Check if OCR confidence is available
    if (processedData.ocrConfidence !== undefined) {
      // Use vision analysis if OCR confidence is below 70% or text is too short
      const lowConfidence = processedData.ocrConfidence < 70;
      const shortText = (processedData.extractedText || '').trim().length < 100;
      
      console.log(`OCR Confidence: ${processedData.ocrConfidence}%, Text length: ${(processedData.extractedText || '').length}`);
      console.log(`Low confidence: ${lowConfidence}, Short text: ${shortText}`);
      
      return lowConfidence || shortText;
    }
    
    // If no OCR confidence data, check if extracted text is empty or very short
    const extractedText = processedData.extractedText || '';
    const isEmptyOrShort = extractedText.trim().length === 0 || extractedText.trim().length < 50;
    
    console.log(`No OCR confidence data. Extracted text length: ${extractedText.length}`);
    console.log(`Empty or short text: ${isEmptyOrShort}`);
    
    return isEmptyOrShort;
  }

  // New method to review single image with vision analysis
  async reviewSingleImageWithVision(processedData, targetLanguage, reviewCategories) {
    console.log('Analyzing single image with GPT-4o vision...');
    
    try {
      // Prepare the image for vision analysis
      const imageUrl = `data:image/${processedData.metadata.format};base64,${processedData.data}`;
      
      const messages = [
        {
          role: 'system',
          content: this.getVisionSystemPrompt('en')
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please analyze this image from a Petlibro product documentation. Review for spelling, grammar, terminology consistency, brand accuracy, and overall quality. Focus on: ${reviewCategories.join(', ')}`
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

      console.log('Sending image to GPT-4o for vision analysis...');
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
      
      // Filter out false positives for single image vision analysis
      if (reviewResult.issues) {
        // For vision analysis, we can't easily validate against text content
        // but we can still filter out obvious false positives
        const originalIssueCount = reviewResult.issues.length;
        console.log(`\n=== Vision Analysis Result Validation ===`);
        console.log(`Original issues count: ${originalIssueCount}`);
        
        // Temporarily disable filtering to see the raw AI output
        /*
        reviewResult.issues = reviewResult.issues.filter(issue => {
          // Apply false positive detection
          const isFalsePositive = this.isFalsePositive(issue.original_text, issue.type);
          if (isFalsePositive) {
            console.log(`Filtering out single image vision analysis false positive: "${issue.original_text}"`);
            return false;
          }
          
          // Require reasonable confidence for vision analysis
          return (issue.confidence || 0) >= 75;
        });
        */
        
        const filteredIssueCount = reviewResult.issues.length;
        const filteredCount = originalIssueCount - filteredIssueCount;
        console.log(`Filtered issues count: ${filteredIssueCount}`);
        console.log(`Issues filtered out: ${filteredCount} (FILTERING DISABLED)`);
        console.log(`=== End Vision Analysis Result Validation ===\n`);
      }
      
      return {
        issues: reviewResult.issues || [],
        review_summary: this.generateSummary(reviewResult.issues),
        recommendations: reviewResult.recommendations || [],
        overall_quality_score: reviewResult.overall_quality_score || 0,
        metadata: {
          reviewedAt: new Date().toISOString(),
          language: targetLanguage,
          categories: reviewCategories,
          analysisType: 'vision',
          originalOcrConfidence: processedData.ocrConfidence,
          analysisLanguage: 'en'
        }
      };
    } catch (error) {
      console.error('Vision analysis error:', error);
      throw error;
    }
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