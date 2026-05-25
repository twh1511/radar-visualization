#!/bin/bash
set -e

MANIFEST_PATH="$1"
TARGET_DIR="$2"

if [ -z "$MANIFEST_PATH" ] || [ -z "$TARGET_DIR" ]; then
  echo "Usage: remote_install.sh <manifest> <target-dir>"
  exit 1
fi

ROSBRIDGE_SERVICE="radar-visualization-rosbridge.service"
DS_SERVICE="radar-visualization-ds.service"

mkdir -p "$TARGET_DIR/bin"
mkdir -p "$TARGET_DIR/config"
mkdir -p "$TARGET_DIR/systemd"
chmod +x "$TARGET_DIR/bin/start_rosbridge.sh" 2>/dev/null || true
[ -f "$TARGET_DIR/bin/start_ds.sh" ] && chmod +x "$TARGET_DIR/bin/start_ds.sh"

# rosbridge 服务始终下发
if [ -f "$TARGET_DIR/systemd/$ROSBRIDGE_SERVICE" ]; then
  sudo cp "$TARGET_DIR/systemd/$ROSBRIDGE_SERVICE" /etc/systemd/system/
fi

# ds 服务：本轮渲染了就安装；没渲染（简单 UDPv4 部署）则清理可能残留的旧单元
if [ -f "$TARGET_DIR/systemd/$DS_SERVICE" ]; then
  sudo cp "$TARGET_DIR/systemd/$DS_SERVICE" /etc/systemd/system/
  sudo systemctl enable "$DS_SERVICE" >/dev/null 2>&1 || true
else
  sudo systemctl stop "$DS_SERVICE" >/dev/null 2>&1 || true
  sudo systemctl disable "$DS_SERVICE" >/dev/null 2>&1 || true
  sudo rm -f "/etc/systemd/system/$DS_SERVICE"
fi

sudo systemctl daemon-reload
sudo systemctl enable "$ROSBRIDGE_SERVICE" >/dev/null 2>&1 || true

echo "remote_install: prepared $TARGET_DIR"
