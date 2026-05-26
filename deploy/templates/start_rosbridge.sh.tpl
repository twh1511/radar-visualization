#!/bin/bash
set -e

BASE_DIR="{{BASE_DIR}}/{{APP_DIR_NAME}}"
ENV_FILE="$BASE_DIR/config/rosbridge.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# systemd 以 root 运行时环境可能无 HOME，rcl 日志初始化需要可写目录
export HOME="${HOME:-/root}"
mkdir -p "${ROS_LOG_DIR:-$HOME/.ros/log}"

source /opt/ros/humble/setup.bash

if ! dpkg -l 2>/dev/null | grep -q "ros-humble-rosbridge-suite"; then
  sudo apt update
  sudo apt install -y ros-humble-rosbridge-suite
fi

export ROS_SUPER_CLIENT="${ROS_SUPER_CLIENT:-TRUE}"

# websocket_ping_interval>0 开启心跳，主动回收死连接（CLOSE-WAIT）与僵尸订阅；
# unregister_timeout 缩短，减少刷新/重连时的订阅叠加。
exec ros2 launch {{ROSBRIDGE_PACKAGE}} {{ROSBRIDGE_ENTRY}} \
  port:={{ROSBRIDGE_PORT}} \
  address:={{ROSBRIDGE_ADDRESS}} \
  websocket_ping_interval:={{ROSBRIDGE_PING_INTERVAL}} \
  websocket_ping_timeout:={{ROSBRIDGE_PING_TIMEOUT}} \
  unregister_timeout:={{ROSBRIDGE_UNREGISTER_TIMEOUT}} \
  max_message_size:={{ROSBRIDGE_MAX_MESSAGE_SIZE}}
