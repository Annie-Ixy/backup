import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Loader2 } from 'lucide-react';
import { api } from '../utils/request';
import CryptoJS from 'crypto-js';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
            navigate('/home');
        } else {
            alert(res.msg);
        }
      } catch (error) {
        console.log(error);
        alert('登录失败，请检查网络连接');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-lg shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4"
          >
            <LogIn className="h-8 w-8 text-white" />
          </motion.div>
          <h2 className="text-3xl font-bold text-gray-900">欢迎登录</h2>
          <p className="text-gray-600 mt-2">AI简历筛选系统</p>
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center ${
              isLoading 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
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