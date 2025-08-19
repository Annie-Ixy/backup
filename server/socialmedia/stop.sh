#!/bin/bash

# 社媒AI分析工具停止脚本

echo "🛑 停止社媒AI分析工具服务..."

# 停止后端服务
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null; then
        kill $BACKEND_PID
        echo "✅ 后端服务已停止 (PID: $BACKEND_PID)"
    else
        echo "⚠️  后端服务未运行"
    fi
    rm logs/backend.pid
else
    echo "⚠️  未找到后端进程ID文件"
fi

# 停止前端服务
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null; then
        kill $FRONTEND_PID
        echo "✅ 前端服务已停止 (PID: $FRONTEND_PID)"
    else
        echo "⚠️  前端服务未运行"
    fi
    rm logs/frontend.pid
else
    echo "⚠️  未找到前端进程ID文件"
fi

# 额外清理可能的端口占用
echo "🧹 清理端口占用..."
pkill -f "python app.py" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "🏁 所有服务已停止"