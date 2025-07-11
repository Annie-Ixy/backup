@echo off
echo 🚀 启动所有服务...
echo.

echo 📝 端口分配:
echo   - Node.js 后端 (简历筛选+设计审查): 9000
echo   - Python 后端 (问卷分析): 9001  
echo   - React 前端: 3000
echo.

echo 🔧 启动 Node.js 后端 (端口9000)...
start "Node.js Backend" cmd /k "cd server && npm run dev"

echo 🔧 启动 Python 后端 (端口9001)...
start "Python Backend" cmd /k "cd server/questionnaire && python main.py"

echo 🔧 启动 React 前端 (端口3000)...
start "React Frontend" cmd /k "cd client && npm start"

echo.
echo ✅ 所有服务启动命令已发送
echo 📝 请等待各服务启动完成
echo.
echo 🌐 访问地址:
echo   - 前端应用: http://localhost:3000
echo   - Node.js API: http://localhost:9000
echo   - Python API: http://localhost:9001
echo.

pause 