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
  User
} from 'lucide-react';
import DesignFileUpload from '../components/DesignFileUpload';
import { designReviewApiService } from '../services/designReviewApi';
// import { isLogin } from '../utils/index.ts';

function DesignReview() {
  const navigate = useNavigate();
  const [username] = useState(localStorage.getItem('username') || 'User');
  
  const [activeTab, setActiveTab] = useState('upload');
  const [config, setConfig] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN');
  const [selectedCategories, setSelectedCategories] = useState(['basic', 'advanced']);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processResults, setProcessResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
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
      const uploadedFileData = await designReviewApiService.uploadFiles(files);
      // 追加新文件到现有文件列表，而不是替换
      setUploadedFiles(prevFiles => [...prevFiles, ...uploadedFileData]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
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
    setError(null);

    try {
      const newResults = [];
      
      for (let i = 0; i < unprocessedFiles.length; i++) {
        const file = unprocessedFiles[i];
        setCurrentProcessingFile(file.originalName);
        setProcessingProgress(Math.round((i / unprocessedFiles.length) * 100));

        try {
          // 处理单个文件
          const results = await designReviewApiService.processFiles([file.id], selectedLanguage, selectedCategories);
          newResults.push(...results);
        } catch (fileError) {
          console.error(`Error processing file ${file.originalName}:`, fileError);
          // 添加失败结果
          newResults.push({
            fileId: file.id,
            success: false,
            error: fileError.message || 'Processing failed'
          });
        }
      }

      // 完成处理
      setProcessingProgress(100);
      setCurrentProcessingFile('');
      
      // 将新结果添加到现有结果中
      setProcessResults(prevResults => [...prevResults, ...newResults]);
      setActiveTab('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setCurrentProcessingFile('');
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                设置
              </h2>

              {/* Language Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  语言选择
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {config && Object.entries(config.supportedLanguages).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
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
                      <h2 className="text-xl font-semibold mb-4">上传需要检查的文件</h2>
                      
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
                        />
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
                              </div>
                            ) : (
                              <button
                                onClick={handleProcess}
                                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
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
                                        {result.reviewResult.review_summary.total_issues}
                                      </div>
                                      <div className="text-sm text-gray-500">总问题数</div>
                                    </div>
                                    <div className="text-center p-4 bg-red-50 rounded-lg">
                                      <div className="text-2xl font-bold text-red-600">
                                        {result.reviewResult.review_summary.high_severity}
                                      </div>
                                      <div className="text-sm text-gray-500">高严重性</div>
                                    </div>
                                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                      <div className="text-2xl font-bold text-yellow-600">
                                        {result.reviewResult.review_summary.medium_severity}
                                      </div>
                                      <div className="text-sm text-gray-500">中严重性</div>
                                    </div>
                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                      <div className="text-2xl font-bold text-green-600">
                                        {result.reviewResult.review_summary.low_severity}
                                      </div>
                                      <div className="text-sm text-gray-500">低严重性</div>
                                    </div>
                                  </div>

                                  {/* Issues */}
                                  {result.reviewResult.issues.length > 0 && (
                                    <div>
                                      <h4 className="font-medium mb-3">问题详情</h4>
                                      <div className="space-y-3">
                                        {result.reviewResult.issues.map((issue, idx) => (
                                          <div key={idx} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                                                {issue.severity.toUpperCase()}
                                              </span>
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