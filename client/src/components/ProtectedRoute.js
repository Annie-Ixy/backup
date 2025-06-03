import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  // 检查是否有token和登录状态
  const token = sessionStorage.getItem('token');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  
  // 如果有token或者已登录状态为true，说明已经登录了
  const hasValidAuth = token || isLoggedIn;
  
  return hasValidAuth ? children : <Navigate to="/login" replace />;
}

export default ProtectedRoute; 