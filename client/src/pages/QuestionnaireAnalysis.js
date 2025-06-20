import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  X,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Download,
  ArrowLeft,
  LogOut,
  User
} from 'lucide-react';
import { questionnaireApi } from '../services/questionnaireApi';
import { isLogin } from '../utils/index.ts';

const QuestionnaireAnalysis = () => {
  const navigate = useNavigate();
  const [username] = useState(localStorage.getItem('username') || 'User');
  
  const [file, setFile] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [analysisId, setAnalysisId] = useState('');
  const [analysisType, setAnalysisType] = useState(['sentiment', 'topics', 'keywords', 'summary']);
  const [customTags, setCustomTags] = useState([]);
  const [summaryDimensions, setSummaryDimensions] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(true);
  
  let isLoginIndex = 0;
  
  useEffect(() => {
    if (isLoginIndex === 0) {
      isLoginIndex++;
      isLogin().then(res => {
        if (!res) {
          navigate('/login');
        }
      })
    }
  }, [navigate]);

  // 拖拽上传处理
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('文件格式不支持，请上传 CSV、Excel 文件');
      return;
    }
    
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  // 上传文件
  const handleUpload = async () => {
    console.log(file, '111');
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await questionnaireApi.upload(file);
      setUploadInfo(res.data);
      setAnalysisId(res.analysisId);
    } catch (err) {
      setError(err.message || '上传失败');
    }
    setLoading(false);
  };

  // 发起分析
  const handleAnalyze = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError('');
    try {
      const res = await questionnaireApi.analyze({
        analysisId,
        analysisType,
        customTags,
        summaryDimensions,
      });
      setAnalysisResult(res.results);
      setShowResult(true);
    } catch (err) {
      setError(err.message || '分析失败');
    }
    setLoading(false);
  };

  // 导出结果
  const handleExport = () => {
    if (!analysisId) return;
    questionnaireApi.export(analysisId);
  };

  // 移除文件
  const removeFile = () => {
    setFile(null);
    setUploadInfo(null);
    setAnalysisId('');
    setError('');
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件图标
  const getFileIcon = (fileName) => {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (ext === '.csv') {
      return <FileText className="w-5 h-5 text-green-600" />;
    }
    return <FileSpreadsheet className="w-5 h-5 text-blue-600" />;
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  // 返回首页
  const handleBackToHome = () => {
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
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
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">问卷文本分析</h1>
                <p className="text-sm text-gray-500">使用AI技术进行智能问卷分析和洞察</p>
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

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <motion.div
              className="text-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                问卷文本分析系统
              </h2>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                上传问卷数据文件，使用AI技术进行智能分析，包括情绪分析、话题归类、关键词提取和内容摘要
              </p>

              {/* Features */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4 mx-auto">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    智能分析
                  </h3>
                  <p className="text-gray-600 text-sm">
                    使用先进的AI技术自动分析问卷文本，提取关键信息和洞察
                  </p>
                </motion.div>

                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4 mx-auto">
                    <BarChart3 className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    多维度分析
                  </h3>
                  <p className="text-gray-600 text-sm">
                    支持情绪分析、话题归类、关键词提取和内容摘要等多种分析方式
                  </p>
                </motion.div>

                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4 mx-auto">
                    <Download className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    结果导出
                  </h3>
                  <p className="text-gray-600 text-sm">
                    分析完成后可导出详细的分析报告，支持多种格式
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* Upload Section */}
            <motion.div
              className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {/* Error Display */}
              {error && (
                <motion.div
                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-red-800 font-medium">上传失败</p>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* File Drop Zone */}
              <div
                {...getRootProps()}
                className={`text-center p-8 cursor-pointer rounded-lg transition-all duration-200 ${
                  isDragActive
                    ? 'bg-blue-50 border-blue-300'
                    : file
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <input {...getInputProps()} />
                
                <div className="mb-4">
                  {file ? (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                  ) : isDragActive ? (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
                      <FileSpreadsheet className="w-8 h-8 text-gray-600" />
                    </div>
                  )}
                </div>

                {file ? (
                  <div>
                    <p className="text-lg font-semibold text-green-800 mb-2">
                      文件已选择
                    </p>
                    <p className="text-green-600 mb-4">
                      点击或拖拽更换文件
                    </p>
                  </div>
                ) : isDragActive ? (
                  <div>
                    <p className="text-lg font-semibold text-blue-800 mb-2">
                      释放文件开始上传
                    </p>
                    <p className="text-blue-600">
                      将问卷数据文件拖放到此处
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-semibold text-gray-800 mb-2">
                      上传问卷数据文件
                    </p>
                    <p className="text-gray-600 mb-4">
                      选择或拖拽问卷数据文件到此处
                    </p>
                    <div className="text-sm text-gray-500">
                      <p>• 支持格式：CSV、Excel (.xls, .xlsx)</p>
                      <p>• 文件大小：最大10MB</p>
                      <p>• 数据要求：包含问卷文本内容</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected File */}
              {file && (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {getFileIcon(file.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                      disabled={loading}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Upload Button */}
              {file && (
                <motion.div
                  className="mt-6 text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className={`inline-flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                      loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    } text-white`}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>上传中...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>上传文件</span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </motion.div>

            {/* Upload Success Info */}
            {uploadInfo && (
              <motion.div
                className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center gap-2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold">上传成功</span>，共 {uploadInfo.totalRecords} 条数据
              </motion.div>
            )}

            {/* Analysis Configuration */}
            {uploadInfo && (
              <motion.div
                className="bg-white rounded-xl border border-gray-300 p-6 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-4">分析配置</h3>
                
                {/* Analysis Type */}
                <div className="mb-6">
                  <label className="block mb-3 font-semibold text-gray-700">分析类型：</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={analysisType.includes('sentiment')} 
                        onChange={e => setAnalysisType(t => e.target.checked ? [...t, 'sentiment'] : t.filter(i => i !== 'sentiment'))} 
                      />
                      <span className="text-sm">情绪分析</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={analysisType.includes('topics')} 
                        onChange={e => setAnalysisType(t => e.target.checked ? [...t, 'topics'] : t.filter(i => i !== 'topics'))} 
                      />
                      <span className="text-sm">话题归类</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={analysisType.includes('keywords')} 
                        onChange={e => setAnalysisType(t => e.target.checked ? [...t, 'keywords'] : t.filter(i => i !== 'keywords'))} 
                      />
                      <span className="text-sm">关键词提取</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={analysisType.includes('summary')} 
                        onChange={e => setAnalysisType(t => e.target.checked ? [...t, 'summary'] : t.filter(i => i !== 'summary'))} 
                      />
                      <span className="text-sm">内容摘要</span>
                    </label>
                  </div>
                </div>

                {/* Custom Tags and Summary Dimensions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700">自定义话题标签（逗号分隔）：</label>
                    <input
                      className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={customTags.join(',')}
                      onChange={e => setCustomTags(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="如：产品问题,使用场景"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700">摘要维度（逗号分隔，可选）：</label>
                    <input
                      className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={summaryDimensions.join(',')}
                      onChange={e => setSummaryDimensions(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="如：产品问题,使用场景"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-col md:flex-row gap-4">
                  <button
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                    onClick={handleAnalyze}
                    disabled={loading || !analysisId}
                  >
                    {loading ? '分析中...' : '开始分析'}
                  </button>
                  <button
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                    onClick={handleExport}
                    disabled={!analysisId}
                  >
                    导出结果
                  </button>
                </div>
              </motion.div>
            )}

            {/* Analysis Result */}
            {analysisResult && (
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <button
                  className="mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                  onClick={() => setShowResult(v => !v)}
                >
                  {showResult ? '收起分析结果' : '展开分析结果'}
                </button>
                {showResult && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-inner overflow-x-auto max-h-96">
                    <h3 className="text-xl font-bold mb-4 text-gray-800">分析结果</h3>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap break-all">{JSON.stringify(analysisResult, null, 2)}</pre>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireAnalysis;
