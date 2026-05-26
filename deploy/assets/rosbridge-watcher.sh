#!/bin/bash
# rosbridge 自动重启守护
# ----------------------------------------------------------------------------
# 监听 ROS 栈容器（如 i-ros）的 start 事件：容器重启后其 ROS publisher 是全新的
# DDS entity，rosbridge 既有订阅不会自动重连到新 publisher（订阅僵死，前端收不到
# 数据）。本守护在容器启动后延迟一段时间（等容器内节点就绪）重启 rosbridge，
# 使其重新发现并订阅新 publisher。
#
# 配置经环境变量传入（由 systemd unit 的 Environment= 提供）：
#   WATCH_CONTAINER    要监听的容器名（精确匹配，避免误匹配 i-ros-slam 等）
#   ROSBRIDGE_SERVICE  要重启的 rosbridge systemd 服务名
#   SETTLE_SECONDS     容器启动后等待多少秒再重启（等内部节点起来）
# 本脚本不经模板渲染（含 docker Go 模板 {{...}}），值全部来自环境变量。
set -u

CONTAINER="${WATCH_CONTAINER:-i-ros}"
SERVICE="${ROSBRIDGE_SERVICE:-radar-visualization-rosbridge.service}"
SETTLE="${SETTLE_SECONDS:-10}"

echo "[rosbridge-watcher] 监听容器 '$CONTAINER' 的 start 事件 -> ${SETTLE}s 后重启 $SERVICE"

# docker events 是长连接事件流；docker 守护重启时它会结束，由 systemd Restart=always 拉起。
docker events --filter type=container --filter event=start --format '{{.Actor.Attributes.name}}' \
  | while read -r name; do
      # 精确匹配容器名（docker --filter container=xxx 是子串匹配，这里再卡一次）
      [ "$name" = "$CONTAINER" ] || continue
      echo "[rosbridge-watcher] 检测到 '$CONTAINER' 启动，${SETTLE}s 后重启 $SERVICE"
      sleep "$SETTLE"
      if systemctl restart "$SERVICE"; then
        echo "[rosbridge-watcher] 已重启 $SERVICE"
      else
        echo "[rosbridge-watcher] 重启 $SERVICE 失败"
      fi
    done

echo "[rosbridge-watcher] docker events 流结束，退出（systemd 将重启本服务）"
