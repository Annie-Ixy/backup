import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  LogOut, 
  User, 
  Upload, 
  Image,
  Brain,
  Zap,
  Palette,
  TrendingUp,
  ClipboardList,
  Bot
} from 'lucide-react';
import resumeIcon from '../assets/resume-icon.png';
import designReviewIcon from '../assets/design-review-icon.png';
import questionnaireAnalysisIcon from '../assets/questionnaire-analysis-icon.png';
import customerServiceIcon from '../assets/customer-service.png';
import { isLogin } from '../utils/index.ts';

// 工具图标组件
const ToolIcon = ({ type, color }) => {
  const iconSize = 80;
  
  // 颜色映射函数
  const getColorValue = (bgColor) => {
    const colorMap = {
      'bg-blue-600': '#2563eb',
      'bg-purple-600': '#9333ea',
      'bg-green-600': '#16a34a',
      'bg-red-600': '#dc2626',
      'bg-cyan-600': '#0891b2'
    };
    return colorMap[bgColor] || '#6b7280';
  };
  
  switch (type) {
    case 'resume':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <rect x="20" y="20" width="40" height="50" rx="4" fill="white" opacity="0.9"/>
          <path d="M25 30h30M25 40h20M25 50h25M25 60h15" stroke={getColorValue(color)} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="60" cy="35" r="3" fill={getColorValue(color)}/>
          <path d="M55 40l5 5-5 5" stroke={getColorValue(color)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'design-review':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <path d="M20 25h40M20 35h40M20 45h25M20 55h35" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="55" cy="45" r="8" fill="white" opacity="0.9"/>
          <path d="M52 45l2 2 4-4" stroke={getColorValue(color)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'questionnaire-analysis':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <rect x="20" y="20" width="40" height="40" rx="4" fill="white" opacity="0.9"/>
          <path d="M25 30h30M25 40h20M25 50h25" stroke={getColorValue(color)} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="55" cy="40" r="3" fill={getColorValue(color)}/>
          <circle cx="55" cy="50" r="3" fill={getColorValue(color)}/>
        </svg>
      );
    case 'customer-service':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <circle cx="40" cy="30" r="12" fill="white" opacity="0.9"/>
          <path d="M25 50c0-8.284 6.716-15 15-15s15 6.716 15 15" fill="white" opacity="0.9"/>
          <circle cx="35" cy="28" r="2" fill={getColorValue(color)}/>
          <circle cx="45" cy="28" r="2" fill={getColorValue(color)}/>
          <path d="M35 35c0 2.5 2.5 4 5 4s5-1.5 5-4" stroke={getColorValue(color)} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'competitor-analysis':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <path d="M20 60L30 40L45 50L60 25L80 35" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="30" cy="40" r="4" fill="white"/>
          <circle cx="45" cy="50" r="4" fill="white"/>
          <circle cx="60" cy="25" r="4" fill="white"/>
          <circle cx="80" cy="35" r="4" fill="white"/>
        </svg>
      );
    case 'image':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <rect x="15" y="20" width="50" height="40" rx="4" fill="white" opacity="0.9"/>
          <circle cx="30" cy="35" r="6" fill={getColorValue(color)}/>
          <path d="M20 50l10-10 5 5 10-10 15 15" stroke={getColorValue(color)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'social-media-analysis':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" rx="16" fill={getColorValue(color)} />
          <circle cx="25" cy="25" r="8" fill="white" opacity="0.9"/>
          <circle cx="55" cy="25" r="8" fill="white" opacity="0.9"/>
          <circle cx="40" cy="55" r="8" fill="white" opacity="0.9"/>
          <path d="M25 25L40 55M55 25L40 55" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="25" cy="25" r="3" fill={getColorValue(color)}/>
          <circle cx="55" cy="25" r="3" fill={getColorValue(color)}/>
          <circle cx="40" cy="55" r="3" fill={getColorValue(color)}/>
        </svg>
      );
    default:
      return null;
  }
};

  function Home() {
    const isLoginChecked = useRef(false);
    const navigate = useNavigate();
    const username = localStorage.getItem('username') || '用户';

    useEffect(() => {
      if (!isLoginChecked.current) {
        isLoginChecked.current = true;
        // isLogin().then(res => {
        //   if (!res) {
        //     navigate('/login');
        //   }
        // })
      }
    }, [])

    const deleteFile = async () => {
      try {
        const res = await fetch('/test/api/design-review/clear-folders', {
          method: 'DELETE',
          body: JSON.stringify({
            folders: ['outputs', 'uploads']
          })
        })
        console.log(res) 
      } catch (error) {
        throw error(error || '删除文件失败')
      }
    }

    // 将 deleteFile 方法暴露到全局，方便在控制台调用
    useEffect(() => {
      window.deleteFile = deleteFile;
    }, []);

    const handleLogout = () => {
      // 清除所有本地存储的认证信息
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('username');
      sessionStorage.removeItem('token');
      navigate('/login');
    };

    const handleGoToResume = () => {
      navigate('/resume');
    };

    const handleGoToDesignReview = () => {
      navigate('/design-review');
    };

    const handleGoToHome = () => {
      navigate('/home');
    };

    const handleGoToQuestionnaireAnalysis = () => {
      navigate('/questionnaire-analysis');
    };

    const handleGoToCustomerService = () => {
      navigate('/customer-service');
    };

    const handleGoToSocialMediaAnalysis = () => {
      // 社媒分析功能，暂时显示提示信息
      alert('社媒分析功能即将上线，敬请期待！');
    };

    // AI工具模块配置
    const aiTools = [
      {
        id: 'resume',
        title: '简历筛选',
        description: '使用AI技术快速分析和排序候选人简历，找到最合适的人才',
        image: resumeIcon,
        icon: Upload,
        iconType: 'resume',
        color: 'bg-blue-600',
        hoverColor: 'hover:bg-blue-700',
        action: handleGoToResume,
        available: true
      },
      {
        id: 'design-review',
        title: '设计稿审核',
        description: '通过AI工具提高设计稿审核准确度和效率，自动检测设计问题',
        image: designReviewIcon,
        icon: Palette,
        iconType: 'design-review',
        color: 'bg-purple-600',
        hoverColor: 'hover:bg-purple-700',
        action: handleGoToDesignReview,
        available: true
      },
      {
        id: 'questionnaire-analysis',
        title: '问卷文本分析',
        description: '智能分析问卷文本数据，提取关键信息，生成深度洞察报告',
        image: questionnaireAnalysisIcon,
        icon: ClipboardList,
        iconType: 'questionnaire-analysis',
        color: 'bg-green-600',
        hoverColor: 'hover:bg-green-700',
        action: handleGoToQuestionnaireAnalysis,
        available: true
      },
      {
        id: 'customer-service',
        title: '智能客服中心',
        description: 'AI驱动的故障诊断与解决方案推荐系统，提供专业的技术支持服务',
        image: customerServiceIcon,
        icon: Bot,
        iconType: 'customer-service',
        color: 'bg-red-600',
        hoverColor: 'hover:bg-red-700',
        action: handleGoToCustomerService,
        available: true
      },
      {
        id: 'social-media-analysis',
        title: '社媒分析',
        description: '智能分析社交媒体数据，监控品牌声誉，洞察用户情感和趋势变化',
        image: null,
        icon: TrendingUp,
        iconType: 'social-media-analysis',
        color: 'bg-orange-600',
        hoverColor: 'hover:bg-orange-700',
        action: () => navigate('/social-media'),
        available: true
      },
      {
        id: 'competitor-analysis',
        title: '竞品分析',
        description: '智能分析竞争对手产品特性、市场策略和用户反馈，生成专业竞品分析报告',
        image: null,
        icon: TrendingUp,
        iconType: 'competitor-analysis',
        color: 'bg-green-600',
        hoverColor: 'hover:bg-green-700',
        action: () => {},
        available: false
      },
      {
        id: 'image',
        title: '图像分析',
        description: '上传图片进行AI分析，识别内容、提取文字和分析特征',
        image: null,
        icon: Image,
        iconType: 'image',
        color: 'bg-cyan-600',
        hoverColor: 'hover:bg-cyan-700',
        action: () => {},
        available: false
      }
    ];

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div 
                className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity duration-200" 
                onClick={handleGoToHome}
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">AI智能工具平台</h1>
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              AI智能工具平台
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              集成多种AI工具，提高工作效率，简化复杂任务
            </p>
          </motion.div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {aiTools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 h-80 ${
                  tool.available ? 'hover:scale-105 hover:-translate-y-2' : 'opacity-75'
                }`}
              >
                {/* 背景图片或图标 */}
                {tool.image ? (
                  <div className="absolute inset-0">
                    <img 
                      src={tool.image} 
                      alt={tool.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex justify-center bg-gray-100 p-10">
                    <div>
                      <ToolIcon type={tool.iconType} color={tool.color} />
                    </div>
                  </div>
                )}
                
                {/* 渐变遮罩层 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                
                {/* 背景装饰条 */}
                <div className={`absolute top-0 left-0 w-full h-1 ${tool.color} opacity-80`}></div>
                
                {/* 可用状态标识 */}
                {tool.available && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
                
                {/* 即将上线标识 */}
                {!tool.available && (
                  <div className="absolute top-4 right-4 bg-gray-500 text-white text-xs px-3 py-1 rounded-full font-medium z-10">
                    即将上线
                  </div>
                )}
                
                {/* 内容区域 - 覆盖在遮罩上 */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-3 text-center">
                    {tool.title}
                  </h3>
                  
                  <p className="text-gray-200 mb-6 min-h-[48px] text-center leading-relaxed">
                    {tool.description}
                  </p>
                  
                  <button
                    className={`w-full ${tool.color} ${tool.hoverColor} text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg ${
                      !tool.available ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'
                    }`}
                    disabled={!tool.available}
                    onClick={tool.available ? tool.action : undefined}
                  >
                    {tool.available ? '立即使用' : '敬请期待'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-20 bg-white rounded-xl shadow-lg p-12"
          >
            <div className="text-center mb-12">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                为什么选择我们的AI工具平台？
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">智能高效</h4>
                <p className="text-gray-600">采用最新AI技术，提供快速准确的智能分析</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">简单易用</h4>
                <p className="text-gray-600">直观的用户界面，无需复杂配置即可使用</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">多种工具</h4>
                <p className="text-gray-600">集成多种AI工具，满足不同场景需求</p>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  export default Home; 