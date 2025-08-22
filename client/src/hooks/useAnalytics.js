import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordToolVisit } from '../services/analyticsApi';

// 路由路径到工具标识的映射
const ROUTE_TO_TOOL_MAP = {
  '/': 'home',
  '/home': 'home',
  '/customer-service': 'customer-service',
  '/design-review': 'design-review',
  '/questionnaire-analysis': 'questionnaire-analysis',
  '/resume': 'resume',
  '/social-media': 'social-media',
  '/voice-cloning': 'voice-cloning'
};

// 获取用户名
const getUsername = () => {
  return localStorage.getItem('username') || sessionStorage.getItem('username') || 'unknown';
};

// 使用访问统计的Hook
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    console.log('🔍 useAnalytics triggered, current path:', location.pathname);
    console.log('🔍 RouteInterceptor component rendered');
    
    // 获取当前路径对应的工具标识
    const toolKey = ROUTE_TO_TOOL_MAP[location.pathname];
    
    if (toolKey) {
      const username = getUsername();
      console.log(`✅ 准备记录工具访问: ${toolKey}, 用户: ${username}`);
      
      // 异步记录访问，不等待结果
      recordToolVisit(toolKey, username).then(result => {
        if (result && result.success) {
          console.log(`✅ 已记录 ${toolKey} 工具的访问，用户: ${username}`);
        } else {
          console.error(`❌ 记录 ${toolKey} 工具访问失败:`, result);
        }
      }).catch(error => {
        console.error(`❌ 记录 ${toolKey} 工具访问出错:`, error);
      });
    } else {
      console.log(`⚠️ 路径 ${location.pathname} 没有对应的工具映射`);
      console.log('🔍 可用的路径映射:', Object.keys(ROUTE_TO_TOOL_MAP));
    }
  }, [location.pathname]);

  // 手动记录工具访问的函数
  const recordVisit = (toolKey) => {
    const username = getUsername();
    console.log(`🔄 手动记录工具访问: ${toolKey}, 用户: ${username}`);
    recordToolVisit(toolKey, username).then(result => {
      if (result && result.success) {
        console.log(`✅ 已记录 ${toolKey} 工具的访问，用户: ${username}`);
      } else {
        console.error(`❌ 记录 ${toolKey} 工具访问失败:`, result);
      }
    }).catch(error => {
      console.error(`❌ 记录 ${toolKey} 工具访问出错:`, error);
    });
  };

  return { recordVisit };
}; 