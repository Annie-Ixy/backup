@echo off
echo 正在设置代理配置...

REM 设置您的VPN代理
set https_proxy=http://127.0.0.1:33210
set http_proxy=http://127.0.0.1:33210
set all_proxy=socks5://127.0.0.1:33211

REM 设置代理例外 - 重要！避免本地服务走代理
set no_proxy=localhost,127.0.0.1,::1,0.0.0.0,*.local
set NO_PROXY=localhost,127.0.0.1,::1,0.0.0.0,*.local

echo 代理设置完成：
echo HTTP/HTTPS 代理: %http_proxy%
echo SOCKS5 代理: %all_proxy%
echo 代理例外: %no_proxy%
echo.
echo 现在启动Python服务...

REM 启动Python服务
python main.py

pause 