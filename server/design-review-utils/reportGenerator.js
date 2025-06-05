const fs = require('fs').promises;
const path = require('path');
const xlsx = require('xlsx');
const sharp = require('sharp');

class ReportGenerator {
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