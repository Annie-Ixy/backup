import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, User, TrendingUp } from 'lucide-react';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

const Analytics = () => {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || '用户';

  const handleBackToHome = () => {
    navigate('/home');
  };

  const handleLogout = () => {
    // 清除所有本地存储的认证信息
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
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
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI工具使用统计</h1>
                <p className="text-sm text-gray-500">AI驱动的智能数据分析和可视化平台</p>
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

      <AnalyticsDashboard />
    </div>
  );
};

export default Analytics; 