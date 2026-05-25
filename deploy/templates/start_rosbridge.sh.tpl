#!/bin/bash
set -e

BASE_DIR="{{BASE_DIR}}/{{APP_DIR_NAME}}"
ENV_FILE="$BASE_DIR/rosbridge.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

source /opt/ros/humble/setup.bash

if ! dpkg -l 2>/dev/null | grep -q "ros-humble-rosbridge-suite"; then
  sudo apt update
  sudo apt install -y ros-humble-rosbridge-suite
fi

export ROS_SUPER_CLIENT="${ROS_SUPER_CLIENT:-TRUE}"

exec ros2 launch {{ROSBRIDGE_PACKAGE}} {{ROSBRIDGE_ENTRY}}
