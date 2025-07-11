const express = require('express');
const router = express.Router();

// 简单的用户数据（实际项目中应该使用数据库）
const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123', // 实际项目中应该加密存储
    email: 'admin@example.com',
    name: '管理员'
  },
  {
    id: 2,
    username: 'user',
    password: 'user123',
    email: 'user@example.com', 
    name: '普通用户'
  },
  {
    id: 3,
    username: 'city.chen@designlibro.com',
    password: 'password123',
    email: 'city.chen@designlibro.com',
    name: 'City Chen'
  }
];

// 生成简单的token
function generateToken(user) {
  return Buffer.from(JSON.stringify({
    id: user.id,
    username: user.username,
    timestamp: Date.now()
  })).toString('base64');
}

// 登录接口
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('登录请求:', { username, password });
    
    // 查找用户
    const user = users.find(u => 
      (u.username === username || u.email === username) && 
      u.password === password
    );
    
    if (user) {
      const token = generateToken(user);
      
      res.json({
        code: 0,
        msg: 'Login successful',
        data: {
          token: token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name
          }
        }
      });
    } else {
      res.status(401).json({
        code: 1,
        msg: 'Invalid username or password'
      });
    }
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      code: 500,
      msg: 'Server error'
    });
  }
});

// 验证token接口
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                 req.headers.token;
    
    if (!token) {
      return res.status(401).json({
        code: 1,
        msg: 'No token provided'
      });
    }
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const user = users.find(u => u.id === decoded.id);
      
      if (user) {
        res.json({
          code: 0,
          msg: 'Token valid',
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name
            }
          }
        });
      } else {
        res.status(401).json({
          code: 1,
          msg: 'Invalid token'
        });
      }
    } catch (e) {
      res.status(401).json({
        code: 1,
        msg: 'Invalid token format'
      });
    }
  } catch (error) {
    console.error('Token验证错误:', error);
    res.status(500).json({
      code: 500,
      msg: 'Server error'
    });
  }
});

// 用户信息接口（模拟产品概要接口）
router.get('/summary_card', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                 req.headers.token;
    
    if (!token) {
      return res.status(401).json({
        code: 1,
        msg: 'No token provided'
      });
    }
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      const user = users.find(u => u.id === decoded.id);
      
      if (user) {
        res.json({
          code: 0,
          msg: 'Success',
          data: {
            summary: 'AI智能工具平台概要信息',
            userInfo: {
              id: user.id,
              username: user.username,
              name: user.name
            }
          }
        });
      } else {
        res.status(401).json({
          code: 1,
          msg: 'Invalid token'
        });
      }
    } catch (e) {
      res.status(401).json({
        code: 1,
        msg: 'Invalid token format'
      });
    }
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      code: 500,
      msg: 'Server error'
    });
  }
});

module.exports = router; 