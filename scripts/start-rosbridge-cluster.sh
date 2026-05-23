#!/bin/bash
# 在 192.168.1.247 上启动 rosbridge，自动连接到 iiri-ros 集群
# 集群使用 FastDDS Discovery Server

set -e

echo "========================================"
echo "启动 rosbridge (集群模式)"
echo "========================================"
echo ""

# 加载集群的 ROS 环境变量
ENV_FILE=/home/wl/autorun/iiri-ros/ros.env
if [ -f "$ENV_FILE" ]; then
    echo "加载集群环境: $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
fi

# 设置默认值（如果环境文件不存在）
: "${ROS_DOMAIN_ID:=219}"
: "${RMW_IMPLEMENTATION:=rmw_fastrtps_cpp}"
: "${ROS_DISCOVERY_SERVER:=192.168.1.247:11811}"
: "${ROS_SUPER_CLIENT:=TRUE}"  # rosbridge 需要 SUPER_CLIENT 才能订阅所有话题
: "${FASTDDS_BUILTIN_TRANSPORTS:=DEFAULT}"

# 强制 rosbridge 用 SUPER_CLIENT，否则订阅不到
export ROS_SUPER_CLIENT=TRUE
export ROS_DOMAIN_ID RMW_IMPLEMENTATION ROS_DISCOVERY_SERVER FASTDDS_BUILTIN_TRANSPORTS

echo ""
echo "环境变量:"
echo "  ROS_DOMAIN_ID=$ROS_DOMAIN_ID"
echo "  RMW_IMPLEMENTATION=$RMW_IMPLEMENTATION"
echo "  ROS_DISCOVERY_SERVER=$ROS_DISCOVERY_SERVER"
echo "  ROS_SUPER_CLIENT=$ROS_SUPER_CLIENT"
echo ""

# 设置 ROS
source /opt/ros/humble/setup.bash

# 检查并安装 rosbridge
if ! dpkg -l 2>/dev/null | grep -q ros-humble-rosbridge-suite; then
    echo "安装 rosbridge..."
    sudo apt update
    sudo apt install -y ros-humble-rosbridge-suite
    echo "✓ 安装完成"
fi

# 验证能否看到集群话题
echo "验证连接到集群（5秒）..."
ros2 daemon stop > /dev/null 2>&1 || true
ros2 daemon start
sleep 5
TOPIC_COUNT=$(ros2 topic list 2>/dev/null | wc -l)
echo "发现 $TOPIC_COUNT 个话题"

if [ "$TOPIC_COUNT" -lt 10 ]; then
    echo "⚠️  警告: 话题数量过少，可能未正确连接到集群"
    echo "   请检查 iiri-ros.service 是否运行: systemctl status iiri-ros"
fi

echo ""
echo "========================================"
echo "启动 rosbridge WebSocket (端口 9090)"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

ros2 launch rosbridge_server rosbridge_websocket_launch.xml
