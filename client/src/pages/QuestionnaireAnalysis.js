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
  User,
  PieChart,
  BarChart,
  LineChart,
  Filter,
  Calendar,
  Target
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
  const [statistics, setStatistics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResult, setShowResult] = useState(true);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  
  // 统计分析参数
  const [groupBy, setGroupBy] = useState('');
  const [filters, setFilters] = useState({});
  
  // 趋势分析参数
  const [timeField, setTimeField] = useState('');
  const [trendType, setTrendType] = useState('sentiment');
  const [comparisonFields, setComparisonFields] = useState([]);
  
  // 页面标签页状态
  const [pageTab, setPageTab] = useState('upload');
  
  // 分析结果视图状态
  const [resultViewMode, setResultViewMode] = useState('structured'); // 'structured' | 'json'
  
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
      setActiveTab('analysis');
      // 分析完成后自动切换到分析结果标签页
      setPageTab('results');
    } catch (err) {
      setError(err.message || '分析失败');
    }
    setLoading(false);
  };

  // 统计分析
  const handleStatistics = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError('');
    try {
      const res = await questionnaireApi.statistics({
        analysisId,
        groupBy,
        filters,
      });
      setStatistics(res.statistics);
      setShowStatistics(true);
      setActiveTab('statistics');
      // 统计分析完成后自动切换到分析结果标签页
      setPageTab('results');
    } catch (err) {
      setError(err.message || '统计分析失败');
    }
    setLoading(false);
  };

  // 趋势分析
  const handleTrendAnalysis = async () => {
    if (!analysisId) return;
    setLoading(true);
    setError('');
    try {
      const res = await questionnaireApi.trend({
        analysisId,
        timeField,
        trendType,
        comparisonFields,
      });
      setTrends(res.trends);
      setShowTrends(true);
      setActiveTab('trends');
      // 趋势分析完成后自动切换到分析结果标签页
      setPageTab('results');
    } catch (err) {
      setError(err.message || '趋势分析失败');
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
    setAnalysisResult(null);
    setStatistics(null);
    setTrends(null);
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 解析换行符
  const parseNewlines = (text) => {
    if (typeof text !== 'string') return text;
    return text.replace(/\\n\\n/g, '\n\n').replace(/\\n/g, '\n');
  };

  // 格式化分析结果显示
  const formatAnalysisResult = (result) => {
    if (!result) return null;
    
    const formatted = {};
    Object.keys(result).forEach(key => {
      const value = result[key];
      if (typeof value === 'string') {
        formatted[key] = parseNewlines(value);
      } else if (Array.isArray(value)) {
        formatted[key] = value.map(item => 
          typeof item === 'string' ? parseNewlines(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        formatted[key] = formatAnalysisResult(value);
      } else {
        formatted[key] = value;
      }
    });
    return formatted;
  };

  // 渲染分析结果
  const renderAnalysisResult = (result) => {
    if (!result) return null;

    const renderValue = (value, key) => {
      if (typeof value === 'string') {
        return (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">{key}</div>
            <div className="text-gray-800 whitespace-pre-wrap">{value}</div>
          </div>
        );
      } else if (Array.isArray(value)) {
        return (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">{key}</div>
            <div className="space-y-2">
              {value.map((item, index) => (
                <div key={index} className="bg-white p-2 rounded border">
                  {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                </div>
              ))}
            </div>
          </div>
        );
      } else if (typeof value === 'object' && value !== null) {
        return (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">{key}</div>
            <div className="space-y-2">
              {Object.entries(value).map(([subKey, subValue]) => (
                <div key={subKey}>
                  {renderValue(subValue, subKey)}
                </div>
              ))}
            </div>
          </div>
        );
      } else {
        return (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">{key}</div>
            <div className="text-gray-800">{String(value)}</div>
          </div>
        );
      }
    };

    return (
      <div className="space-y-4">
        {Object.entries(result).map(([key, value]) => (
          <div key={key}>
            {renderValue(value, key)}
          </div>
        ))}
      </div>
    );
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

  // 渲染统计图表
  const renderStatisticsCharts = () => {
    if (!statistics) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 情感分布 */}
        {statistics.sentimentDistribution && (
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-600" />
              情感分布
            </h4>
            <div className="space-y-2">
              {Object.entries(statistics.sentimentDistribution).map(([sentiment, count]) => (
                <div key={sentiment} className="flex justify-between items-center">
                  <span className="capitalize">{sentiment}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 话题分布 */}
        {statistics.topicDistribution && (
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart className="w-5 h-5 text-green-600" />
              话题分布
            </h4>
            <div className="space-y-2">
              {Object.entries(statistics.topicDistribution).map(([topic, count]) => (
                <div key={topic} className="flex justify-between items-center">
                  <span>{topic}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 关键词频率 */}
        {statistics.keywordFrequency && (
          <div className="bg-white p-6 rounded-lg border md:col-span-2">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              关键词频率
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statistics.keywordFrequency).map(([keyword, frequency]) => (
                <span key={keyword} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  {keyword} ({frequency})
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* 代表性语句 */}
        {statistics.representativeQuotes && (
          <div className="bg-white p-6 rounded-lg border md:col-span-2">
            <h4 className="text-lg font-semibold mb-4">代表性语句</h4>
            <div className="space-y-3">
              {Object.entries(statistics.representativeQuotes).map(([category, quotes]) => (
                <div key={category}>
                  <h5 className="font-medium text-gray-700 mb-2 capitalize">{category}</h5>
                  <div className="space-y-2">
                    {Array.isArray(quotes) && quotes.slice(0, 3).map((quote, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                        "{parseNewlines(quote)}"
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染趋势图表
  const renderTrendCharts = () => {
    if (!trends) return null;
    
    return (
      <div className="space-y-6">
        {/* 趋势摘要 */}
        {trends.trendSummary && (
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              趋势摘要
            </h4>
            <p className="text-gray-700 whitespace-pre-wrap">{parseNewlines(trends.trendSummary)}</p>
          </div>
        )}
        
        {/* 时间序列 */}
        {trends.timeSeries && trends.timeSeries.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-blue-600" />
              时间趋势
            </h4>
            <div className="space-y-3">
              {trends.timeSeries.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{item.period}</span>
                  <div className="flex gap-4 text-sm">
                    <span>数量: {item.count}</span>
                    <span>情感: {item.sentiment}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 建议 */}
        {trends.recommendations && trends.recommendations.length > 0 && (
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-600" />
              改进建议
            </h4>
            <ul className="space-y-2">
              {trends.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span className="text-gray-700 whitespace-pre-wrap">{parseNewlines(recommendation)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
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
      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl">
            {/* Page Header */}
            <motion.div
              className="text-center p-8 border-b border-gray-200"
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
                上传问卷数据文件，使用AI技术进行智能分析，包括情绪分析、话题归类、关键词提取、内容摘要、数据统计和趋势分析
              </p>

              {/* Features */}
              <div className="grid md:grid-cols-4 gap-6 mb-8">
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
                    <PieChart className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    数据统计
                  </h3>
                  <p className="text-gray-600 text-sm">
                    按标签汇总用户数量、比例等统计数据，输出代表性语句
                  </p>
                </motion.div>

                <motion.div
                  className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mb-4 mx-auto">
                    <LineChart className="w-6 h-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    趋势分析
                  </h3>
                  <p className="text-gray-600 text-sm">
                    分析数据的时间趋势和变化模式，提供改进建议
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* Page Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-1 px-8 pt-6">
                <button
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    pageTab === 'upload' 
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPageTab('upload')}
                >
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    文件上传
                  </div>
                </button>
                <button
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    pageTab === 'config' 
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPageTab('config')}
                  disabled={!uploadInfo}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    分析配置
                  </div>
                </button>
                <button
                  className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                    pageTab === 'results' 
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setPageTab('results')}
                  disabled={!analysisResult && !statistics && !trends}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    分析结果
                  </div>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                {/* Upload Tab */}
                {pageTab === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* File Upload Area */}
                    {!file && (
                      <motion.div
                        className="mb-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        <div
                          {...getRootProps()}
                          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <input {...getInputProps()} />
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-lg font-medium text-gray-700 mb-2">
                            {isDragActive ? '释放文件以上传' : '拖拽文件到此处，或点击选择文件'}
                          </p>
                          <p className="text-sm text-gray-500 mb-4">
                            支持 CSV、Excel 文件，最大 10MB
                          </p>
                          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            选择文件
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* File Info */}
                    {file && (
                      <motion.div
                        className="mb-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                {getFileIcon(file.name)}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{file.name}</h3>
                                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                                onClick={handleUpload}
                                disabled={loading}
                              >
                                {loading ? '上传中...' : '开始上传'}
                              </button>
                              <button
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
                                onClick={removeFile}
                              >
                                移除
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Upload Success Info */}
                    {uploadInfo && (
                      <motion.div
                        className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-bold text-green-800">文件上传成功</h3>
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                就绪
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-gray-700">数据记录</span>
                                </div>
                                <div className="text-2xl font-bold text-green-600">{uploadInfo.totalRecords}</div>
                                <div className="text-xs text-gray-500">条记录</div>
                              </div>
                              
                              {file && (
                                <div className="bg-white rounded-lg p-3 border border-green-200">
                                  <div className="flex items-center gap-2 mb-1">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-gray-700">文件大小</span>
                                  </div>
                                  <div className="text-lg font-bold text-green-600">{formatFileSize(file.size)}</div>
                                  <div className="text-xs text-gray-500">{file.name}</div>
                                </div>
                              )}
                              
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <BarChart3 className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-gray-700">数据字段</span>
                                </div>
                                <div className="text-lg font-bold text-green-600">{uploadInfo.columns?.length || 0}</div>
                                <div className="text-xs text-gray-500">个字段</div>
                              </div>
                            </div>
                            
                            {uploadInfo.columns && uploadInfo.columns.length > 0 && (
                              <div className="bg-white rounded-lg p-4 border border-green-200">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                  <Filter className="w-4 h-4 text-green-600" />
                                  数据字段列表
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {uploadInfo.columns.map((column, index) => (
                                    <span 
                                      key={index} 
                                      className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full border border-green-200"
                                    >
                                      {column}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <motion.div
                        className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <AlertCircle className="w-5 h-5" />
                        {error}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Config Tab */}
                {pageTab === 'config' && uploadInfo && (
                  <motion.div
                    key="config"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="bg-white rounded-xl border border-gray-300 p-6">
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
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50 flex items-center justify-center gap-2"
                          onClick={handleAnalyze}
                          disabled={loading || !analysisId}
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>分析中...</span>
                            </>
                          ) : (
                            <>
                              <BarChart3 className="w-4 h-4" />
                              <span>开始分析</span>
                            </>
                          )}
                        </button>
                        <button
                          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                          onClick={handleExport}
                          disabled={!analysisId || (!analysisResult && !statistics && !trends)}
                        >
                          导出结果
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Results Tab */}
                {pageTab === 'results' && (analysisResult || statistics || trends) && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Result Type Tabs */}
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
                      <button
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'analysis' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        onClick={() => setActiveTab('analysis')}
                      >
                        文本分析
                      </button>
                      <button
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'statistics' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        onClick={() => setActiveTab('statistics')}
                      >
                        数据统计
                      </button>
                      <button
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'trends' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        onClick={() => setActiveTab('trends')}
                      >
                        趋势分析
                      </button>
                    </div>

                    {/* Result Content */}
                    <AnimatePresence mode="wait">
                      {activeTab === 'analysis' && analysisResult && (
                        <motion.div
                          key="analysis"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-inner overflow-x-auto max-h-96">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-xl font-bold text-gray-800">文本分析结果</h3>
                              <div className="flex space-x-2">
                                <button
                                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    resultViewMode === 'structured'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                  onClick={() => setResultViewMode('structured')}
                                >
                                  结构化视图
                                </button>
                                <button
                                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                    resultViewMode === 'json'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                  onClick={() => setResultViewMode('json')}
                                >
                                  JSON视图
                                </button>
                              </div>
                            </div>
                            {resultViewMode === 'structured' ? (
                              renderAnalysisResult(formatAnalysisResult(analysisResult))
                            ) : (
                              <pre className="text-sm text-gray-700 whitespace-pre-wrap break-all">
                                {JSON.stringify(formatAnalysisResult(analysisResult), null, 2)}
                              </pre>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'statistics' && (
                        <motion.div
                          key="statistics"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="space-y-6">
                            {/* 统计分析配置 */}
                            <div className="bg-white p-6 rounded-lg border">
                              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-blue-600" />
                                统计配置
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block mb-2 font-medium text-gray-700">分组字段：</label>
                                  <select
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                    value={groupBy}
                                    onChange={e => setGroupBy(e.target.value)}
                                  >
                                    <option value="">请选择分组字段</option>
                                    {uploadInfo?.columns?.map(col => (
                                      <option key={col} value={col}>{col}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-end">
                                  <button
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                                    onClick={handleStatistics}
                                    disabled={loading}
                                  >
                                    {loading ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>统计中...</span>
                                      </>
                                    ) : (
                                      <>
                                        <BarChart3 className="w-3 h-3" />
                                        <span>开始统计</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 统计结果 */}
                            {statistics && renderStatisticsCharts()}
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'trends' && (
                        <motion.div
                          key="trends"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="space-y-6">
                            {/* 趋势分析配置 */}
                            <div className="bg-white p-6 rounded-lg border">
                              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-orange-600" />
                                趋势配置
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="block mb-2 font-medium text-gray-700">时间字段：</label>
                                  <select
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                    value={timeField}
                                    onChange={e => setTimeField(e.target.value)}
                                  >
                                    <option value="">请选择时间字段</option>
                                    {uploadInfo?.columns?.map(col => (
                                      <option key={col} value={col}>{col}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block mb-2 font-medium text-gray-700">趋势类型：</label>
                                  <select
                                    className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                    value={trendType}
                                    onChange={e => setTrendType(e.target.value)}
                                  >
                                    <option value="sentiment">情感趋势</option>
                                    <option value="topics">话题趋势</option>
                                    <option value="keywords">关键词趋势</option>
                                  </select>
                                </div>
                                <div className="flex items-end">
                                  <button
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                                    onClick={handleTrendAnalysis}
                                    disabled={loading}
                                  >
                                    {loading ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>分析中...</span>
                                      </>
                                    ) : (
                                      <>
                                        <TrendingUp className="w-3 h-3" />
                                        <span>开始趋势分析</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 趋势结果 */}
                            {trends && renderTrendCharts()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireAnalysis;
