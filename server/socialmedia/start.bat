@echo off
chcp 65001 >nul
echo 🚀 启动社媒AI分析工具 - Dash Social v1.0

REM 检查Python环境
echo 📋 检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 未安装，请先安装Python 3.8+
    pause
    exit /b 1
)

REM 检查Node.js环境
echo 📋 检查Node.js环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装Node.js 16+
    pause
    exit /b 1
)

echo ✅ 环境检查通过

REM 创建日志目录
if not exist logs mkdir logs

REM 安装后端依赖
echo 📦 安装后端依赖...
cd backend

REM 直接安装依赖到全局环境
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)

REM 安装前端依赖
echo 📦 安装前端依赖...
cd ..\frontend
if not exist node_modules (
    npm install
    if errorlevel 1 (
        echo ❌ 前端依赖安装失败
        pause
        exit /b 1
    )
)

echo ✅ 依赖安装完成

REM 启动后端服务
echo 🔧 启动后端服务...
cd ..\backend
start /b python app.py > ..\logs\backend.log 2>&1

REM 等待后端启动
timeout /t 3 /nobreak >nul

REM 启动前端服务
echo 🎨 启动前端服务...
cd ..\frontend
start /b npm run dev > ..\logs\frontend.log 2>&1

REM 等待前端启动
timeout /t 5 /nobreak >nul

echo.
echo 🎉 服务启动完成！
echo 📍 前端地址: http://localhost:3002
echo 📍 后端地址: http://localhost:9002
echo.
echo 📝 日志文件:
echo    后端日志: logs\backend.log
echo    前端日志: logs\frontend.log
echo.
echo 🛑 停止服务: stop.bat
echo.

REM 自动打开浏览器
echo 🌐 正在打开浏览器...
timeout /t 2 /nobreak >nul
start http://localhost:3002

echo 按任意键退出脚本...
pause >nul