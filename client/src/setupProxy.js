const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 统一后端API代理 - 所有API请求都指向端口9000
  // 简历筛选测试API代理
  app.use(
    '/test',
    createProxyMiddleware({
      target: 'http://localhost:9000',
      changeOrigin: true,
      pathRewrite: {
        '^/test': '', // 将 /test 重写为 ''
      },
      logLevel: 'debug',
      secure: false,
    })
  );

  // 用户认证API代理
  app.use(
    '/dev-api',
    createProxyMiddleware({
      target: 'https://test-udap-api.dl-aiot.com',
      changeOrigin: true,
      pathRewrite: {
        '^/dev-api': '', // 移除 /dev-api 前缀
      },
      secure: true,
      logLevel: 'debug',
    })
  );
    // 用户认证API代理
    app.use(
      '/dev-api-py',
      createProxyMiddleware({
        target: 'http://localhost:9001',
        changeOrigin: true,
        pathRewrite: {
          '^/dev-api': '', // 移除 /dev-api 前缀
        },
        secure: true,
        logLevel: 'debug',
      })
    );

  // 客服系统API代理
  app.use(
    '/customer-service',
    createProxyMiddleware({
      target: 'http://10.53.184.254:6573',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('代理请求:', req.method, req.url, '->', proxyReq.path);
        console.log('目标URL:', proxyReq.getHeader('host'), proxyReq.path);
        console.log('原始路径:', req.url);
        console.log('重写后路径:', proxyReq.path);
        // 确保请求头正确
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json');
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('代理响应:', proxyRes.statusCode, req.url);
      },
      onError: (err, req, res) => {
        console.error('代理错误:', err.message);
      },
    })
  );
    // 社媒分析API代理
    app.use(
      '/socialmedia',
      createProxyMiddleware({
        target: 'http://10.53.184.254:9002',
        changeOrigin: true,
        pathRewrite: {
          '^/socialmedia': '', // 移除 /socialmedia 前缀
        },
        secure: true,
        logLevel: 'debug',
      })
    );
};