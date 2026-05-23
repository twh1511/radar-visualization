@echo off
chcp 65001 >nul
echo ========================================
echo ROS2 可视化客户端 - 连接测试
echo ========================================
echo.

echo [测试 1/3] 检查网络连接...
ping -n 2 192.168.1.247 >nul 2>&1
if errorlevel 1 (
    echo ❌ 无法 ping 通 192.168.1.247
    echo    请检查网络连接
    pause
    exit /b 1
)
echo ✓ 网络连接正常
echo.

echo [测试 2/3] 检查 rosbridge 端口 (9090)...
for /f "tokens=*" %%a in ('powershell -command "Test-NetConnection -ComputerName 192.168.1.247 -Port 9090 -InformationLevel Quiet"') do set RESULT=%%a
if "%RESULT%"=="True" (
    echo ✓ rosbridge 端口 9090 可访问
) else (
    echo ❌ rosbridge 端口 9090 无法访问
    echo    请确保在机器人上运行了:
    echo    ros2 launch rosbridge_server rosbridge_websocket_launch.xml
    pause
    exit /b 1
)
echo.

echo [测试 3/3] 启动可视化客户端...
cd /d "%~dp0.."
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
)

echo.
echo ========================================
echo ✓ 所有检查通过！
echo ========================================
echo.
echo 正在启动客户端...
echo 浏览器将打开 http://localhost:3000
echo.

start npm run dev
