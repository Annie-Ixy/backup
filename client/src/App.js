import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Resume from './pages/Resume';
import DesignReview from './pages/DesignReview';
import QuestionnaireAnalysis from './pages/QuestionnaireAnalysis';
import CustomerService from './pages/CustomerService';
import ProtectedRoute from './components/ProtectedRoute';
import SocialMedia from './pages/Socialmedia.js';
import VoiceCloning from './pages/VoiceCloning';
import Analytics from './pages/Analytics';
import ScrollToTop from './components/ScrollToTop';
import { isLogin } from './utils/index.ts';
import { useAnalytics } from './hooks/useAnalytics';

// 路由拦截组件 - 只负责登录检查
function RouteInterceptor() {
  const location = useLocation();
  const navigate = useNavigate();
  
  console.log('🚀 RouteInterceptor 组件渲染，当前路径:', location.pathname);
  
  // 在路由切换时调用 isLogin 方法
  useEffect(() => {
    console.log('🔄 RouteInterceptor useEffect 触发，路径变化:', location.pathname);
    
    const checkLoginStatus = async () => {
      try {
        const res = await isLogin();
        if (!res) {
          console.log('❌ 登录检查失败，跳转到登录页');
          navigate('/login');
        } else {
          console.log('✅ 登录检查成功');
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        navigate('/login');
      }
    };
    
    // 如果路径包含 /api/pdf，不做登录检查
    if (location.pathname.includes('/api/pdf')) {
      console.log('📄 PDF路径，跳过登录检查');
      return;
    }
    
    // 每次路由切换都调用 isLogin 方法
    checkLoginStatus();
  }, [location.pathname, navigate]);
  
  // 返回null，让useEffect处理导航
  return null;
}

// 全局路由监听组件
function GlobalRouteListener() {
  const location = useLocation();
  
  // 使用访问统计Hook - 监听所有路由变化
  useAnalytics();
  
  // 返回null，只用于监听路由变化
  return null;
}

function App() {
  console.log('🎯 App 组件渲染');
  
  return (
    <Router>
      <ScrollToTop />
      {/* 全局路由监听器 - 监听所有路由变化 */}
      <GlobalRouteListener />
      
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

        <Route 
            path="/customer-service" 
            element={
              <ProtectedRoute>
                <CustomerService />
              </ProtectedRoute>
            } 
          />

        <Route 
          path="/social-media" 
          element={
            <ProtectedRoute>
              <SocialMedia />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/voice-cloning" 
          element={
            <ProtectedRoute>
              <VoiceCloning />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <Analytics />
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