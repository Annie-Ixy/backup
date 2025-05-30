import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Brain, Sparkles, Zap, Cpu } from 'lucide-react';
import { api } from '../utils/request';
import CryptoJS from 'crypto-js';
import Toast from '../components/Toast';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ isVisible: false, type: 'info', message: '' });
  const navigate = useNavigate();

  // 显示 Toast 的辅助函数
  const showToast = (type, message) => {
    setToast({ isVisible: true, type, message });
  };

  // 隐藏 Toast 的函数
  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  // 检查是否已经有token，如果有就直接跳转到home页面
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      navigate('/home');
    }
    
    // 读取保存的账号密码
    const savedUsername = localStorage.getItem('savedUsername');
    const savedPassword = localStorage.getItem('savedPassword');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (savedRememberMe && savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 防止重复提交
    if (isLoading) return;
    
    // 简单的登录验证，实际项目中应该调用API
    if (username && password) {
      setIsLoading(true);
      
      // 存储登录状态
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', username);
      
      // 处理记住账号密码
      if (rememberMe) {
        localStorage.setItem('savedUsername', username);
        localStorage.setItem('savedPassword', password);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('savedPassword');
        localStorage.removeItem('rememberMe');
      }
      
      try {
        // 对密码进行MD5加密
        const passwordMd5 = CryptoJS.enc.Utf8.parse(password);
        const encryptedPassword = CryptoJS.enc.Base64.stringify(passwordMd5);
        
        const res = await api.post('/dev-api/udap/admin/login', {
          username,
          password: encryptedPassword
        })
        if (res.code === 0) {
            sessionStorage.setItem('token', res.data.token);
            showToast('success', 'Login successful, redirecting...');
            // 延迟跳转，让用户看到成功提示
            setTimeout(() => {
              navigate('/home');
            }, 1000);
        } else {
            showToast('error', res.msg || 'Login failed, please check your username and password');
        }
      } catch (error) {
        console.log(error);
        showToast('error', '登录失败，请检查网络连接');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Toast 组件 */}
      <Toast
        type={toast.type}
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 relative z-10"
      >
        <div className="text-center mb-8">
          {/* 改进的Logo设计 */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, duration: 0.8 }}
            className="mx-auto relative mb-6"
          >
            {/* 主要logo容器 */}
            <div className="relative w-20 h-20 mx-auto">
              {/* 外圈渐变背景 */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-600 to-cyan-500 rounded-2xl animate-pulse"></div>
              
              {/* 内圈背景 */}
              <div className="absolute inset-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center">
                {/* AI大脑图标 */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="relative"
                >
                  <Brain className="h-8 w-8 text-cyan-400" />
                </motion.div>
                
                {/* 装饰性的小元素 */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="h-3 w-3 text-yellow-400" />
                </motion.div>
                
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                  className="absolute -bottom-1 -left-1"
                >
                  <Zap className="h-3 w-3 text-blue-400" />
                </motion.div>
                
                <motion.div
                  animate={{ rotate: [0, 180, 360], opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                  className="absolute top-1 left-1"
                >
                  <Cpu className="h-2 w-2 text-purple-400" />
                </motion.div>
              </div>
              
              {/* 光晕效果 */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -inset-2 bg-gradient-to-br from-blue-500/20 via-purple-600/20 to-cyan-500/20 rounded-3xl blur-sm"
              ></motion.div>
            </div>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-bold bg-gradient-to-r from-slate-700 via-purple-700 to-slate-700 bg-clip-text text-transparent"
          >
            欢迎登录
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-slate-600 mt-2 font-medium"
          >
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI智能工具平台</span>
          </motion.p>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-slate-500 text-sm mt-1"
          >
            赋能智慧决策，开启未来之门
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80"
                placeholder="请输入用户名/邮箱"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80"
                placeholder="请输入密码"
                required
              />
            </div>
          </div>
          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
              记住账号密码
            </label>
          </div>

          <motion.button
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center justify-center ${
              isLoading 
                ? 'bg-gradient-to-r from-purple-400 to-blue-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
            } text-white`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}

export default Login; 