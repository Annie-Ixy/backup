import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Settings, 
  Upload, 
  Search, 
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  LogOut,
  User,
  Globe
} from 'lucide-react';
import DesignFileUpload from '../components/DesignFileUpload';
import { designReviewApiService } from '../services/designReviewApi';
import downloadFile from '../components/downloadFile.ts';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
// import { isLogin } from '../utils/index.ts';

function DesignReview() {
  const navigate = useNavigate();
  const [username] = useState(localStorage.getItem('username') || 'User');
  
  const [activeTab, setActiveTab] = useState('upload');
  const [config, setConfig] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState(['en']); // 默认选择英语
  const [selectedCategories, setSelectedCategories] = useState(['basic', 'advanced']);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processResults, setProcessResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [processingStage, setProcessingStage] = useState('');
  const [processingMessage, setProcessingMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  
  // 新增：上传进度相关状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  let isLoginIndex = 0;
  
  useEffect(() => {
    // if (isLoginIndex === 0) {
    //   isLoginIndex++;
    //   isLogin().then(res => {
    //     if (!res) {
    //       navigate('/login');
    //     }
    //   })
    // }
    loadConfig();
  }, [navigate]);

  const loadConfig = async () => {
    try {
      const configData = await designReviewApiService.getConfig();
      setConfig(configData);
    } catch (err) {
      setError('Failed to load configuration');
    }
  };

  const handleFilesSelected = async (files) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadingFiles(files);
      setError(null);
      
      const uploadedFileData = await designReviewApiService.uploadFiles(files, (progressEvent) => {
        // 计算上传进度
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
        console.log(`Upload progress: ${progress}%`);
      });
      
      // 上传完成
      setUploadProgress(100);
      
      // 追加新文件到现有文件列表，而不是替换
      setUploadedFiles(prevFiles => [...prevFiles, ...uploadedFileData]);
      
      console.log('Files uploaded successfully:', uploadedFileData);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      // 延迟重置状态，让用户看到100%完成
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadingFiles([]);
      }, 1000);
    }
  };

  const handleProcess = async () => {
    if (uploadedFiles.length === 0) return;

    // 获取未处理的文件
    const processedFileIds = processResults.map(result => result.fileId);
    const unprocessedFiles = uploadedFiles.filter(file => !processedFileIds.includes(file.id));
    
    if (unprocessedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setCurrentProcessingFile('');
    setProcessingStage('');
    setProcessingMessage('');
    setError(null);
    
    // 清空之前的结果，防止累积
    setProcessResults([]);

    try {
      // 使用实时进度更新的API
      const fileIds = unprocessedFiles.map(file => file.id);
      
      let resultsAdded = false; // 防止重复添加结果
      
      const results = await designReviewApiService.processFilesWithProgress(
        fileIds, 
        selectedLanguages, 
        selectedCategories,
        (progressData) => {
          // 处理实时进度更新
          console.log('Progress update received from SSE:', progressData);
          
          // 只有在真正收到后端进度数据时才更新UI
          if (progressData && typeof progressData === 'object') {
            console.log('Processing progress data:', progressData);
            
            // 更新总体进度 - 支持多种进度数据格式
            let newProgress = 0;
            
            if (progressData.overallProgress !== undefined) {
              newProgress = progressData.overallProgress;
              console.log('Using overallProgress:', newProgress);
            } else if (progressData.progress !== undefined) {
              // 如果是单个文件的进度，计算总体进度
              const fileIndex = progressData.fileIndex || 0;
              const totalFiles = progressData.totalFiles || fileIds.length;
              const fileProgress = progressData.progress || 0;
              newProgress = Math.round(((fileIndex / totalFiles) * 100) + (fileProgress / totalFiles));
              console.log('Calculating overall progress from file progress:', { fileIndex, totalFiles, fileProgress, newProgress });
            } else if (progressData.completedFiles !== undefined && progressData.totalFiles !== undefined) {
              // 处理轮询返回的缓存数据格式
              const completed = progressData.completedFiles || 0;
              const total = progressData.totalFiles || 1;
              newProgress = Math.round((completed / total) * 100);
              console.log('Calculating progress from completed files:', { completed, total, newProgress });
            }
            
            // 确保进度值合理
            newProgress = Math.max(0, Math.min(100, newProgress));
            setProcessingProgress(newProgress);
            console.log('Set processing progress to:', newProgress);
            
            // 更新当前处理文件信息
            if (progressData.currentFile) {
              const currentFile = unprocessedFiles.find(f => f.id === progressData.currentFile);
              if (currentFile) {
                console.log('Updating current processing file:', currentFile.originalName);
                setCurrentProcessingFile(currentFile.originalName);
              }
            }
            
            // 更新处理阶段信息
            if (progressData.stage) {
              console.log('Updating processing stage:', progressData.stage);
              setProcessingStage(progressData.stage);
            }
            
            if (progressData.message) {
              console.log('Updating processing message:', progressData.message);
              setProcessingMessage(progressData.message);
            }
            
            // 只在第一次收到完成状态时添加结果，避免重复
            if ((progressData.stage === 'all_completed' || progressData.status === 'completed') && !resultsAdded) {
              console.log('Processing completed, adding results only once');
              setCurrentProcessingFile('');
              setProcessingMessage('所有文件处理完成！');
              
              // 如果有结果数据，添加到结果中
              if (progressData.results && Array.isArray(progressData.results)) {
                console.log('Adding results from progress data:', progressData.results);
                setProcessResults(prevResults => [...prevResults, ...progressData.results]);
                setActiveTab('review');
                resultsAdded = true; // 标记已添加结果
              }
            }
          }
        }
      );
      
      // 如果通过progress callback没有添加结果，则使用函数返回的结果
      if (!resultsAdded && results && Array.isArray(results)) {
        console.log('Adding results from function return:', results);
        setProcessResults(prevResults => [...prevResults, ...results]);
        setActiveTab('review');
      }
      
      console.log('Processing function completed');
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setCurrentProcessingFile('');
      setProcessingStage('');
      setProcessingMessage('');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStageDisplayName = (stage) => {
    const stageNames = {
      'starting': '初始化',
      'extracting': '提取内容',
      'analyzing': '分析中',
      'ai_analysis': 'AI分析',
      'parsing': '解析结果',
      'validating': '验证结果',
      'completing': '完成处理',
      'file_processing': '文件处理',
      'pdf_processing': 'PDF处理',
      'batch_processing': '批量处理',
      'single_batch': '单批处理',
      'image_analysis': '图像分析',
      'text_extraction': '文本提取',
      'fallback_extraction': '备用提取',
      'content_review': '内容审查',
      'completed': '已完成',
      'error': '错误'
    };
    return stageNames[stage] || stage;
  };

  // 检查是否有未处理的文件
  const hasUnprocessedFiles = () => {
    if (uploadedFiles.length === 0) return false;
    if (processResults.length === 0) return true; // 没有任何处理结果，说明都是新文件
    
    // 检查是否有新上传的文件（在processResults中找不到对应的结果）
    const processedFileIds = processResults.map(result => result.fileId);
    return uploadedFiles.some(file => !processedFileIds.includes(file.id));
  };

  // 用于强制重新渲染文件上传组件的key
  const [uploadComponentKey, setUploadComponentKey] = useState(0);

  // 清空所有文件和结果
  const handleClearAll = () => {
    setUploadedFiles([]);
    setProcessResults([]);
    setError(null);
    setProcessingProgress(0);
    setCurrentProcessingFile('');
    setProcessingStage('');
    setProcessingMessage('');
    setUploadComponentKey(prev => prev + 1); // 强制重新渲染上传组件
  };

  const handleExport = async (format, fileId) => {
    if (!fileId) return;

    setIsExporting(true);
    setError(null);

    try {
      // 找到指定文件的处理结果
      const targetResult = processResults.find(result => result.fileId === fileId && result.success);
      
      if (!targetResult) {
        setError('找不到指定文件的处理结果');
        return;
      }

      const reportData = await designReviewApiService.generateReport(
        targetResult.fileId,
        targetResult.reviewResult,
        targetResult.processedData,
        format
      );
      
      if (reportData.success && reportData.reportFiles) {
        const fileName = format === 'excel' ? 
          Object.keys(reportData.reportFiles).find(key => key.includes('excel')) :
          Object.keys(reportData.reportFiles).find(key => key.includes('html'));
        
        if (fileName && reportData.reportFiles[fileName]) {
          const filePath = reportData.reportFiles[fileName];
          const downloadFileName = filePath.split(/[/\\]/).pop() || `report.${format === 'excel' ? 'xlsx' : 'html'}`;
          
          console.log('Download info:', {
            filePath,
            downloadFileName,
            format,
            fileId
          });
          
        // const downloadUrl = designReviewApiService.downloadReport(downloadFileName);
        const host = window.location.origin.includes('localhost') ? 'http://localhost:9000' : window.location.origin+'/test';
        let href = host +'/api/'+ reportData.reportFiles[fileName];
        // 跨平台兼容的路径替换 - 处理 Windows 和 Mac/Linux 的路径差异
        href = href.replace(/[\/\\]api[\/\\]outputs[\/\\]/g, '/api/design-review/download/');
        href = href.replace(/outputs[\/\\]/g, 'design-review/download/');
        // 最后确保路径分隔符统一为正斜杠（URL标准）
        href = href.replace(/\\/g, '/');
        console.log('Download URL:', href);
        // 创建下载链接
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = href;
        a.download = downloadFileName;
        document.body.appendChild(a);

        a.click();
        document.body.removeChild(a);
        }
      } else {
        setError('报告生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  const handleBackToHome = () => {
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToHome}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回首页</span>
              </button>
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">设计稿审核 AI</h1>
                <p className="text-sm text-gray-500">通过AI工具提高设计稿审核准确度和效率</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <User className="h-5 w-5" />
                <span>欢迎，{username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>退出</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          className="text-center p-8 border-b border-gray-200 bg-white shadow-sm rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-1">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-4">
            设计稿审核AI系统
          </h2>
          <p className="text-l text-gray-600 mb-8 max-w-2xl mx-auto">
            上传设计稿文件，使用AI技术进行智能审核，包括文本检查、格式验证、一致性分析和质量评估，支持多语言和多维度审核
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <motion.div
              className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4 mx-auto">
                <Search className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                智能审核
              </h3>
              <p className="text-gray-600 text-sm">
                使用先进的AI技术自动检测设计稿中的文本错误、格式问题和一致性问题
              </p>
            </motion.div>

            <motion.div
              className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4 mx-auto">
                <Globe className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                多语言支持
              </h3>
              <p className="text-gray-600 text-sm">
                支持九种主要语言的审核：英语、德语、法语、西班牙语、意大利语、荷兰语、波兰语、瑞典语、日语，确保多语言内容的质量一致性
              </p>
            </motion.div>

            <motion.div
              className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4 mx-auto">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                详细报告
              </h3>
              <p className="text-gray-600 text-sm">
                生成Excel和HTML格式的详细审核报告，包含问题定位、建议修复和统计信息
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                设置
              </h2>

              {/* Multi-Language Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  多语言内容选择
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  选择设计稿中包含的所有语言，AI将对每种语言进行相应的拼写、语法和术语审核
                </p>
                
                {/* 快速选择按钮 */}
                <div className="mb-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguages(['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'sv', 'ja'])}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    全选九国语言
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLanguages(['en'])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    仅英语
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLanguages(['en', 'zh-CN'])}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                  >
                    中英双语
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLanguages([])}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                  >
                    清空选择
                  </button>
                </div>

                {/* 语言选择网格 */}
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                  {config && Object.entries(config.supportedLanguages).map(([code, name]) => {
                    const isSelected = selectedLanguages.includes(code);
                    return (
                      <label 
                        key={code} 
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          isSelected 
                            ? 'bg-purple-50 border border-purple-200 text-purple-700' 
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLanguages([...selectedLanguages, code]);
                            } else {
                              setSelectedLanguages(selectedLanguages.filter(lang => lang !== code));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-purple-500 focus:ring-2"
                        />
                        <span className={`text-sm font-medium ${isSelected ? 'text-purple-700' : 'text-gray-700'}`}>
                          {name}
                        </span>
                        {isSelected && (
                          <div className="ml-auto w-2 h-2 bg-purple-500 rounded-full"></div>
                        )}
                      </label>
                    );
                  })}
                </div>
                
                {/* 选择状态显示 */}
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      💡 已选择 <span className="font-semibold text-purple-600">{selectedLanguages.length}</span> 种语言
                    </span>
                  </div>
                  
                  {/* 显示已选择的语言 */}
                  {selectedLanguages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedLanguages.map(code => (
                        <span 
                          key={code}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                        >
                          {config?.supportedLanguages[code]?.split(' ')[0] || code}
                          <button
                            type="button"
                            onClick={() => setSelectedLanguages(selectedLanguages.filter(lang => lang !== code))}
                            className="ml-1 hover:bg-purple-200 rounded-full w-3 h-3 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedLanguages.length === 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>⚠️ 请至少选择一种语言进行审核</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Review Categories */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  审核维度
                </label>
                {config && Object.entries(config.reviewCategories).map(([key, category]) => (
                  <label key={key} className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, key]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(c => c !== key));
                        }
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">
                      {category.name}
                      <span className="text-xs text-gray-500 block">{category.description}</span>
                    </span>
                  </label>
                ))}
              </div>

              {/* Progress */}
              {processResults.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">处理进度</h3>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-600">
                      已处理 {processResults.filter(r => r.success).length} / {processResults.length} 个文件
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="border-b">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'upload'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline-block mr-2" />
                    文件上传
                  </button>
                  <button
                    onClick={() => setActiveTab('review')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'review'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Search className="w-4 h-4 inline-block mr-2" />
                    审核结果
                  </button>
                  <button
                    onClick={() => setActiveTab('export')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'export'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Download className="w-4 h-4 inline-block mr-2" />
                    报告导出
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {/* Upload Tab */}
                  {activeTab === 'upload' && (
                    <motion.div
                      key="upload"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {/* 示例文件下载 */}
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-blue-900 mb-1">参考文件下载</h3>
                            <p className="text-sm text-blue-700">当前下载文件：图片格式</p>
                          </div>
                          <Button 
                            type="primary" 
                            onClick={() => downloadFile('设计稿示例.jpeg')} 
                            shape="round" 
                            icon={<DownloadOutlined />} 
                            size="middle"
                            className="bg-blue-600 hover:bg-blue-700 border-blue-600"
                          >
                            示例文件
                          </Button>
                        </div>
                      </div>
                      
                      {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="text-red-700">{error}</span>
                        </div>
                      )}

                      {config && (
                        <DesignFileUpload
                          key={uploadComponentKey}
                          onFilesSelected={handleFilesSelected}
                          acceptedFileTypes={config.supportedFileTypes}
                          disabled={isUploading}
                        />
                      )}
                      
                      {/* 上传进度显示 */}
                      {isUploading && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                              正在上传文件 ({uploadingFiles.length} 个)
                            </span>
                            <span className="text-sm text-blue-700">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <motion.div
                              className="bg-blue-600 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-blue-600">
                            {uploadingFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{file.name}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {uploadedFiles.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 bg-gray-50 rounded-lg p-4"
                        >
                          <h3 className="text-sm font-medium text-gray-700 mb-3">
                            已上传的文件 ({uploadedFiles.length})
                          </h3>
                          <div className="space-y-2">
                            {uploadedFiles.map((file, index) => {
                              const isProcessed = processResults.some(result => result.fileId === file.id);
                              return (
                                <div key={file.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-700">{file.originalName}</span>
                                    <span className="text-xs text-gray-500">
                                      ({(file.size / 1024).toFixed(1)} KB)
                                    </span>
                                    {isProcessed && (
                                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                        已处理
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
                                      // 同时删除对应的处理结果
                                      setProcessResults(prev => prev.filter(result => result.fileId !== file.id));
                                    }}
                                    className="text-red-500 hover:text-red-700 text-xs"
                                  >
                                    删除
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                                             {uploadedFiles.length > 0 && hasUnprocessedFiles() && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-6"
                          >
                            {isProcessing ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                  <span>处理进度</span>
                                  <span>{processingProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${processingProgress}%` }}
                                  ></div>
                                </div>
                                {currentProcessingFile && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>正在处理: {currentProcessingFile}</span>
                                  </div>
                                )}
                                {processingMessage && (
                                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                                    {processingMessage}
                                  </div>
                                )}
                                {processingStage && (
                                  <div className="text-xs text-gray-500">
                                    当前阶段: {getStageDisplayName(processingStage)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={handleProcess}
                                disabled={selectedLanguages.length === 0}
                                className={`w-full py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                  selectedLanguages.length === 0 
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                              >
                                开始处理
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            )}
                          </motion.div>
                        )}

                        {uploadedFiles.length > 0 && (
                          <button
                            onClick={handleClearAll}
                            className="mt-3 w-full text-gray-500 hover:text-gray-700 text-sm transition-colors"
                          >
                            清空所有文件
                          </button>
                        )}
                    </motion.div>
                  )}

                  {/* Review Tab */}
                  {activeTab === 'review' && (
                    <motion.div
                      key="review"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <h2 className="text-xl font-semibold mb-4">审核结果</h2>
                      
                      {processResults.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>请先上传并处理文件</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {processResults.map((result, index) => (
                            <div key={index} className="border rounded-lg p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium">
                                  {uploadedFiles.find(f => f.id === result.fileId)?.originalName || 'Unknown File'}
                                </h3>
                                {result.success ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                              </div>

                              {result.success && result.reviewResult && (
                                <>
                                  {/* Summary */}
                                  <div className="grid grid-cols-4 gap-4 mb-6">
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                      <div className="text-2xl font-bold text-gray-900">
                                        {result.reviewResult.review_summary?.total_issues || 0}
                                      </div>
                                      <div className="text-sm text-gray-500">总问题数</div>
                                    </div>
                                    <div className="text-center p-4 bg-red-50 rounded-lg">
                                      <div className="text-2xl font-bold text-red-600">
                                        {result.reviewResult.review_summary?.high_severity || 0}
                                      </div>
                                      <div className="text-sm text-gray-500">高严重性</div>
                                    </div>
                                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                      <div className="text-2xl font-bold text-yellow-600">
                                        {result.reviewResult.review_summary?.medium_severity || 0}
                                      </div>
                                      <div className="text-sm text-gray-500">中严重性</div>
                                    </div>
                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                      <div className="text-2xl font-bold text-green-600">
                                        {result.reviewResult.review_summary?.low_severity || 0}
                                      </div>
                                      <div className="text-sm text-gray-500">低严重性</div>
                                    </div>
                                  </div>

                                  {/* Language Analysis */}
                                  {result.reviewResult.language_analysis && (
                                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                      <h4 className="font-medium mb-3 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-blue-600" />
                                        语言分析结果
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">检测到的语言:</span>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {result.reviewResult.language_analysis.detected_languages?.map(lang => (
                                              <span key={lang} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                                {config?.supportedLanguages[lang]?.split(' ')[0] || lang}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">主要语言:</span>
                                          <div className="mt-1">
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                              {config?.supportedLanguages[result.reviewResult.language_analysis.primary_language]?.split(' ')[0] || result.reviewResult.language_analysis.primary_language}
                                            </span>
                                          </div>
                                        </div>
                                        <div>
                                          <span className="font-medium text-gray-700">多语言内容:</span>
                                          <div className="mt-1">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              result.reviewResult.language_analysis.mixed_language_content 
                                                ? 'bg-orange-100 text-orange-700' 
                                                : 'bg-gray-100 text-gray-700'
                                            }`}>
                                              {result.reviewResult.language_analysis.mixed_language_content ? '是' : '否'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Issues */}
                                  {result.reviewResult.issues && result.reviewResult.issues.length > 0 && (
                                    <div>
                                      <h4 className="font-medium mb-3">问题详情</h4>
                                      <div className="space-y-3">
                                        {result.reviewResult.issues.map((issue, idx) => (
                                          <div key={idx} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                                                  {issue.severity.toUpperCase()}
                                                </span>
                                                {issue.language && (
                                                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                    {config?.supportedLanguages[issue.language]?.split(' ')[0] || issue.language}
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-sm text-gray-500">{issue.type}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <strong>位置:</strong> {issue.location}
                                            </p>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <strong>原文:</strong> <code className="bg-gray-100 px-1">{issue.original_text}</code>
                                            </p>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <strong>建议:</strong> <code className="bg-green-100 px-1">{issue.suggested_fix}</code>
                                            </p>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <strong>说明:</strong> {issue.explanation}
                                            </p>
                                            <p className="text-sm text-gray-700">
                                              <strong>置信度:</strong> <span className="font-medium">{(issue.confidence * 100).toFixed(0)}%</span>
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}

                              {!result.success && (
                                <div className="text-red-600">
                                  Error: {result.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Export Tab */}
                  {activeTab === 'export' && (
                    <motion.div
                      key="export"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <h2 className="text-xl font-semibold mb-4">报告导出</h2>
                      
                      {processResults.filter(r => r.success).length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Download className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>请先上传并处理文件</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <p className="text-gray-600">选择要导出报告的文件：</p>
                          
                          {processResults.filter(result => result.success).map((result, index) => {
                            const fileName = uploadedFiles.find(f => f.id === result.fileId)?.originalName || 'Unknown File';
                            return (
                              <div key={result.fileId} className="border rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <h3 className="text-lg font-medium">{fileName}</h3>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    总问题: {result.reviewResult?.review_summary?.total_issues || 0} 个
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <button 
                                    onClick={() => handleExport('excel', result.fileId)}
                                    disabled={isExporting}
                                    className="p-4 border rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <FileText className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                                    <h4 className="font-medium">导出 Excel</h4>
                                    <p className="text-sm text-gray-500 mt-1">详细的问题列表和统计</p>
                                    {isExporting && <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2" />}
                                  </button>
                                  
                                  <button 
                                    onClick={() => handleExport('html', result.fileId)}
                                    disabled={isExporting}
                                    className="p-4 border rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <FileText className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                                    <h4 className="font-medium">导出 HTML</h4>
                                    <p className="text-sm text-gray-500 mt-1">可视化的网页报告</p>
                                    {isExporting && <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2" />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesignReview; 