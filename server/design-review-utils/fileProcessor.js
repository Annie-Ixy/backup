const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const PDFParser = require('pdf2json');
const { Poppler } = require('node-poppler');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const xlsx = require('xlsx');
const mammoth = require('mammoth');

class FileProcessor {
  constructor() {
    this.supportedFormats = {
      documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
      images: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff']
    };
  }

  async processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    console.log(`Processing file: ${fileName} (${ext})`);

    try {
      if (this.supportedFormats.documents.includes(ext)) {
        return await this.processDocument(filePath, ext);
      } else if (this.supportedFormats.images.includes(ext)) {
        return await this.processImage(filePath);
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      console.error(`Error processing file ${fileName}:`, error);
      throw error;
    }
  }

  async processDocument(filePath, ext) {
    let content = '';
    let metadata = {
      fileName: path.basename(filePath),
      fileType: ext,
      processedAt: new Date().toISOString()
    };

    switch (ext) {
      case '.pdf':
        const pdfData = await fs.readFile(filePath);
        const pdfResult = await pdfParse(pdfData);
        content = pdfResult.text;
        metadata.pages = pdfResult.numpages;
        
        // Debug logging
        console.log('\n=== PDF Processing Debug ===');
        console.log('- File path:', filePath);
        console.log('- File size:', pdfData.length, 'bytes');
        console.log('- Number of pages:', pdfResult.numpages);
        console.log('- Text length:', content.length, 'characters');
        console.log('- Info:', pdfResult.info);
        console.log('- Version:', pdfResult.version);
        
        // Check if content is mostly whitespace
        const trimmedContent = content.trim();
        console.log('- Trimmed text length:', trimmedContent.length);
        
        if (trimmedContent.length < 50 && pdfResult.numpages > 0) {
          console.warn('WARNING: PDF appears to contain no extractable text!');
          console.log('This might be a scanned PDF or image-based PDF.');
          console.log('Trying alternative PDF parser (pdf2json)...');
          
          // Try pdf2json as fallback
          try {
            const pdfParser = new PDFParser();
            const pdf2jsonResult = await new Promise((resolve, reject) => {
              pdfParser.on("pdfParser_dataError", errData => reject(errData));
              pdfParser.on("pdfParser_dataReady", pdfData => {
                let extractedText = '';
                
                // Extract text from all pages
                if (pdfData && pdfData.Pages) {
                  console.log(`- pdf2json found ${pdfData.Pages.length} pages`);
                  pdfData.Pages.forEach((page, pageIndex) => {
                    if (page.Texts) {
                      page.Texts.forEach(text => {
                        if (text.R && text.R[0] && text.R[0].T) {
                          extractedText += decodeURIComponent(text.R[0].T) + ' ';
                        }
                      });
                    }
                  });
                }
                
                resolve(extractedText);
              });
              
              pdfParser.parseBuffer(pdfData);
            });
            
            console.log('- pdf2json extracted text length:', pdf2jsonResult.length);
            if (pdf2jsonResult.trim().length > trimmedContent.length) {
              content = pdf2jsonResult;
              console.log('SUCCESS: pdf2json extracted more text!');
            }
          } catch (error) {
            console.error('pdf2json also failed:', error.message);
          }
          
          // Try to extract more info
          if (pdfResult.metadata) {
            console.log('- Metadata:', pdfResult.metadata);
          }
        } else {
          console.log('- First 500 chars of content:', content.substring(0, 500));
        }
        console.log('=== End PDF Debug ===\n');
        
        // If no text extracted, convert to images for vision analysis
        if (content.trim().length === 0) {
          console.log('No text extracted. Converting PDF pages to images for GPT-4o vision analysis...');
          
          try {
            const outputDir = path.join(path.dirname(filePath), 'pdf_images_' + Date.now());
            await fs.mkdir(outputDir, { recursive: true });
            
            // Initialize node-poppler
            const poppler = new Poppler();
            const outputFile = path.join(outputDir, path.basename(filePath, '.pdf'));
            
            // Configure node-poppler options
            const options = {
              pngFile: true,
              singleFile: false // Generate separate files for each page
            };
            
            // Convert PDF to images using node-poppler
            await poppler.pdfToCairo(filePath, outputFile, options);
            
            // Get all generated images
            const imageFiles = await fs.readdir(outputDir);
            const pngFiles = imageFiles.filter(f => f.endsWith('.png')).sort();
            
            console.log(`Converted PDF to ${pngFiles.length} images`);
            
            // Store image data for vision processing
            metadata.isImageBased = true;
            metadata.pageImages = [];
            
            // Read each image and convert to base64
            for (const pngFile of pngFiles) {
              const imagePath = path.join(outputDir, pngFile);
              const pageNum = parseInt(pngFile.match(/-(\d+)\.png$/)?.[1] || '1');
              
              try {
                const imageBuffer = await fs.readFile(imagePath);
                const base64String = imageBuffer.toString('base64');
                
                // Get image dimensions
                const imageInfo = await sharp(imagePath).metadata();
                
                console.log(`Page ${pageNum} converted, base64 length: ${base64String.length}`);
                
                metadata.pageImages.push({
                  page: pageNum,
                  base64: base64String,
                  width: imageInfo.width,
                  height: imageInfo.height
                });
                
                // Clean up the temporary image file
                await fs.unlink(imagePath);
              } catch (pageError) {
                console.error(`Failed to process page ${pageNum}:`, pageError.message);
              }
            }
            
            // Clean up temporary directory
            try {
              await fs.rmdir(outputDir, { recursive: true });
            } catch (e) {
              // Ignore cleanup errors
            }
            
            if (metadata.pageImages.length > 0) {
              content = "IMAGE_BASED_PDF: This PDF contains images that need vision analysis.";
              console.log(`Successfully converted ${metadata.pageImages.length} pages to images for vision analysis`);
            } else {
              content = "ERROR: Failed to convert PDF pages to images.";
            }
          } catch (error) {
            console.error('Failed to convert PDF to images:', error);
            content = "ERROR: No text could be extracted from this PDF and image conversion failed. The PDF might be corrupted or protected.";
          }
        }
        
        // Extract images from PDF if any
        const images = await this.extractImagesFromPDF(filePath);
        if (images.length > 0) {
          metadata.images = images;
        }
        break;

      case '.doc':
      case '.docx':
        const docBuffer = await fs.readFile(filePath);
        const docResult = await mammoth.extractRawText({ buffer: docBuffer });
        content = docResult.value;
        break;

      case '.xls':
      case '.xlsx':
        const workbook = xlsx.readFile(filePath);
        const sheets = {};
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          sheets[sheetName] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        });
        
