const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');
const sharp = require('sharp');

class ReportGenerator {
  // 在原文中高亮显示需要修改的地方
  highlightTextIssues(originalText, issues) {
    // 确保 originalText 是字符串
    if (!originalText) {
      return '';
    }
    
    // 如果 originalText 不是字符串，尝试转换
    if (typeof originalText !== 'string') {
      console.warn('originalText is not a string:', typeof originalText, originalText);
      try {
        originalText = String(originalText);
      } catch (e) {
        console.error('Failed to convert originalText to string:', e);
        return '无法显示文本内容';
      }
    }
    
    if (!issues || issues.length === 0) {
      return originalText;
    }

    let highlightedText = originalText;
    
    // 创建一个数组来存储所有需要替换的文本片段，按位置排序
    const replacements = [];
    
    issues.forEach((issue, index) => {
      if (issue.original_text && issue.original_text.trim()) {
        const searchText = issue.original_text.trim();
        const regex = new RegExp(this.escapeRegExp(searchText), 'gi');
        let match;
        
        while ((match = regex.exec(originalText)) !== null) {
          replacements.push({
            start: match.index,
            end: match.index + match[0].length,
            original: match[0],
            replacement: this.createHighlightHTML(match[0], issue, index),
            issueIndex: index
          });
        }
      }
    });

    // 按位置倒序排序，从后往前替换，避免位置偏移
    replacements.sort((a, b) => b.start - a.start);
    
    // 应用替换
    replacements.forEach(replacement => {
      highlightedText = 
        highlightedText.substring(0, replacement.start) + 
        replacement.replacement + 
        highlightedText.substring(replacement.end);
    });

    return highlightedText;
  }

  // 转义正则表达式特殊字符
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 创建高亮HTML
  createHighlightHTML(originalText, issue, index) {
    const severityColors = {
      high: '#ffebee',
      medium: '#fff3e0', 
      low: '#e8f5e8'
    };
    
    const borderColors = {
      high: '#f44336',
      medium: '#ff9800',
      low: '#4caf50'
    };

    return `<span class="issue-highlight issue-${index}" 
      style="
        background-color: ${severityColors[issue.severity] || '#fff3e0'};
        border-bottom: 2px solid ${borderColors[issue.severity] || '#ff9800'};
        padding: 2px 4px;
        border-radius: 3px;
        position: relative;
        cursor: help;
      " 
      title="问题 ${index + 1}: ${issue.explanation}
建议修改为: ${issue.suggested_fix}"
    >${originalText}</span>`;
  }

  async generateReport(reviewResult, processedData, outputDir, format = 'all') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `review_report_${timestamp}`;
    const reportFiles = {};

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      if (format === 'all' || format === 'excel') {
        reportFiles.excel = await this.generateExcelReport(
          reviewResult,
          processedData,
          path.join(outputDir, `${baseFileName}.xlsx`)
        );
      }

      if (format === 'all' || format === 'json') {
        reportFiles.json = await this.generateJSONReport(
          reviewResult,
          processedData,
          path.join(outputDir, `${baseFileName}.json`)
        );
      }

      if (format === 'all' || format === 'html') {
        reportFiles.html = await this.generateHTMLReport(
          reviewResult,
          processedData,
          path.join(outputDir, `${baseFileName}.html`)
        );
      }

