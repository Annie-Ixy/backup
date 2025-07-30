@echo off
echo ================================================
echo 在本地环境运行问卷分析服务 (脱离虚拟环境)
echo ================================================
echo.

REM 清除虚拟环境变量
set VIRTUAL_ENV=
set PYTHONHOME=
set CONDA_DEFAULT_ENV=

echo 检查Python环境...
where python
python --version
echo.

echo 导航到问卷分析目录...
cd /d "D:\code\DL\AI_tools\resume-screening-app\server\questionnaire"
echo 当前目录: %CD%
echo.

echo 检查并安装依赖包...
echo 正在检查核心依赖...
python -c "import flask" 2>nul || (
    echo 安装Flask...
    pip install Flask==2.3.3
)

python -c "import pandas" 2>nul || (
    echo 安装pandas...
    pip install pandas==2.0.3
)

python -c "import openpyxl" 2>nul || (
    echo 安装openpyxl...
    pip install openpyxl==3.1.2
)

echo 安装其余依赖包...
pip install flask-cors==4.0.0 werkzeug==2.3.7 numpy==1.24.3 scikit-learn==1.3.0 matplotlib==3.7.2 seaborn==0.12.2 xlrd==2.0.1 OpenAI==1.55.1 httpx==0.25.2 python-dotenv pymysql

echo.
echo ================================================
echo 启动问卷分析服务...
echo 服务地址: http://localhost:9001
echo 按 Ctrl+C 停止服务
echo ================================================
echo.

python main.py

pause 