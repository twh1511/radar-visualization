#!/bin/bash
# 在 192.168.1.247 上安装并启动 rosbridge

set -e

echo "========================================"
echo "ROS2 机器人 rosbridge 安装和启动脚本"
echo "========================================"
echo ""

# 设置 ROS 环境
echo "[1/4] 设置 ROS 环境..."
source /opt/ros/humble/setup.bash 2>/dev/null || source /opt/ros/foxy/setup.bash 2>/dev/null
echo "ROS_DISTRO: $ROS_DISTRO"
echo ""

# 检查 rosbridge 是否已安装
echo "[2/4] 检查 rosbridge 安装状态..."
if dpkg -l | grep -q ros-${ROS_DISTRO}-rosbridge-suite; then
    echo "✓ rosbridge 已安装"
else
    echo "✗ rosbridge 未安装，正在安装..."
    sudo apt update
    sudo apt install -y ros-${ROS_DISTRO}-rosbridge-suite
    echo "✓ rosbridge 安装完成"
fi
echo ""

# 检查当前运行的话题
echo "[3/4] 检查当前运行的 ROS 话题..."
ros2 topic list | head -20
echo ""

# 启动 rosbridge
echo "[4/4] 启动 rosbridge WebSocket 服务器..."
echo "端口: 9090"
echo "按 Ctrl+C 停止服务"
echo ""
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