      return reportFiles;
    } catch (error) {
      console.error('Report generation error:', error);
      throw error;
    }
  }

  async generateExcelReport(reviewResult, processedData, outputPath) {
    const workbook = xlsx.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Petlibro Design Review Report'],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Summary Statistics'],
      ['Total Issues:', reviewResult.review_summary.total_issues],
      ['High Severity:', reviewResult.review_summary.high_severity],
      ['Medium Severity:', reviewResult.review_summary.medium_severity],
      ['Low Severity:', reviewResult.review_summary.low_severity],
      ['Overall Quality Score:', reviewResult.overall_quality_score],
      [''],
      ['File Information'],
      ['File Name:', processedData.metadata.fileName],
      ['File Type:', processedData.metadata.fileType],
      ['Processed At:', processedData.metadata.processedAt]
    ];

    const summarySheet = xlsx.utils.aoa_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Issues sheet
    const issuesData = [
      ['Type', 'Severity', 'Location', 'Original Text', 'Suggested Fix', 'Explanation', 'Confidence', 'Category']
    ];

    reviewResult.issues.forEach(issue => {
      issuesData.push([
        issue.type,
        issue.severity,
        issue.location,
        issue.original_text,
        issue.suggested_fix,
        issue.explanation,
        issue.confidence,
        issue.category
      ]);
    });

    const issuesSheet = xlsx.utils.aoa_to_sheet(issuesData);
    xlsx.utils.book_append_sheet(workbook, issuesSheet, 'Issues');

    // Recommendations sheet
    const recommendationsData = [
      ['Recommendations']
    ];

    reviewResult.recommendations.forEach((rec, index) => {
      recommendationsData.push([`${index + 1}. ${rec}`]);
    });

    const recommendationsSheet = xlsx.utils.aoa_to_sheet(recommendationsData);
    xlsx.utils.book_append_sheet(workbook, recommendationsSheet, 'Recommendations');

    // Original Text with Issue Locations sheet
    if (processedData.content) {
      const originalTextData = [
        ['原文内容与问题标注'],
        [''],
        ['说明：以下原文中标注了所有发现的问题位置和修改建议'],
        [''],
        ['原文内容：'],
        [processedData.content],
        [''],
        ['问题详细对照：']
      ];

      // 添加问题详细信息，包含在原文中的位置
      reviewResult.issues.forEach((issue, index) => {
        originalTextData.push([
          `问题 ${index + 1}:`,
          `类型: ${issue.type}`,
          `严重性: ${issue.severity}`,
          `位置: ${issue.location}`,
          `原文: "${issue.original_text}"`,
          `建议修改为: "${issue.suggested_fix}"`,
          `说明: ${issue.explanation}`
        ]);
        originalTextData.push(['']); // 空行分隔
      });

      const originalTextSheet = xlsx.utils.aoa_to_sheet(originalTextData);
      
      // 设置列宽
      const range = xlsx.utils.decode_range(originalTextSheet['!ref']);
      originalTextSheet['!cols'] = [];
      for (let i = 0; i <= range.e.c; i++) {
        originalTextSheet['!cols'].push({ wch: 20 });
      }
      // 设置原文列更宽
      if (originalTextSheet['!cols'][0]) originalTextSheet['!cols'][0].wch = 80;

      xlsx.utils.book_append_sheet(workbook, originalTextSheet, 'Original Text');
    }

    // Write file
    xlsx.writeFile(workbook, outputPath);
    console.log(`Excel report generated: ${outputPath}`);
    
    return outputPath;
  }

  async generateJSONReport(reviewResult, processedData, outputPath) {
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        fileInfo: processedData.metadata
      },
      reviewResult,
      processedData: {
        type: processedData.type,
        content: processedData.content,
        extractedText: processedData.extractedText
      }
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`JSON report generated: ${outputPath}`);
    
    return outputPath;
  }

  async generateHTMLReport(reviewResult, processedData, outputPath) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Petlibro Design Review Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .summary-card {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e0e0e0;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 18px;
        }
        .summary-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #3498db;
        }
        .severity-high { color: #e74c3c !important; }
        .severity-medium { color: #f39c12 !important; }
        .severity-low { color: #27ae60 !important; }
        .issues-section {
            margin-bottom: 40px;
        }
        .issue {
            background-color: #f8f9fa;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        .issue.high { border-left-color: #e74c3c; }
        .issue.medium { border-left-color: #f39c12; }
        .issue.low { border-left-color: #27ae60; }
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .issue-type {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
        }
        .issue-severity {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            color: white;
        }
        .severity-badge-high { background-color: #e74c3c; }
        .severity-badge-medium { background-color: #f39c12; }
        .severity-badge-low { background-color: #27ae60; }
        .issue-content {
            margin-top: 15px;
        }
        .issue-field {
            margin-bottom: 10px;
        }
        .field-label {
            font-weight: bold;
            color: #555;
        }
        .recommendations {
            background-color: #e8f4f8;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 40px;
        }
        .recommendations h2 {
            color: #2980b9;
            margin-top: 0;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
        .original-text-section {
            margin-bottom: 40px;
            background-color: #fafafa;
            padding: 25px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .original-text-content {
            background-color: white;
            padding: 20px;
            border-radius: 6px;
            border: 1px solid #ddd;
            font-family: 'Courier New', monospace;
            line-height: 1.8;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 600px;
            overflow-y: auto;
        }
        .issue-highlight {
            transition: all 0.2s ease;
        }
        .issue-highlight:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10;
        }
        .legend {
            margin-bottom: 15px;
            padding: 15px;
            background-color: #f0f0f0;
            border-radius: 6px;
        }
        .legend-item {
            display: inline-block;
            margin-right: 20px;
            margin-bottom: 5px;
        }
        .legend-color {
            display: inline-block;
            width: 20px;
            height: 15px;
            border-radius: 3px;
            margin-right: 8px;
            vertical-align: middle;
            border: 1px solid #ccc;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Petlibro Design Review Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p><strong>File:</strong> ${processedData.metadata.fileName}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Issues</h3>
                <div class="value">${reviewResult.review_summary.total_issues}</div>
            </div>
            <div class="summary-card">
                <h3>High Severity</h3>
                <div class="value severity-high">${reviewResult.review_summary.high_severity}</div>
            </div>
            <div class="summary-card">
                <h3>Medium Severity</h3>
                <div class="value severity-medium">${reviewResult.review_summary.medium_severity}</div>
            </div>
            <div class="summary-card">
                <h3>Low Severity</h3>
                <div class="value severity-low">${reviewResult.review_summary.low_severity}</div>
            </div>
            <div class="summary-card">
                <h3>Quality Score</h3>
                <div class="value">${reviewResult.overall_quality_score}%</div>
            </div>
        </div>

        ${reviewResult.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            <ul>
                ${reviewResult.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${processedData.content ? `
        <div class="original-text-section">
            <h2>📄 原文内容与修改标注</h2>
            
            ${(() => {
              const content = processedData.content;
              const isImageBased = content && content.includes('IMAGE_BASED_PDF');
              
                             if (isImageBased) {
                 return `
                   <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin-bottom: 20px;">
                     <h4 style="margin: 0 0 10px 0; color: #1976d2;">📸 图像类型PDF检测</h4>
                     <p style="margin: 0; color: #1565c0;">
                       您上传的PDF文件是图像格式（如扫描件），无法提取可标注的文本内容。<br>
                       不过我们的AI已经通过<strong>GPT-4o视觉分析</strong>对图像内容进行了审核，并提供了详细的位置描述。
                     </p>
                   </div>
                   
                   <div style="background-color: #fff3e0; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                     <h4 style="margin: 0 0 10px 0; color: #f57c00;">🔍 图像分析说明</h4>
                     <p style="margin: 0; color: #ef6c00; font-size: 14px;">
                       • AI通过视觉识别分析了每一页的内容<br>
                       • 在"问题详情"中会标明具体的页面和区域位置<br>
                       • 位置描述格式：页码 + 区域描述（如："第2页，标题部分"）
                     </p>
                   </div>
                   
                   <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; text-align: center;">
                     <p style="margin: 0; color: #666;">
                       💡 <strong>提示：</strong>如需精确文本标注，建议上传包含可选择文本的PDF文件
                     </p>
                   </div>
                 `;
              } else {
                return `
                  <p style="color: #666; margin-bottom: 15px;">鼠标悬停在高亮文本上可查看具体修改建议</p>
                  
                  <div class="legend">
                      <h4 style="margin: 0 0 10px 0;">标注说明：</h4>
                      <div class="legend-item">
                          <span class="legend-color" style="background-color: #ffebee; border-color: #f44336;"></span>
                          <span>高严重性问题</span>
                      </div>
                      <div class="legend-item">
                          <span class="legend-color" style="background-color: #fff3e0; border-color: #ff9800;"></span>
                          <span>中严重性问题</span>
                      </div>
                      <div class="legend-item">
                          <span class="legend-color" style="background-color: #e8f5e8; border-color: #4caf50;"></span>
                          <span>低严重性问题</span>
                      </div>
                  </div>
                  
                  <div class="original-text-content">
                    ${this.highlightTextIssues(content, reviewResult.issues)}
                  </div>
                `;
              }
            })()}
        </div>
        ` : ''}

        <div class="issues-section">
            <h2>📋 Issues Detail</h2>
            ${reviewResult.issues.length === 0 ? 
                '<p style="text-align: center; color: #27ae60; font-size: 18px;">🎉 No issues found! The document quality is excellent.</p>' :
                reviewResult.issues.map((issue, index) => `
                <div class="issue ${issue.severity}">
                    <div class="issue-header">
                        <span class="issue-type">${issue.type}</span>
                        <span class="issue-severity severity-badge-${issue.severity}">${issue.severity.toUpperCase()}</span>
                    </div>
                    <div class="issue-content">
                        <div class="issue-field">
                            <span class="field-label">Location:</span> ${issue.location}
                        </div>
                        <div class="issue-field">
                            <span class="field-label">Original Text:</span> <code>${issue.original_text}</code>
                        </div>
                        <div class="issue-field">
                            <span class="field-label">Suggested Fix:</span> <code style="background-color: #d4edda; color: #155724;">${issue.suggested_fix}</code>
                        </div>
                        <div class="issue-field">
                            <span class="field-label">Explanation:</span> ${issue.explanation}
                        </div>
                        <div class="issue-field">
                            <span class="field-label">Confidence:</span> ${(issue.confidence * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>
                `).join('')
            }
        </div>

        <div class="footer">
            <p>Petlibro Design Review AI - Improving design quality through intelligent analysis</p>
        </div>
    </div>
</body>
</html>
    `;

    await fs.writeFile(outputPath, html);
    console.log(`HTML report generated: ${outputPath}`);
    
    return outputPath;
  }

  async createIssueHighlightOverlay(base64Image, issues) {
    // This is a placeholder for image annotation functionality
    // In a real implementation, you would use canvas or sharp to draw on the image
    return base64Image;
  }
}

module.exports = new ReportGenerator(); 