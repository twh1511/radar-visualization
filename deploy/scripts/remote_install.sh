#!/bin/bash
set -e

MANIFEST_PATH="$1"
TARGET_DIR="$2"

if [ -z "$MANIFEST_PATH" ] || [ -z "$TARGET_DIR" ]; then
  echo "Usage: remote_install.sh <manifest> <target-dir>"
  exit 1
fi

# 需 root 的步骤统一走 _sudo：设置了 SUDO_PASS（本地 helper 的密码模式）则用 sudo -S，
# 否则按免密 sudo 直接执行。
_sudo() {
  if [ -n "${SUDO_PASS:-}" ]; then
    echo "$SUDO_PASS" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

# 从 manifest 读取服务名/开关（无 yaml 解析器时回退到默认值）
read_manifest() {
  local key="$1" default="$2"
  python3 - "$MANIFEST_PATH" "$key" "$default" 2>/dev/null <<'PY' || echo "$default"
import sys, yaml
from pathlib import Path
m = yaml.safe_load(Path(sys.argv[1]).read_text()) or {}
cur = m
for part in sys.argv[2].split('.'):
    cur = (cur or {}).get(part) if isinstance(cur, dict) else None
print(cur if cur not in (None, '') else sys.argv[3])
PY
}

ROSBRIDGE_SERVICE="$(read_manifest rosbridge.serviceName radar-visualization-rosbridge.service)"
DS_SERVICE="$(read_manifest ds.serviceName radar-visualization-ds.service)"
DS_ENABLED="$(read_manifest ds.enabled false)"

mkdir -p "$TARGET_DIR/bin" "$TARGET_DIR/config" "$TARGET_DIR/systemd" "$TARGET_DIR/log"
chmod +x "$TARGET_DIR/bin/start_rosbridge.sh" 2>/dev/null || true
[ -f "$TARGET_DIR/bin/start_ds.sh" ] && chmod +x "$TARGET_DIR/bin/start_ds.sh"

# rosbridge 服务始终下发
if [ -f "$TARGET_DIR/systemd/$ROSBRIDGE_SERVICE" ]; then
  _sudo cp "$TARGET_DIR/systemd/$ROSBRIDGE_SERVICE" /etc/systemd/system/
fi

# ds 服务：本轮渲染了就安装；没渲染（简单 UDPv4 部署）则清理可能残留的旧单元
if [ -f "$TARGET_DIR/systemd/$DS_SERVICE" ]; then
  _sudo cp "$TARGET_DIR/systemd/$DS_SERVICE" /etc/systemd/system/
  _sudo systemctl enable "$DS_SERVICE" >/dev/null 2>&1 || true
else
  _sudo systemctl stop "$DS_SERVICE" >/dev/null 2>&1 || true
  _sudo systemctl disable "$DS_SERVICE" >/dev/null 2>&1 || true
  _sudo rm -f "/etc/systemd/system/$DS_SERVICE"
fi

_sudo systemctl daemon-reload
_sudo systemctl enable "$ROSBRIDGE_SERVICE" >/dev/null 2>&1 || true

# 重启并检查
_sudo systemctl restart "$ROSBRIDGE_SERVICE"
if [ "$DS_ENABLED" = "true" ] || [ "$DS_ENABLED" = "True" ]; then
  _sudo systemctl restart "$DS_SERVICE" || true
fi
sleep 2
echo "remote_install: prepared $TARGET_DIR"
echo "rosbridge service: $ROSBRIDGE_SERVICE -> $(systemctl is-active "$ROSBRIDGE_SERVICE" 2>/dev/null || echo unknown)"
