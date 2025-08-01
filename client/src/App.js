import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Resume from './pages/Resume';
import DesignReview from './pages/DesignReview';
import QuestionnaireAnalysis from './pages/QuestionnaireAnalysis';
import ProtectedRoute from './components/ProtectedRoute';
import { isLogin } from './utils/index.ts';

// 路由拦截组件
function RouteInterceptor() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 在路由切换时调用 isLogin 方法
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const res = await isLogin();
        if (!res) {
          navigate('/login');
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        navigate('/login');
      }
    };
    
    // 如果路径包含 /api/pdf，不做拦截处理
    if (location.pathname.includes('/api/pdf')) {
      return;
    }
    
    // 每次路由切换都调用 isLogin 方法
    checkLoginStatus();
  }, [location.pathname, navigate]); // 添加navigate到依赖项
  
  // 返回null，让useEffect处理导航
  return null;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* 默认路由 - 路由拦截判断 */}
        <Route path="/" element={<RouteInterceptor />} />
        
        {/* 登录页面 */}
        <Route path="/login" element={<Login />} />
        
        {/* 受保护的路由 */}
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/resume" 
          element={
            <ProtectedRoute>
              <Resume />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/design-review" 
          element={
            <ProtectedRoute>
              <DesignReview />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/questionnaire-analysis" 
          element={
            <ProtectedRoute>
              <QuestionnaireAnalysis />
            </ProtectedRoute>
          } 
        />
        
        {/* 404页面 - 使用路由拦截逻辑 */}
        <Route path="*" element={<RouteInterceptor />} />
      </Routes>
    </Router>
  );
}

export default App; 