        content = JSON.stringify(sheets, null, 2);
        metadata.sheets = workbook.SheetNames;
        break;

      case '.txt':
        content = await fs.readFile(filePath, 'utf-8');
        break;

      default:
        throw new Error(`Unsupported document format: ${ext}`);
    }

    return {
      type: 'document',
      content,
      metadata,
      extractedText: this.extractStructuredText(content)
    };
  }

  async processImage(filePath) {
    const metadata = {
      fileName: path.basename(filePath),
      fileType: path.extname(filePath).toLowerCase(),
      processedAt: new Date().toISOString()
    };

    try {
      // Get image metadata
      const imageInfo = await sharp(filePath).metadata();
      metadata.dimensions = {
        width: imageInfo.width,
        height: imageInfo.height
      };
      metadata.format = imageInfo.format;

      // Convert to base64 for frontend display
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');

      // Perform OCR to extract text
      const ocrResult = await this.performOCR(filePath);

      return {
        type: 'image',
        data: base64Image,
        metadata,
        extractedText: ocrResult.text,
        ocrConfidence: ocrResult.confidence
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  async performOCR(imagePath) {
    try {
      const result = await Tesseract.recognize(imagePath, 'chi_sim+eng', {
        logger: m => console.log(m)
      });

      return {
        text: result.data.text,
        confidence: result.data.confidence
      };
    } catch (error) {
      console.error('OCR error:', error);
      return {
        text: '',
        confidence: 0
      };
    }
  }

  async extractImagesFromPDF(pdfPath) {
    // This is a simplified version - in production, you'd use a library like pdf-lib or pdf-image
    // For now, we'll return an empty array
    return [];
  }

  extractStructuredText(content) {
    // Extract structured information from text
    const lines = content.split('\n').filter(line => line.trim());
    
    return {
      totalLines: lines.length,
      totalWords: content.split(/\s+/).filter(word => word).length,
      totalCharacters: content.length,
      lines: lines.map((line, index) => ({
        lineNumber: index + 1,
        text: line.trim()
      }))
    };
  }
}

module.exports = new FileProcessor(); 