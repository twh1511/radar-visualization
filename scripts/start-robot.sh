#!/bin/bash
# 在机器人上启动 ROS 服务的脚本
# 使用方法: ssh wl@192.168.1.247 'bash -s' < start-robot.sh

set -e

echo "=================================="
echo "启动机器人 ROS 服务"
echo "=================================="

# 设置 ROS 环境
source /opt/ros/humble/setup.bash

# 启动 rosbridge (后台运行)
echo "[1/2] 启动 rosbridge WebSocket 服务器..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
ROSBRIDGE_PID=$!
sleep 3

# 启动导航系统
echo "[2/2] 启动定位和导航系统..."
cd ~/iiri-intelligence-layer
source setup.bash
ros2 launch hdl_localization hdl_localization_real.launch.py &
NAV_PID=$!

echo ""
echo "=================================="
echo "✅ 所有服务已启动"
echo "=================================="
echo "rosbridge PID: $ROSBRIDGE_PID"
echo "导航系统 PID: $NAV_PID"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待中断信号
trap "echo '正在停止服务...'; kill $ROSBRIDGE_PID $NAV_PID; exit" INT TERM

wait
