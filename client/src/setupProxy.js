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
};