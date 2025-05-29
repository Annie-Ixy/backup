import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Resume from './pages/Resume';
import ProtectedRoute from './components/ProtectedRoute';

// 路由拦截组件
function RouteInterceptor() {
  const location = useLocation();
  
  // 如果路径包含 /api/pdf，不做拦截处理
  if (location.pathname.includes('/api/pdf')) {
    return null;
  }
  
  // 检查是否有token和登录状态
  const token = sessionStorage.getItem('token');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  
  // 如果有token或者已登录状态为true，说明已经登录了，直接跳转/home，否则跳转登录页面
  const hasValidAuth = token || isLoggedIn;
  
  return hasValidAuth ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />;
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
        
        {/* 404页面 - 使用路由拦截逻辑 */}
        <Route path="*" element={<RouteInterceptor />} />
      </Routes>
    </Router>
  );
}

export default App; 