@echo off
chcp 65001 >nul
echo 🛑 停止社媒AI分析工具服务...

REM 停止Python进程（Flask应用）
echo 🔧 停止后端服务...
taskkill /f /im python.exe >nul 2>&1
if errorlevel 1 (
    echo ⚠️  未找到Python进程
) else (
    echo ✅ 后端服务已停止
)

REM 停止Node.js进程（前端开发服务器）
echo 🎨 停止前端服务...
taskkill /f /im node.exe >nul 2>&1
if errorlevel 1 (
    echo ⚠️  未找到Node.js进程
) else (
    echo ✅ 前端服务已停止
)

REM 停止可能的vite进程
taskkill /f /fi "WINDOWTITLE eq vite*" >nul 2>&1

REM 清理可能占用端口的进程
echo 🧹 清理端口占用...
netstat -ano | findstr :3000 >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /f /pid %%a >nul 2>&1
    )
)

netstat -ano | findstr :5000 >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
        taskkill /f /pid %%a >nul 2>&1
    )
)

echo 🏁 所有服务已停止

echo 按任意键退出...
pause >nul