@echo off
chcp 65001 >nul
echo ==================================
echo 雷达地图可视化 - 快速启动
echo ==================================
echo.

echo [1/3] 检查 Node.js 安装...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 16+
    pause
    exit /b 1
)
echo ✅ Node.js 已安装
echo.

echo [2/3] 安装依赖包...
cd /d "%~dp0.."
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖已安装
)
echo.

echo [3/3] 启动开发服务器...
echo.
echo ==================================
echo 📡 请确保机器人端已启动 rosbridge:
echo    ssh wl@192.168.1.247
echo    ros2 launch rosbridge_server rosbridge_websocket_launch.xml
echo ==================================
echo.
echo 启动完成后，浏览器将自动打开 http://localhost:3000
echo.

call npm run dev
