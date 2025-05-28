import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Resume from './pages/Resume';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* 默认路由重定向到登录页 */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
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
        
        {/* 404页面 - 重定向到登录页 */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App; 