#!/bin/bash
# 在 192.168.1.247 上启动导航系统和 rosbridge
# 使用 tmux 在后台运行多个服务

set -e

echo "========================================"
echo "启动 ROS2 导航系统 + rosbridge"
echo "========================================"
echo ""

# 检查 tmux
if ! command -v tmux &> /dev/null; then
    echo "安装 tmux..."
    sudo apt install -y tmux
fi

# 设置 ROS 环境
source /opt/ros/humble/setup.bash

# 检查并安装 rosbridge
if ! dpkg -l | grep -q ros-humble-rosbridge-suite; then
    echo "安装 rosbridge..."
    sudo apt update
    sudo apt install -y ros-humble-rosbridge-suite
fi

echo ""
echo "创建 tmux 会话..."
echo ""

# 创建新的 tmux 会话
SESSION="ros_viz"
tmux has-session -t $SESSION 2>/dev/null && tmux kill-session -t $SESSION

# 创建会话并启动导航系统
tmux new-session -d -s $SESSION -n navigation
tmux send-keys -t $SESSION:navigation "cd ~/iiri-intelligence-layer && source setup.bash && ros2 launch hdl_localization hdl_localization_real_demo.launch.py" C-m

# 等待导航系统启动
echo "等待导航系统启动..."
sleep 5

# 创建新窗口并启动 rosbridge
tmux new-window -t $SESSION -n rosbridge
tmux send-keys -t $SESSION:rosbridge "source /opt/ros/humble/setup.bash && ros2 launch rosbridge_server rosbridge_websocket_launch.xml" C-m

echo ""
echo "========================================"
echo "✓ 所有服务已启动！"
echo "========================================"
echo ""
echo "tmux 会话名称: $SESSION"
echo ""
echo "查看窗口:"
echo "  tmux attach -t $SESSION"
echo ""
echo "窗口切换:"
echo "  Ctrl+B 然后按 0 - 导航系统"
echo "  Ctrl+B 然后按 1 - rosbridge"
echo ""
echo "退出 tmux: Ctrl+B 然后按 D"
echo "停止所有服务: tmux kill-session -t $SESSION"
echo ""
echo "等待 5 秒后检查话题..."
sleep 5

echo ""
echo "=== 当前运行的话题 ==="
ros2 topic list | head -20
echo ""
