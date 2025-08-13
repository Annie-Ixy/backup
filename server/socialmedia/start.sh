#!/bin/bash

# 社媒AI分析工具启动脚本
# 用于快速启动前后端服务

echo "🚀 启动社媒AI分析工具 - Dash Social v1.0"

# 检查Python环境
echo "📋 检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装Python 3.8+"
    exit 1
fi

# 检查Node.js环境
echo "📋 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装Node.js 16+"
    exit 1
fi

# 检查pip和npm
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 未安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ 环境检查通过"

# 安装后端依赖
echo "📦 安装后端依赖..."
cd backend

pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi

# 安装前端依赖
echo "📦 安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败"
        exit 1
    fi
fi

echo "✅ 依赖安装完成"

# 启动后端服务
echo "🔧 启动后端服务..."
cd ../backend
nohup python3 app.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端启动
sleep 3

# 启动前端服务
echo "🎨 启动前端服务..."
cd ../frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端服务已启动 (PID: $FRONTEND_PID)"

# 创建日志目录
mkdir -p ../logs

# 保存进程ID
echo $BACKEND_PID > ../logs/backend.pid
echo $FRONTEND_PID > ../logs/frontend.pid

echo ""
echo "🎉 服务启动完成！"
echo "📍 前端地址: http://localhost:3002"
echo "📍 后端地址: http://localhost:9002"
echo ""
echo "📝 日志文件:"
echo "   后端日志: logs/backend.log"
echo "   前端日志: logs/frontend.log"
echo ""
echo "🛑 停止服务: ./stop.sh"
echo ""

# 等待用户操作
echo "按 Ctrl+C 查看实时日志，或输入 'quit' 退出脚本"
while true; do
    read -t 1 input
    if [ "$input" = "quit" ]; then
        break
    fi
done