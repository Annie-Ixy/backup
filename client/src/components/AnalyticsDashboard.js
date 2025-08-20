import React, { useState, useEffect } from 'react';
import { getToolStats, resetToolStats } from '../services/analyticsApi';

const AnalyticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 获取统计数据
  const fetchStats = async () => {
    try {
      setLoading(true);
      const result = await getToolStats();
      console.log(result);
      if (result) {
        setStats(result);
      } else {
        setError('获取统计数据失败');
      }
    } catch (error) {
      setError('获取统计数据时发生错误');
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 重置统计数据
  const handleReset = async () => {
    if (window.confirm('确定要重置所有统计数据吗？此操作不可恢复。')) {
      try {
        const result = await resetToolStats();
        if (result.success) {
          alert('统计数据已重置');
          fetchStats(); // 重新获取数据
        } else {
          alert('重置失败');
        }
      } catch (error) {
        alert('重置时发生错误');
        console.error('重置统计数据失败:', error);
      }
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '从未访问';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-red-500 text-lg">{error}</div>
        <button 
          onClick={fetchStats}
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-lg">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* 标题和操作按钮 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">工具访问统计</h1>
          <div className="flex gap-3">
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              刷新数据
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              重置统计
            </button>
          </div>
        </div>

        {/* 总访问量 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.totalVisits}</div>
            <div className="text-blue-800">总访问量</div>
            <div className="text-sm text-blue-600 mt-1">
              最后更新: {formatDate(stats.lastUpdated)}
            </div>
          </div>
        </div>

        {/* 工具统计列表 */}
        <div className="grid gap-4">
          {stats.tools.map((tool, index) => (
            <div 
              key={tool.toolKey}
              className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                index === 0 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {index === 0 && (
                      <span className="bg-yellow-400 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        最受欢迎
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-gray-800">
                      {tool.name}
                    </h3>
                    <span className="text-sm text-gray-500">({tool.toolKey})</span>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    <div>访问次数: <span className="font-semibold text-blue-600">{tool.visitCount}</span></div>
                    <div>首次访问: {formatDate(tool.firstVisit)}</div>
                    <div>最后访问: {formatDate(tool.lastVisit)}</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {tool.visitCount}
                  </div>
                  <div className="text-sm text-gray-500">次访问</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 数据说明 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">说明</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 统计数据在每次访问工具页面时自动更新</li>
            <li>• 访问次数统计的是页面加载次数，不是用户数量</li>
            <li>• 数据保存在服务器端的JSON文件中</li>
            <li>• 重置操作将清空所有统计数据，请谨慎使用</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 