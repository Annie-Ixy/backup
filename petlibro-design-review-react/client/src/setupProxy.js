const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:9000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request:', req.method, req.path, '-> http://localhost:9000' + req.path);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
      }
    })
  );
}; 