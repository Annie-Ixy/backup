const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // 首先代理 /api 到本地服务器 (更具体的路径要放在前面)
  app.use(
    '/test',
    createProxyMiddleware({
      target: 'http://localhost:9000',
      changeOrigin: true,
      pathRewrite: {
        '^/test': '', // 将 /test 重写为 ''
      },
      logLevel: 'debug', // 开启调试日志
      secure: false, // 本地开发不需要SSL验证
    })
  );

  // 然后代理其他 /dev-api 请求到远程服务器
  app.use(
    '/dev-api',
    createProxyMiddleware({
      target: 'https://test-udap-api.dl-aiot.com',
      changeOrigin: true,
      pathRewrite: {
        '^/dev-api': '', // 移除 /dev-api 前缀
      },
      secure: true, // 支持 HTTPS
      logLevel: 'debug', // 开启调试日志
    })
  );
}; 