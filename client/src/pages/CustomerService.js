import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Cascader, Space, theme, Progress } from 'antd';
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
  FileText,
  Shield
} from 'lucide-react';

function CustomerService() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'User';
  const { token } = theme.useToken();
  
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
    navigate('/');
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

  // 日期选择器单元格渲染函数
  const cellRender = (current, info) => {
    if (info.type !== 'date') {
      return info.originNode;
    }
    if (typeof current === 'number' || typeof current === 'string') {
      return <div className="ant-picker-cell-inner">{current}</div>;
    }
    const style = {
      border: `1px solid ${token.colorPrimary}`,
      borderRadius: '50%',
    };
    return (
      <div className="ant-picker-cell-inner" style={current.date() === 1 ? style : {}}>
        {current.date()}
      </div>
    );
  };

  // 处理文本中的超链接，将其转换为可点击的链接
  const renderTextWithLinks = (text) => {
    if (!text) return '';
    
    // 先处理 markdown 加粗格式 (**text**)
    let processedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 匹配URL的正则表达式
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = processedText.split(urlRegex);
    
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
      // 处理包含 HTML 标签的部分
      if (part.includes('<strong>')) {
        return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
      }
      return part;
    });
  };

  // 渲染message内容的可视化展示
  const renderMessageContent = (message) => {
    if (!message) return null;

    // 按行分割内容
    const lines = message.split('\n');
    const sections = [];
    let currentSection = null;
    let currentContent = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 检查是否是标题
      if (trimmedLine.startsWith('## ')) {
        // 保存前一个section
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: currentContent.join('\n')
          });
        }
        
        // 开始新的section
        currentSection = {
          type: 'h2',
          title: trimmedLine.substring(3),
          icon: getIconForTitle(trimmedLine.substring(3))
        };
        currentContent = [];
      } else if (trimmedLine.startsWith('### ')) {
        // 保存前一个section
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: currentContent.join('\n')
          });
        }
        
        // 开始新的section
        currentSection = {
          type: 'h3',
          title: trimmedLine.substring(4),
          icon: getIconForTitle(trimmedLine.substring(4))
        };
        currentContent = [];
      } else {
        // 添加到当前内容
        currentContent.push(line);
      }
    });

    // 添加最后一个section
    if (currentSection) {
      sections.push({
        ...currentSection,
        content: currentContent.join('\n')
      });
    }

    // 如果没有找到任何标题，将整个内容作为一个section
    if (sections.length === 0) {
      sections.push({
        type: 'h2',
        title: 'Analysis Results',
        icon: <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
          <Bot className="h-4 w-4 text-white" />
        </div>,
        content: message
      });
    }

    return sections.map((section, index) => (
      <div key={index} className={getSectionStyle(section.type)}>
        <div className="flex items-center mb-3">
          {section.icon}
          <h3 className={getTitleStyle(section.type)}>
            {section.title}
          </h3>
        </div>
        <div className="bg-white p-4 rounded border">
          <div className="text-gray-700 whitespace-pre-wrap">
            {renderTextWithLinks(section.content)}
          </div>
        </div>
      </div>
    ));
  };

  // 增强的markdown内容渲染函数
  const renderEnhancedMessageContent = (message) => {
    if (!message) return null;

    // 按行分割内容
    const lines = message.split('\n');
    const sections = [];
    let currentH2Section = null;
    let currentH3Section = null;
    let currentContent = [];
    let summaryContent = null;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 检查是否是分隔符 (---)
      if (trimmedLine === '---') {
        // 保存当前section
        if (currentH2Section) {
          if (currentH3Section) {
            if (!currentH2Section.h3Sections) {
              currentH2Section.h3Sections = [];
            }
            currentH2Section.h3Sections.push({
              ...currentH3Section,
              content: currentContent.join('\n')
            });
          }
          sections.push({
            ...currentH2Section,
            h3Sections: currentH2Section.h3Sections || [],
            content: currentContent.join('\n')
          });
        }
        
        // 重置状态，准备收集总结内容
        currentH2Section = null;
        currentH3Section = null;
        currentContent = [];
        return;
      }
      
      // 检查是否是一级标题
      if (trimmedLine.startsWith('## ')) {
        // 保存前一个h2 section
        if (currentH2Section) {
          if (currentH3Section) {
            if (!currentH2Section.h3Sections) {
              currentH2Section.h3Sections = [];
            }
            currentH2Section.h3Sections.push({
              ...currentH3Section,
              content: currentContent.join('\n')
            });
          }
          sections.push({
            ...currentH2Section,
            h3Sections: currentH2Section.h3Sections || [],
            content: currentContent.join('\n')
          });
        }
        
        // 开始新的h2 section
        currentH2Section = {
          type: 'h2',
          title: trimmedLine.substring(3),
          icon: getIconForTitle(trimmedLine.substring(3))
        };
        currentH3Section = null;
        currentContent = [];
      } 
      // 检查是否是二级标题
      else if (trimmedLine.startsWith('### ')) {
        // 保存前一个h3 section到当前h2 section
        if (currentH3Section && currentH2Section) {
          if (!currentH2Section.h3Sections) {
            currentH2Section.h3Sections = [];
          }
          currentH2Section.h3Sections.push({
            ...currentH3Section,
            content: currentContent.join('\n')
          });
        }
        
        // 开始新的h3 section
        currentH3Section = {
          type: 'h3',
          title: trimmedLine.substring(4),
          icon: getIconForTitle(trimmedLine.substring(4))
        };
        currentContent = [];
      } else {
        // 添加到当前内容
        currentContent.push(line);
      }
    });

    // 保存最后一个section
    if (currentH2Section) {
      if (currentH3Section) {
        if (!currentH2Section.h3Sections) {
          currentH2Section.h3Sections = [];
        }
        currentH2Section.h3Sections.push({
          ...currentH3Section,
          content: currentContent.join('\n')
        });
      }
      sections.push({
        ...currentH2Section,
        h3Sections: currentH2Section.h3Sections || [],
        content: currentContent.join('\n')
      });
    } else if (currentContent.length > 0) {
      // 如果有剩余内容但没有标题，可能是总结内容
      summaryContent = currentContent.join('\n').trim();
    }

    // 如果没有找到任何标题，将整个内容作为一个section
    if (sections.length === 0 && !summaryContent) {
      sections.push({
        type: 'h2',
        title: 'Analysis Results',
        icon: <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
          <Bot className="h-4 w-4 text-white" />
        </div>,
        h3Sections: [],
        content: message
      });
    }

    // 添加调试信息
    console.log('Parsed sections:', sections);
    console.log('Summary content:', summaryContent);

    return (
      <div className="space-y-6">
        {/* 主要分析内容 */}
        {sections.map((section, index) => (
          <div key={index} className="mb-8 last:mb-0 bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            {/* 一级标题部分 */}
            <div className="flex items-center p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-100">
              {section.icon}
              <h3 className="font-bold text-lg text-gray-800">
                {section.title}
              </h3>
            </div>
            
            {/* 内容部分 */}
            <div className="p-4 space-y-4">
              {/* 如果有二级标题，先显示它们 */}
              {section.h3Sections && section.h3Sections.length > 0 ? (
                section.h3Sections.map((h3Section, h3Index) => (
                  <div key={h3Index} className="border-l-4 border-blue-200 pl-4">
                    {/* 二级标题 */}
                    <div className="flex items-center mb-3">
                      {h3Section.icon}
                      <h4 className="font-semibold text-base text-gray-700">
                        {h3Section.title}
                      </h4>
                    </div>
                    
                    {/* 二级标题内容 */}
                    <div className="ml-11">
                      <div className="text-gray-700 leading-relaxed text-sm space-y-3">
                        {renderEnhancedTextContent(h3Section.content)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* 如果没有二级标题，显示一级标题的直接内容 */
                <div className="text-gray-700 leading-relaxed text-sm space-y-3">
                  {renderEnhancedTextContent(section.content)}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* 总结内容模块 */}
        {summaryContent && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            {/* 总结标题部分 */}
            <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800">
                总结建议
              </h3>
            </div>
            
            {/* 总结内容 */}
            <div className="p-4">
              <div className="text-gray-700 leading-relaxed text-sm">
                {renderEnhancedTextContent(summaryContent)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 增强的文本内容渲染函数
  const renderEnhancedTextContent = (content) => {
    if (!content) return null;

    // 按行分割内容
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      // 检查是否是列表项（去掉圆点，只保留内容）
      if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        return (
          <div key={index} className="text-gray-700 leading-relaxed mb-2">
            {renderTextWithLinks(trimmedLine.substring(2))}
          </div>
        );
      }
      
      // 检查是否是子列表项（缩进，去掉圆点）
      if (trimmedLine.startsWith('  • ') || trimmedLine.startsWith('  - ') || trimmedLine.startsWith('  * ')) {
        return (
          <div key={index} className="text-gray-600 leading-relaxed mb-2 ml-4">
            {renderTextWithLinks(trimmedLine.substring(4))}
          </div>
        );
      }
      
      // 检查是否包含代码片段（用反引号包围的内容）
      if (trimmedLine.includes('`')) {
        return (
          <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200 mb-2">
            <code className="text-sm font-mono text-gray-800">
              {renderTextWithLinks(trimmedLine)}
            </code>
          </div>
        );
      }
      
      // 普通文本
      return (
        <div key={index} className="text-gray-700 leading-relaxed mb-2">
          {renderTextWithLinks(trimmedLine)}
        </div>
      );
    });
  };

  // 根据标题获取图标
  const getIconForTitle = (title) => {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('设备运行状态') || lowerTitle.includes('device status')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
        <Settings className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('心跳数据') || lowerTitle.includes('heartbeat')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
        <TrendingUp className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('异常事件') || lowerTitle.includes('error')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
        <AlertTriangle className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('问题诊断') || lowerTitle.includes('diagnosis')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-violet-500 rounded-lg flex items-center justify-center mr-3">
        <Lightbulb className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('解决方案') || lowerTitle.includes('solution')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center mr-3">
        <CheckCircle className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('根本原因') || lowerTitle.includes('root cause')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
        <Lightbulb className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('置信度') || lowerTitle.includes('confidence')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center mr-3">
        <TrendingUp className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('关键发现') || lowerTitle.includes('key findings')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center mr-3">
        <Eye className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('预防措施') || lowerTitle.includes('prevention')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
        <Shield className="h-4 w-4 text-white" />
      </div>;
    }
    if (lowerTitle.includes('后续关注') || lowerTitle.includes('follow up')) {
      return <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
        <Clock className="h-4 w-4 text-white" />
      </div>;
    }
    
    // 默认图标
    return <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center mr-3">
      <FileText className="h-4 w-4 text-white" />
    </div>;
  };

  // 获取section样式
  const getSectionStyle = (type) => {
    if (type === 'h2') {
      return 'bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 shadow-sm';
    }
    return 'bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200 shadow-sm';
  };

  // 获取标题样式
  const getTitleStyle = (type) => {
    if (type === 'h2') {
      return 'font-bold text-blue-800 text-lg';
    }
    return 'font-semibold text-gray-800 text-base';
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
                       format="YYYY-MM-DD"
                       onChange={handleTimeRangeChange}
                       className="w-full"
                       placeholder={['Start Date', 'End Date']}
                       style={{ width: '100%', height: '48px' }}
                       cellRender={cellRender}
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
                                          <div className="space-y-4">
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
                     {/* 置信度评分 - 进度条 */}
                      {analysisResult.confidenceScore !== undefined && (
                        <div className="mb-6">
                          <div className="mb-3">
                            <h3 className="text-base font-semibold text-gray-800">Confidence Score</h3>
                          </div>
                          
                           {/* 进度条 - 使用Ant Design Progress组件 */}
                           <div className="mb-2">
                             {/* 评级标签和进度条在同一行 */}
                             <div className="flex items-center space-x-4">
                               {/* 评级标签 - 放在进度条左边 */}
                               <span className={`text-sm px-3 py-1 rounded-full border flex-shrink-0 ${
                                 analysisResult.confidenceScore >= 0.8 ? 'bg-green-100 text-green-800 border-green-200' :
                                 analysisResult.confidenceScore >= 0.6 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                 analysisResult.confidenceScore >= 0.5 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                 'bg-red-100 text-red-800 border-red-200'
                               }`}>
                                 {analysisResult.confidenceScore >= 0.8 ? 'Excellent' : 
                                  analysisResult.confidenceScore >= 0.6 ? 'Good' : 
                                  analysisResult.confidenceScore >= 0.5 ? 'Fair' : 'Need More Info'}
                               </span>
                               
                               {/* 进度条 */}
                               <div className="flex-1">
                                 <Progress 
                                   percent={analysisResult.confidenceScore * 100} 
                                   percentPosition={{ align: 'center', type: 'inner' }} 
                                   size={[400, 20]}
                                   strokeColor={{
                                     '0%': analysisResult.confidenceScore >= 0.8 ? '#10b981' : 
                                           analysisResult.confidenceScore >= 0.6 ? '#f59e0b' : 
                                           analysisResult.confidenceScore >= 0.5 ? '#f97316' : '#ef4444',
                                     '100%': analysisResult.confidenceScore >= 0.8 ? '#059669' : 
                                              analysisResult.confidenceScore >= 0.6 ? '#d97706' : 
                                              analysisResult.confidenceScore >= 0.5 ? '#ea580c' : '#dc2626'
                                   }}
                                   trailColor="#e5e7eb"
                                   format={(percent) => (
                                     <span className="text-white font-bold text-sm">
                                       {percent}%
                                     </span>
                                   )}
                                 />
                               </div>
                             </div>
                           </div>
                        </div>
                      )}

                     {/* 综合分析结果 - 合并message内容和aiotSummary */}
                      {(analysisResult.message || analysisResult.deviceData?.aiotSummary) && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                          <div className="space-y-4">
                            {/* Message内容 - 优化markdown解析 */}
                            {analysisResult.message && (
                              <div className="bg-white p-6 rounded-lg border border-blue-100 shadow-sm">
                                <div className="mb-4">
                                  <h4 className="font-semibold text-gray-800 text-lg mb-2">AI Analysis Report</h4>
                                  <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded"></div>
                                </div>
                                <div className="prose prose-sm max-w-none">
                                  {renderEnhancedMessageContent(analysisResult.message)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 设备数据摘要 - 独立模块 */}
                      {analysisResult.deviceData?.aiotSummary && (
                        <div className="bg-indigo-50 p-4 rounded-lg">
                          <div className="flex items-center mb-3">
                            <Settings className="h-5 w-5 text-indigo-600 mr-2" />
                            <h3 className="font-semibold text-indigo-800">Device Data Summary</h3>
                          </div>
                          <div className="bg-white p-4 rounded border">
                            {/* 检查数据结构并处理 */}
                            {(() => {
                              const aiotSummary = analysisResult.deviceData.aiotSummary;
                              
                              // 如果是字符串格式（旧格式或错误信息）
                              if (typeof aiotSummary === 'string') {
                                const isError = aiotSummary.includes('未能成功检索') || 
                                               aiotSummary.includes('failed to retrieve') ||
                                               aiotSummary.includes('没有相关数据');
                                
                                if (isError) {
                                  return (
                              <div className="text-gray-700 space-y-3">
                                <div className="text-gray-600">
                                        {aiotSummary}
                                </div>
                                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md border border-gray-200">
                                  请检查设备的连接状态或确认数据是否已正确上报。
                                </div>
                              </div>
                                  );
                                }
                              }
                              
                              // 如果是对象格式（新格式）
                              if (typeof aiotSummary === 'object' && aiotSummary !== null) {
                                // 检查是否成功
                                if (aiotSummary.success === false) {
                                  return (
                                    <div className="text-gray-700 space-y-3">
                                      <div className="text-gray-600">
                                        {aiotSummary.error || '数据获取失败'}
                                      </div>
                                      <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md border border-gray-200">
                                        请检查设备的连接状态或确认数据是否已正确上报。
                                      </div>
                                    </div>
                                  );
                                }
                                
                                                                 // 解析 result 中的 markdown 文本
                                 const result = aiotSummary.result || '';
                                 
                                 // 检查是否包含心跳记录和异常事件标题
                                 const hasHeartbeatSection = result.includes('### 心跳记录');
                                 const hasAbnormalSection = result.includes('### 异常事件');
                                 
                                 // 解析心跳记录数据
                                 const heartbeatData = [];
                                 if (hasHeartbeatSection) {
                                   const heartbeatMatch = result.match(/### 心跳记录\n([\s\S]*?)(?=\n###|$)/);
                                   if (heartbeatMatch) {
                                     const heartbeatSection = heartbeatMatch[1];
                                     console.log('Heartbeat section found:', heartbeatSection);
                                     
                                     // 按行解析心跳记录
                                     const lines = heartbeatSection.split('\n');
                                     let currentTime = '';
                                     let currentCount = '';
                                     let currentUpdateTime = '';
                                     
                                     lines.forEach(line => {
                                       const trimmedLine = line.trim();
                                       
                                       // 匹配时间行: - **2025-08-12 12:00 - 13:00**:
                                       const timeMatch = trimmedLine.match(/- \*\*(.*?)\*\*/);
                                       if (timeMatch) {
                                         // 保存前一个记录
                                         if (currentTime && currentCount && currentUpdateTime) {
                                           heartbeatData.push({
                                             time: currentTime,
                                             count: currentCount,
                                             updateTime: currentUpdateTime
                                           });
                                         }
                                         currentTime = timeMatch[1].trim();
                                         currentCount = '';
                                         currentUpdateTime = '';
                                       }
                                       
                                       // 匹配心跳次数: - 心跳次数: 20
                                       const countMatch = trimmedLine.match(/心跳次数: (\d+)/);
                                       if (countMatch) {
                                         currentCount = countMatch[1];
                                       }
                                       
                                       // 匹配更新时间: - 更新时间: 2025-08-13 12:53:19
                                       const updateTimeMatch = trimmedLine.match(/更新时间: (.*?)$/);
                                       if (updateTimeMatch) {
                                         currentUpdateTime = updateTimeMatch[1].trim();
                                       }
                                     });
                                     
                                     // 保存最后一个记录
                                     if (currentTime && currentCount && currentUpdateTime) {
                                       heartbeatData.push({
                                         time: currentTime,
                                         count: currentCount,
                                         updateTime: currentUpdateTime
                                       });
                                     }
                                     
                                     console.log('Parsed heartbeat data:', heartbeatData);
                                   }
                                 }
                                 
                                 // 解析异常事件数据
                                 const abnormalData = [];
                                 if (hasAbnormalSection) {
                                   const abnormalMatch = result.match(/### 异常事件\n([\s\S]*?)(?=\n\n|$)/);
                                   if (abnormalMatch) {
                                     const abnormalSection = abnormalMatch[1];
                                     console.log('Abnormal section found:', abnormalSection);
                                     
                                     // 按行解析异常事件
                                     const lines = abnormalSection.split('\n');
                                     let currentTime = '';
                                     let currentPayload = '';
                                     
                                     lines.forEach(line => {
                                       const timeMatch = line.match(/\*\*(.*?)\*\*/);
                                       if (timeMatch) {
                                         // 保存前一个事件
                                         if (currentTime && currentPayload) {
                                           abnormalData.push({
                                             time: currentTime,
                                             payload: currentPayload.trim()
                                           });
                                         }
                                         currentTime = timeMatch[1].trim();
                                         currentPayload = '';
                                       } else if (line.includes('Payload:') || line.includes('```json')) {
                                         currentPayload += line + '\n';
                                       } else if (currentPayload) {
                                         currentPayload += line + '\n';
                                       }
                                     });
                                     
                                     // 保存最后一个事件
                                     if (currentTime && currentPayload) {
                                       abnormalData.push({
                                         time: currentTime,
                                         payload: currentPayload.trim()
                                       });
                                     }
                                   }
                                 }
                                 
                                 // 根据是否有心跳记录和异常事件来决定显示方式
                                 if (hasHeartbeatSection || hasAbnormalSection) {
                                   // 有结构化数据，显示 tab 形式
                                   return (
                                     <div className="space-y-4">
                                       {/* 标签按钮 */}
                                       <div className="flex flex-wrap gap-2 mb-4">
                                         {hasHeartbeatSection && (
                                           <span 
                                             onClick={() => setSelectedDocumentIndex(selectedDocumentIndex === 'heartbeat' ? null : 'heartbeat')}
                                             className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-md ${
                                               selectedDocumentIndex === 'heartbeat' 
                                                 ? 'bg-blue-500 text-white border-blue-500' 
                                                 : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                                             }`}
                                           >
                                             <span className={`w-2 h-2 rounded-full mr-2 ${
                                               selectedDocumentIndex === 'heartbeat' ? 'bg-white' : 'bg-blue-400'
                                             }`}></span>
                                             <TrendingUp className="w-3 h-3 mr-1" />
                                             心跳记录 {heartbeatData.length > 0 && `(${heartbeatData.length})`}
                                           </span>
                                         )}
                                         {hasAbnormalSection && (
                                           <span 
                                             onClick={() => setSelectedDocumentIndex(selectedDocumentIndex === 'abnormal' ? null : 'abnormal')}
                                             className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-md ${
                                               selectedDocumentIndex === 'abnormal' 
                                                 ? 'bg-blue-500 text-white border-blue-500' 
                                                 : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                                             }`}
                                           >
                                             <span className={`w-2 h-2 rounded-full mr-2 ${
                                               selectedDocumentIndex === 'abnormal' ? 'bg-white' : 'bg-blue-400'
                                             }`}></span>
                                             <AlertTriangle className="w-3 h-3 mr-1" />
                                             异常事件 {abnormalData.length > 0 && `(${abnormalData.length})`}
                                           </span>
                                         )}
                                         <span 
                                           onClick={() => setSelectedDocumentIndex(selectedDocumentIndex === 'raw' ? null : 'raw')}
                                           className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-md ${
                                             selectedDocumentIndex === 'raw' 
                                               ? 'bg-gray-500 text-white border-gray-500' 
                                               : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                                           }`}
                                         >
                                           <span className={`w-2 h-2 rounded-full mr-2 ${
                                             selectedDocumentIndex === 'raw' ? 'bg-white' : 'bg-gray-400'
                                           }`}></span>
                                           <FileText className="w-3 h-3 mr-1" />
                                           完整数据
                                         </span>
                                       </div>
                                       
                                       {/* 展开的内容 */}
                                       {selectedDocumentIndex === 'heartbeat' && hasHeartbeatSection && (
                                         <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                           <div className="flex items-center justify-between mb-3">
                                             <h4 className="font-semibold text-gray-800 text-sm flex items-center">
                                               <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                                               心跳记录详情
                                             </h4>
                                             <button
                                               onClick={() => setSelectedDocumentIndex(null)}
                                               className="text-gray-500 hover:text-gray-700 text-sm"
                                             >
                                               关闭
                                             </button>
                                           </div>
                                           <div className="bg-white p-3 rounded border text-sm text-gray-700 space-y-3">
                                             {heartbeatData.length > 0 ? (
                                               <>
                                                 <div className="text-gray-600 mb-3">
                                                   设备心跳记录详情：
                                                 </div>
                                                 <div className="space-y-3">
                                                   {heartbeatData.map((item, index) => (
                                                     <div key={index} className="flex items-start space-x-3">
                                                       <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                                       <div className="flex-1">
                                                         <div className="font-semibold text-gray-800">{item.time}</div>
                                                         <div className="text-gray-600 mt-1">心跳次数: {item.count}</div>
                                                         <div className="text-gray-600">更新时间: {item.updateTime}</div>
                                                       </div>
                                                     </div>
                                                   ))}
                                                 </div>
                                               </>
                                             ) : (
                                               <div className="text-gray-600">
                                                 未找到心跳记录数据
                                               </div>
                                             )}
                                           </div>
                                         </div>
                                       )}
                                       
                                       {selectedDocumentIndex === 'abnormal' && hasAbnormalSection && (
                                         <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                           <div className="flex items-center justify-between mb-3">
                                             <h4 className="font-semibold text-gray-800 text-sm flex items-center">
                                               <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                                               异常事件详情
                                             </h4>
                                             <button
                                               onClick={() => setSelectedDocumentIndex(null)}
                                               className="text-gray-500 hover:text-gray-700 text-sm"
                                             >
                                               关闭
                                             </button>
                                           </div>
                                           <div className="bg-white p-3 rounded border text-sm text-gray-700 space-y-3">
                                             {abnormalData.length > 0 ? (
                                               <>
                                                 <div className="text-gray-600 mb-3">
                                                   设备异常事件详情：
                                                 </div>
                                                 <div className="space-y-4">
                                                   {abnormalData.map((item, index) => (
                                                     <div key={index} className="border-l-4 border-red-400 pl-3">
                                                       <div className="font-semibold text-gray-800 mb-2">{item.time}</div>
                                                       <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-700 overflow-x-auto">
                                                         {item.payload}
                                                       </div>
                                                     </div>
                                                   ))}
                                                 </div>
                                               </>
                                             ) : (
                                               <div className="text-gray-600">
                                                 未找到异常事件数据
                                               </div>
                                             )}
                                           </div>
                                         </div>
                                       )}
                                       
                                       {selectedDocumentIndex === 'raw' && (
                                         <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                           <div className="flex items-center justify-between mb-3">
                                             <h4 className="font-semibold text-gray-800 text-sm flex items-center">
                                               <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                               完整原始数据
                                             </h4>
                                             <button
                                               onClick={() => setSelectedDocumentIndex(null)}
                                               className="text-gray-500 hover:text-gray-700 text-sm"
                                             >
                                               关闭
                                             </button>
                                           </div>
                                           <div className="bg-white p-3 rounded border text-sm text-gray-700 space-y-3">
                                             <div className="text-gray-600 mb-3">
                                               后端返回的完整数据内容：
                                             </div>
                                             <div className="bg-gray-50 p-3 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
                                               <pre className="whitespace-pre-wrap text-xs font-mono text-gray-800">
                                                 {result}
                                               </pre>
                                             </div>
                                             <div className="text-xs text-gray-500 mt-2">
                                               如果上面的解析结果不完整，请查看此完整数据以获取所有信息。
                                             </div>
                                           </div>
                                         </div>
                                       )}
                                     </div>
                                   );
                                 } else {
                                   // 没有结构化数据，直接格式化显示完整内容
                                   return (
                                     <div className="space-y-4">
                                       {/* 标签按钮 - 只显示完整数据 */}
                                       <div className="flex flex-wrap gap-2 mb-4">
                                         <span 
                                           onClick={() => setSelectedDocumentIndex(selectedDocumentIndex === 'raw' ? null : 'raw')}
                                           className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-md ${
                                             selectedDocumentIndex === 'raw' 
                                               ? 'bg-gray-500 text-white border-gray-500' 
                                               : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                                           }`}
                                         >
                                           <span className={`w-2 h-2 rounded-full mr-2 ${
                                             selectedDocumentIndex === 'raw' ? 'bg-white' : 'bg-gray-400'
                                           }`}></span>
                                           <FileText className="w-3 h-3 mr-1" />
                                           完整数据
                                         </span>
                                       </div>
                                       
                                       {/* 默认显示格式化内容 */}
                                       {selectedDocumentIndex !== 'raw' && (
                                         <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                           <div className="bg-white p-4 rounded border text-sm text-gray-700">
                                             <div className="text-gray-600 mb-3">
                                               设备数据分析结果：
                                             </div>
                                             <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                                               {result}
                                             </div>
                                           </div>
                                         </div>
                                       )}
                                       
                                       {/* 完整数据展开 */}
                                       {selectedDocumentIndex === 'raw' && (
                                         <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                           <div className="flex items-center justify-between mb-3">
                                             <h4 className="font-semibold text-gray-800 text-sm flex items-center">
                                               <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                               完整原始数据
                                             </h4>
                                             <button
                                               onClick={() => setSelectedDocumentIndex(null)}
                                               className="text-gray-500 hover:text-gray-700 text-sm"
                                             >
                                               关闭
                                             </button>
                                           </div>
                                           <div className="bg-white p-3 rounded border text-sm text-gray-700 space-y-3">
                                             <div className="text-gray-600 mb-3">
                                               后端返回的完整数据内容：
                                             </div>
                                             <div className="bg-gray-50 p-3 rounded-md border border-gray-200 max-h-96 overflow-y-auto">
                                               <pre className="whitespace-pre-wrap text-xs font-mono text-gray-800">
                                                 {result}
                                               </pre>
                                             </div>
                                             <div className="text-xs text-gray-500 mt-2">
                                               如果上面的解析结果不完整，请查看此完整数据以获取所有信息。
                                             </div>
                                           </div>
                                         </div>
                                       )}
                                     </div>
                                   );
                                 }
                              }
                              
                              // 默认显示原始数据
                              return (
                                <div className="text-gray-700">
                                  <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(aiotSummary, null, 2)}</pre>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

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