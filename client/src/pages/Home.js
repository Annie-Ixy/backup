import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  LogOut, 
  User, 
  Upload, 
  MessageSquare, 
  Image,
  BarChart3,
  FileSearch,
  Brain,
  Zap,
  Palette,
  TrendingUp
} from 'lucide-react';
import { isLogin } from '../utils/index.ts';

  function Home() {
    const isLoginChecked = useRef(false);
    const navigate = useNavigate();
    const username = localStorage.getItem('username') || '用户';

    useEffect(() => {
      if (!isLoginChecked.current) {
        isLoginChecked.current = true;
        isLogin().then(res => {
          if (!res) {
            navigate('/login');
          }
        })
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

    // AI工具模块配置
    const aiTools = [
      {
        id: 'resume',
        title: '简历筛选',
        description: '使用AI技术快速分析和排序候选人简历，找到最合适的人才',
        icon: Upload,
        color: 'bg-blue-600',
        hoverColor: 'hover:bg-blue-700',
        action: handleGoToResume,
        available: true
      },
      {
        id: 'design-review',
        title: '设计稿审核',
        description: '通过AI工具提高设计稿审核准确度和效率，自动检测设计问题',
        icon: Palette,
        color: 'bg-purple-600',
        hoverColor: 'hover:bg-purple-700',
        action: handleGoToDesignReview,
        available: true
      },
      {
        id: 'competitor-analysis',
        title: '竞品分析',
        description: '智能分析竞争对手产品特性、市场策略和用户反馈，生成专业竞品分析报告',
        icon: TrendingUp,
        color: 'bg-green-600',
        hoverColor: 'hover:bg-green-700',
        action: () => navigate('/competitor-analysis'),
        available: false
      },
      {
        id: 'chat',
        title: 'AI对话助手',
        description: '智能聊天机器人，帮助您解答问题和提供专业建议',
        icon: MessageSquare,
        color: 'bg-green-600',
        hoverColor: 'hover:bg-green-700',
        action: () => navigate('/chat'),
        available: false
      },
      {
        id: 'image',
        title: '图像分析',
        description: '上传图片进行AI分析，识别内容、提取文字和分析特征',
        icon: Image,
        color: 'bg-cyan-600',
        hoverColor: 'hover:bg-cyan-700',
        action: () => navigate('/image'),
        available: false
      },
      {
        id: 'analytics',
        title: '数据分析',
        description: '智能数据分析和可视化，生成深度洞察报告',
        icon: BarChart3,
        color: 'bg-orange-600',
        hoverColor: 'hover:bg-orange-700',
        action: () => navigate('/analytics'),
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
                className={`bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 cursor-pointer relative overflow-hidden ${
                  tool.available ? 'hover:scale-105' : 'opacity-75'
                }`}
                onClick={tool.available ? tool.action : undefined}
              >
                {/* 可用状态标识 */}
                {tool.available && (
                  <div className="absolute top-4 right-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                )}
                
                {/* 即将上线标识 */}
                {!tool.available && (
                  <div className="absolute top-4 right-4 bg-gray-500 text-white text-xs px-2 py-1 rounded-full">
                    即将上线
                  </div>
                )}

                <div className={`w-16 h-16 ${tool.color} rounded-full flex items-center justify-center mb-6`}>
                  <tool.icon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {tool.title}
                </h3>
                
                <p className="text-gray-600 mb-6 min-h-[48px]">
                  {tool.description}
                </p>
                
                <motion.button
                  whileHover={tool.available ? { scale: 1.05 } : {}}
                  whileTap={tool.available ? { scale: 0.95 } : {}}
                  className={`w-full ${tool.color} ${tool.hoverColor} text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md ${
                    !tool.available ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={!tool.available}
                >
                  {tool.available ? '立即使用' : '敬请期待'}
                </motion.button>
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