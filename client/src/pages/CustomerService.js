import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Cascader } from 'antd';
import { customerServiceApi } from '../services/customerServiceApi';
import { 
  LogOut, 
  User,
  Bot,
  AlertTriangle,
  CheckCircle,
  Eye,
  Lightbulb,
  TrendingUp,
  ChevronDown,
  Search,
  ArrowLeft,
  Globe,
  Smartphone,
  Settings,
  Clock,
  AlertCircle,
  FileText
} from 'lucide-react';

function CustomerService() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || '用户';
  
     // 表单状态
   const [formData, setFormData] = useState({
     language: 'English',
     modelNumber: 'PLAF005',
     deviceSN: '',
     memberId: '',
     startTime: '',
     endTime: '',
     petType: '猫',
     problemType: '',
     detailedDescription: '',
     environment: '室内光线较暗',
     frequency: '经常发生',
     customPetType: '', // 新增：用户自定义宠物类型
     customModelNumber: '' // 新增：用户自定义设备型号
   });
  
  // 分析结果状态
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState(null);

  // 页面加载时滚动到顶部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 监听分析状态变化，滚动到顶部
  useEffect(() => {
    if (isAnalyzing) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isAnalyzing]);

  // 宠物类型选项
  const petTypes = ['猫', '狗', '其它'];
  
     // 语言选项
   const languages = ['English', 'Chinese'];
  
     // 设备型号级联选择器选项
   const deviceModelOptions = [
     {
       value: 'feeders',
       label: 'Feeders',
       children: [
         { value: 'PLAF005', label: 'PLAF005' },
         { value: 'PLAF006', label: 'PLAF006' },
         { value: 'PLAF003', label: 'PLAF003' },
         { value: 'PLAF004', label: 'PLAF004' },
         { value: 'PLAF008', label: 'PLAF008' },
         { value: 'PLAF103', label: 'PLAF103' },
         { value: 'PLAF203', label: 'PLAF203' },
         { value: 'PLAF301', label: 'PLAF301' },
         { value: 'PLAF109', label: 'PLAF109' },
         { value: 'PLAF108', label: 'PLAF108' },
         { value: 'PLAF001', label: 'PLAF001' },
         { value: 'PLAF002', label: 'PLAF002' },
         { value: 'PLAF101', label: 'PLAF101' },
         { value: 'PLAF102', label: 'PLAF102' },
         { value: 'PLAF107', label: 'PLAF107' }
       ]
     },
     {
       value: 'camera',
       label: 'Camera',
       children: [
         { value: 'PLPC001', label: 'PLPC001' }
       ]
     },
     {
       value: 'fountains',
       label: 'Fountains',
       children: [
         { value: 'PLWF005', label: 'PLWF005' },
         { value: 'PLWF003', label: 'PLWF003' },
         { value: 'PLWF004', label: 'PLWF004' },
         { value: 'PLWF006', label: 'PLWF006' },
         { value: 'PLWF002', label: 'PLWF002' },
         { value: 'PLWF001', label: 'PLWF001' },
         { value: 'PLWF007', label: 'PLWF007' },
         { value: 'PLWF115', label: 'PLWF115' },
         { value: 'PLWF105', label: 'PLWF105' },
         { value: 'PLWF008', label: 'PLWF008' },
         { value: 'PLWF305', label: 'PLWF305' },
         { value: 'PLWF116', label: 'PLWF116' },
         { value: 'PLWF106', label: 'PLWF106' }
       ]
     },
     {
       value: 'other',
       label: 'Other',
       children: [
         { value: 'PLIT001', label: 'PLIT001' },
         { value: 'PLIT002', label: 'PLIT002' },
         { value: 'PLCT003', label: 'PLCT003' },
         { value: 'PLCT004', label: 'PLCT004' },
         { value: 'PLCT005', label: 'PLCT005' }
       ]
     }
   ];
  
  // 问题类型选项 - 改为用户自定义
  const problemTypes = [
    '行为分析问题',
    '饮食检测问题', 
    '健康监测问题',
    '活动识别问题',
    '环境适应问题',
    '其他问题'
  ];
  
  // 使用环境选项
  const environments = [
    '室内光线较暗',
    '室内光线充足',
    '室外环境',
    '混合环境'
  ];
  
  // 问题频率选项
  const frequencies = [
    '偶尔发生',
    '经常发生', 
    '持续发生',
    '特定时间发生'
  ];

  const handleInputChange = (field, value) => {
    // 对设备SN字段进行特殊处理，只允许字母和数字
    if (field === 'deviceSN') {
      // 只允许字母和数字，过滤掉其他字符
      const filteredValue = value.replace(/[^a-zA-Z0-9]/g, '');
      setFormData(prev => ({
        ...prev,
        [field]: filteredValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // 表单验证
  const validateForm = () => {
    const errors = [];
    
         // 检查语言
     if (!formData.language) {
       errors.push('Please select language');
     }
    
         // 检查设备型号
     if (!formData.modelNumber) {
       errors.push('Please select device model');
     }
    
         // 检查必填字段
     // Pet type field is hidden, using default value
     
     if (!formData.problemType) {
       errors.push('Please describe problem type');
     }
     
     if (!formData.detailedDescription) {
       errors.push('Please describe problem in detail');
     }
    
         // 检查设备识别信息（至少填写一项）
     if (!formData.deviceSN && !formData.memberId) {
       errors.push('Please fill in at least one of Device SN or Member ID');
     }
    
         // 检查时间范围（必填）
     if (!formData.startTime || !formData.endTime) {
       errors.push('Please select time range');
     }
    
    return errors;
  };

  // 使用统一的API服务
  const callCustomerServiceAPI = async (formData) => {
    try {
      const response = await customerServiceApi.analyzeTroubleshooting(formData);
      return response;
    } catch (error) {
      console.error('接口调用失败:', error);
             return {
         error: 'API call failed',
         message: error.message || 'Network connection error',
         timestamp: new Date().toLocaleString(),
         note: 'Please check network connection and API key configuration'
       };
    }
  };

  const handleAnalyze = async () => {
    // 表单验证
    const errors = validateForm();
    if (errors.length > 0) {
             alert('Please complete the following information:\n' + errors.join('\n'));
      return;
    }
    
    // 立即滚动到页面顶部 - 使用多种方法确保生效
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    setIsAnalyzing(true);
    
    try {
      // 调用API服务
      const response = await callCustomerServiceAPI(formData);
      console.log(response, 'response------');
      // 直接设置后端返回的结果
      setAnalysisResult(response);
      // 重置选中的文档索引
      setSelectedDocumentIndex(null);
      
    } catch (error) {
      console.error('分析过程出错:', error);
             setAnalysisResult({ error: 'API call failed', details: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = () => {
     localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleGoToHome = () => {
    navigate('/home');
  };

  // 处理时间范围变化
  const handleTimeRangeChange = (dates, dateStrings) => {
    if (dates && dates.length === 2) {
      setFormData(prev => ({
        ...prev,
        startTime: dateStrings[0],
        endTime: dateStrings[1]
      }));
    }
  };

  // 处理设备型号级联选择器变化
  const handleDeviceModelChange = (value, selectedOptions) => {
    if (value && value.length === 2) {
      // 获取选中的具体型号
      const selectedModel = value[1];
      setFormData(prev => ({
        ...prev,
        modelNumber: selectedModel
      }));
    }
  };

  // 级联选择器搜索过滤函数
  const filterDeviceModel = (inputValue, path) => {
    return path.some(option => 
      option.label.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
    );
  };

  // 处理文本中的超链接，将其转换为可点击的链接
  const renderTextWithLinks = (text) => {
    if (!text) return '';
    
    // 匹配URL的正则表达式
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline break-all"
            onClick={(e) => {
              e.preventDefault();
              window.open(part, '_blank');
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

     return (
     <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
                             <button
                 onClick={handleGoToHome}
                 className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
               >
                 <ArrowLeft className="w-5 h-5" />
                 <span>Back to Home</span>
               </button>
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
                             <div>
                 <h1 className="text-2xl font-bold text-gray-900">Smart Customer Service Center</h1>
                 <p className="text-sm text-gray-500">AI-powered troubleshooting and solution recommendation system</p>
               </div>
            </div>
            
            <div className="flex items-center space-x-4">
                             <div className="flex items-center space-x-2 text-gray-700">
                 <User className="h-5 w-5" />
                 <span>Welcome, {username}</span>
               </div>
                             <button
                 onClick={handleLogout}
                 className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
               >
                 <LogOut className="h-4 w-4" />
                 <span>Logout</span>
               </button>
            </div>
          </div>
        </div>
      </header>



      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左侧 - 问题反馈表单 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-lg shadow-lg p-6"
          >
            <div className="flex items-center mb-6">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Problem Report</h2>
            </div>

                         <div className="space-y-8">
               {/* 语言选择 */}
               <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                 <div className="flex items-center mb-4">
                   <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                     <Globe className="w-5 h-5 text-white" />
                   </div>
                   <div>
                     <label className="block text-lg font-semibold text-gray-800 mb-1">
                       Language <span className="text-red-500">*</span>
                     </label>
                     <p className="text-sm text-blue-600">Analysis result display language</p>
                   </div>
                 </div>
                 <div className="relative">
                   <select
                     value={formData.language}
                     onChange={(e) => handleInputChange('language', e.target.value)}
                     className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white text-base"
                   >
                     {languages.map(lang => (
                       <option key={lang} value={lang}>{lang}</option>
                     ))}
                   </select>
                   <ChevronDown className="absolute right-4 top-4 h-5 w-5 text-gray-400 pointer-events-none" />
                 </div>
               </div>

                {/* 设备型号 */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                      <Smartphone className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="block text-lg font-semibold text-gray-800 mb-1">
                        Device Model <span className="text-red-500">*</span>
                      </label>
                                             <p className="text-sm text-purple-600">Select model number</p>
                    </div>
                  </div>
                  <Cascader
                    options={deviceModelOptions}
                    onChange={handleDeviceModelChange}
                    placeholder="Please select device category and model"
                    showSearch={{ filter: filterDeviceModel }}
                    style={{ width: '100%', height: '48px' }}
                    className="w-full"
                  />
                </div>

                {/* 设备识别信息 - 请至少填写一项 */}
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-100 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                                             <h3 className="text-lg font-semibold text-gray-800 mb-1">Device Identification <span className="text-red-500">*</span></h3>
                                               <p className="text-sm font-medium text-cyan-800 mb-4">⚠️ Please fill in at least one for device identification</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 设备SN */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Device SN
                      </label>
                      <input
                        type="text"
                        value={formData.deviceSN}
                        onChange={(e) => handleInputChange('deviceSN', e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                        placeholder="Please enter device SN"
                        maxLength={30}
                      />
                    </div>

                    {/* Member ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        User ID
                      </label>
                      <input
                        type="text"
                        value={formData.memberId}
                        onChange={(e) => handleInputChange('memberId', e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                        placeholder="Please enter user ID"
                      />
                    </div>
                  </div>
                </div>

                {/* 时间范围 - 必填 */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg flex items-center justify-center mr-3">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">Problem Time Range <span className="text-red-500">*</span></h3>
                      <p className="text-sm text-emerald-600">Required, helps to locate the problem more accurately</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                   
                    </label>
                    <DatePicker.RangePicker
                      showTime
                      format="YYYY-MM-DD HH:mm:ss"
                      onChange={handleTimeRangeChange}
                      className="w-full"
                      placeholder={['Start Time', 'End Time']}
                      style={{ width: '100%', height: '48px' }}
                    />
                  </div>
                </div>

                {/* 问题类型 */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-100 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="block text-lg font-semibold text-gray-800 mb-1">
                        Problem Type <span className="text-red-500">*</span>
                      </label>
                      <p className="text-sm text-orange-600">Describe the type of problem you encountered</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formData.problemType}
                    onChange={(e) => handleInputChange('problemType', e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="Please describe the type of problem you encountered..."
                  />
                </div>

                {/* 详细描述问题 */}
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-6 rounded-xl border border-violet-100 shadow-sm">
                  <div className="flex items-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="block text-lg font-semibold text-gray-800 mb-1">
                        Detailed Problem Description <span className="text-red-500">*</span>
                      </label>
                      <p className="text-sm text-violet-600">Describe your problem in detail for better analysis</p>
                    </div>
                  </div>
                  <textarea
                    value={formData.detailedDescription}
                    onChange={(e) => handleInputChange('detailedDescription', e.target.value)}
                    rows={4}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base"
                    placeholder="Please describe your problem in detail..."
                  />
                  <p className="text-xs text-gray-500 mt-2">Please describe the specific symptoms, occurrence time, frequency, etc.</p>
                </div>

                {/* 智能分析按钮 */}
                <div className="pt-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-4 px-8 rounded-xl font-semibold hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span className="text-lg">Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-6 w-6" />
                        <span className="text-lg">Smart Analysis</span>
                      </>
                    )}
                  </button>
                </div>
             </div>

            {/* 快捷问题类型 */}
            {/* <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors">
                <Eye className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-800">饮水检测问题</p>
                <p className="text-xs text-blue-600 mt-1">快速解决宠物饮水行为识别问题</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors">
                <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-800">进食检测问题</p>
                <p className="text-xs text-green-600 mt-1">解决宠物进食行为识别不准确</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center cursor-pointer hover:bg-purple-100 transition-colors">
                <Bot className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-purple-800">宠物识别问题</p>
                <p className="text-xs text-purple-600 mt-1">提高多宠物识别准确率</p>
              </div>
            </div> */}
          </motion.div>

          {/* 右侧 - AI分析结果 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-lg shadow-lg p-6"
          >
                         <div className="flex items-center mb-6">
               <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3">
                 <Bot className="h-4 w-4 text-white" />
               </div>
               <h2 className="text-xl font-semibold text-gray-900">AI Analysis Results</h2>
               {analysisResult && !analysisResult.error && (
                 <div className="ml-auto">
                   <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                     API Response Success
                   </span>
                 </div>
               )}
             </div>

                         {isAnalyzing ? (
               <div className="text-center py-12">
                 <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                 <p className="text-gray-500">Analyzing...</p>
               </div>
            ) : analysisResult ? (
               <div className="space-y-6">
                 {/* 错误处理 */}
                 {analysisResult.error ? (
                   <div className="bg-red-50 p-4 rounded-lg">
                     <div className="flex items-center mb-3">
                       <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                                                <h3 className="font-semibold text-red-800">Analysis Failed</h3>
                     </div>
                     <div className="bg-white p-4 rounded border">
                       <p className="text-red-700">{analysisResult.message || analysisResult.error}</p>
                       {analysisResult.note && (
                         <p className="text-red-600 text-sm mt-2">{analysisResult.note}</p>
                       )}
                     </div>
                   </div>
                 ) : (
                   <>
                     {/* 置信度评分 - 移到最上面并美化布局 */}
                     {analysisResult.confidenceScore !== undefined && (
                       <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 shadow-sm">
                         <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center">
                             <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3">
                               <TrendingUp className="h-5 w-5 text-white" />
                             </div>
                             <div>
                               <h3 className="font-bold text-green-800 text-lg">AI Analysis Confidence</h3>
                               <p className="text-green-600 text-sm">Accuracy assessment based on problem description</p>
                             </div>
                           </div>
                           <div className="text-right">
                             <div className="text-2xl font-bold text-green-700">
                               {(analysisResult.confidenceScore * 100).toFixed(1)}%
                             </div>
                                                            <div className="text-xs text-green-600">Confidence</div>
                           </div>
                         </div>
                         
                         <div className="bg-white p-4 rounded-lg border border-green-200">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-sm font-medium text-gray-700">Accuracy Score</span>
                             <span className="text-sm font-bold text-green-700">
                                                                {analysisResult.confidenceScore >= 0.8 ? 'Excellent' : 
                                  analysisResult.confidenceScore >= 0.6 ? 'Good' : 
                                  analysisResult.confidenceScore >= 0.4 ? 'Fair' : 'Need More Info'}
                             </span>
                           </div>
                           <div className="w-full bg-gray-200 rounded-full h-3">
                             <div 
                               className={`h-3 rounded-full transition-all duration-500 ${
                                 analysisResult.confidenceScore >= 0.8 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                 analysisResult.confidenceScore >= 0.6 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                                 analysisResult.confidenceScore >= 0.4 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                 'bg-gradient-to-r from-red-500 to-pink-500'
                               }`}
                               style={{ width: `${(analysisResult.confidenceScore * 100)}%` }}
                             ></div>
                           </div>
                           <div className="flex justify-between text-xs text-gray-500 mt-1">
                             <span>0%</span>
                             <span>50%</span>
                             <span>100%</span>
                           </div>
                         </div>
                       </div>
                     )}

                     {/* 根因分析 */}
                     {analysisResult.rootCauseAnalysis && (
                       <div className="bg-blue-50 p-4 rounded-lg">
                         <div className="flex items-center mb-3">
                           <Lightbulb className="h-5 w-5 text-blue-600 mr-2" />
                           <h3 className="font-semibold text-blue-800">Root Cause Analysis</h3>
                         </div>
                         <div className="bg-white p-4 rounded border">
                           <div className="text-gray-700 whitespace-pre-wrap">
                             {renderTextWithLinks(analysisResult.rootCauseAnalysis)}
                           </div>
                         </div>
                       </div>
                     )}

                     {/* 推荐解决方案 */}
                     {analysisResult.recommendedSolutions && analysisResult.recommendedSolutions.length > 0 && (
                       <div className="bg-purple-50 p-4 rounded-lg">
                         <div className="flex items-center mb-3">
                           <CheckCircle className="h-5 w-5 text-purple-600 mr-2" />
                           <h3 className="font-semibold text-purple-800">Recommended Solutions</h3>
                         </div>
                         <div className="bg-white p-4 rounded border">
                           <ul className="space-y-2">
                             {analysisResult.recommendedSolutions.map((solution, index) => (
                               <li key={index} className="flex items-start">
                                 <span className="text-purple-600 mr-2">•</span>
                                 <div className="text-gray-700 whitespace-pre-wrap">
                                   {renderTextWithLinks(solution)}
                                 </div>
                               </li>
                             ))}
                           </ul>
                         </div>
                       </div>
                     )}

                     {/* 消息（如果有） */}
                     {analysisResult.message && (
                       <div className="bg-blue-50 p-4 rounded-lg">
                         <div className="flex items-center mb-3">
                           <Bot className="h-5 w-5 text-blue-600 mr-2" />
                           <h3 className="font-semibold text-blue-800">Recommended Response</h3>
                         </div>
                         <div className="bg-white p-4 rounded border">
                           <div className="text-gray-700 whitespace-pre-wrap">
                             {renderTextWithLinks(analysisResult.message)}
                           </div>
                         </div>
                       </div>
                     )}

                     {/* 后续问题 */}
                     {/* {analysisResult.followUpQuestions && analysisResult.followUpQuestions.length > 0 && (
                       <div className="bg-yellow-50 p-4 rounded-lg">
                         <div className="flex items-center mb-3">
                           <Bot className="h-5 w-5 text-yellow-600 mr-2" />
                           <h3 className="font-semibold text-yellow-800">后续问题</h3>
                         </div>
                         <div className="bg-white p-4 rounded border">
                           <ul className="space-y-2">
                             {analysisResult.followUpQuestions.map((question, index) => (
                               <li key={index} className="flex items-start">
                                 <span className="text-yellow-600 mr-2">?</span>
                                 <span className="text-gray-700">{question}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       </div>
                     )} */}

                     {/* 设备数据摘要（如果有） */}
                     {/* {analysisResult.deviceData?.aiotSummary?.data_summary && (
                       <div className="bg-gray-50 p-4 rounded-lg">
                         <div className="flex items-center mb-3">
                           <Eye className="h-5 w-5 text-gray-600 mr-2" />
                           <h3 className="font-semibold text-gray-800">设备数据摘要</h3>
                         </div>
                         <div className="bg-white p-4 rounded border">
                           <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                             <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg">
                               <span className="text-2xl font-bold text-blue-600">
                                 {analysisResult.deviceData.aiotSummary.data_summary.heartbeat_count || 0}
                               </span>
                               <span className="text-xs text-gray-600 mt-1">心跳次数</span>
                             </div>
                             <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg">
                               <span className="text-2xl font-bold text-green-600">
                                 {analysisResult.deviceData.aiotSummary.data_summary.events_count || 0}
                               </span>
                               <span className="text-xs text-gray-600 mt-1">事件次数</span>
                             </div>
                             <div className="flex flex-col items-center p-3 bg-yellow-50 rounded-lg">
                               <span className="text-2xl font-bold text-yellow-600">
                                 {analysisResult.deviceData.aiotSummary.data_summary.logs_count || 0}
                               </span>
                               <span className="text-xs text-gray-600 mt-1">日志次数</span>
                             </div>
                             <div className="flex flex-col items-center p-3 bg-purple-50 rounded-lg">
                               <span className="text-2xl font-bold text-purple-600">
                                 {analysisResult.deviceData.aiotSummary.data_summary.status_count || 0}
                               </span>
                               <span className="text-xs text-gray-600 mt-1">状态次数</span>
                             </div>
                             <div className="flex flex-col items-center p-3 bg-indigo-50 rounded-lg">
                               <span className="text-2xl font-bold text-indigo-600">
                                 {analysisResult.deviceData.aiotSummary.data_summary.config_count || 0}
                               </span>
                               <span className="text-xs text-gray-600 mt-1">配置次数</span>
                             </div>
                           </div>
                         </div>
                       </div>
                     )} */}

                     {/* 知识库参考文档（如果有） */}
                     {analysisResult.knowledgeBaseResults.sources && (
                       <div className="bg-indigo-50 p-4 rounded-lg">
                         <div className="flex items-center mb-3">
                           <Lightbulb className="h-5 w-5 text-indigo-600 mr-2" />
                           <h3 className="font-semibold text-indigo-800">Knowledge Base References</h3>
                         </div>
                         <div className="bg-white p-4 rounded border">
                           <div className="flex flex-wrap gap-2 mb-4">
                             {analysisResult.knowledgeBaseResults.sources.map((item, index) => (
                               <span 
                                 key={index}
                                 onClick={() => setSelectedDocumentIndex(selectedDocumentIndex === index ? null : index)}
                                 className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-md ${
                                   selectedDocumentIndex === index 
                                     ? 'bg-indigo-500 text-white border-indigo-500' 
                                     : 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200'
                                 }`}
                               >
                                 <span className={`w-2 h-2 rounded-full mr-2 ${
                                   selectedDocumentIndex === index ? 'bg-white' : 'bg-indigo-400'
                                 }`}></span>
                                 {item.filename}
                               </span>
                             ))}
                           </div>
                           
                           {/* 显示选中文档的内容 */}
                           {selectedDocumentIndex !== null && analysisResult.knowledgeBaseResults.sources[selectedDocumentIndex] && (
                             <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                               <div className="flex items-center justify-between mb-3">
                                 <h4 className="font-semibold text-gray-800 text-sm">
                                   {analysisResult.knowledgeBaseResults.sources[selectedDocumentIndex].filename}
                                 </h4>
                                                                    <button
                                     onClick={() => setSelectedDocumentIndex(null)}
                                     className="text-gray-500 hover:text-gray-700 text-sm"
                                   >
                                     Close
                                   </button>
                               </div>
                               <div className="bg-white p-3 rounded border text-sm text-gray-700 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                 {(analysisResult.knowledgeBaseResults.sources[selectedDocumentIndex].content || 
                                  analysisResult.knowledgeBaseResults.sources[selectedDocumentIndex].text || 
                                   'No content').replace(/column_\d+:/g, '')}
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                   </>
                 )}
               </div>
                         ) : (
               <div className="text-center py-12">
                 <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                 <p className="text-gray-500">Please fill in the form on the left and click analyze to view results</p>
               </div>
             )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default CustomerService; 
