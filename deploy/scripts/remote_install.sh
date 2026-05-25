#!/bin/bash
set -e

MANIFEST_PATH="$1"
TARGET_DIR="$2"

if [ -z "$MANIFEST_PATH" ] || [ -z "$TARGET_DIR" ]; then
  echo "Usage: remote_install.sh <manifest> <target-dir>"
  exit 1
fi

mkdir -p "$TARGET_DIR/bin"
mkdir -p "$TARGET_DIR/config"
mkdir -p "$TARGET_DIR/systemd"
chmod +x "$TARGET_DIR/bin/start_rosbridge.sh"
[ -f "$TARGET_DIR/bin/start_ds.sh" ] && chmod +x "$TARGET_DIR/bin/start_ds.sh"

if [ -f "$TARGET_DIR/systemd/radar-visualization-rosbridge.service" ]; then
  sudo cp "$TARGET_DIR/systemd/radar-visualization-rosbridge.service" /etc/systemd/system/
fi
if [ -f "$TARGET_DIR/systemd/radar-visualization-ds.service" ]; then
  sudo cp "$TARGET_DIR/systemd/radar-visualization-ds.service" /etc/systemd/system/
fi

sudo systemctl daemon-reload
sudo systemctl enable radar-visualization-rosbridge.service >/dev/null 2>&1 || true
sudo systemctl enable radar-visualization-ds.service >/dev/null 2>&1 || true

echo "remote_install: prepared $TARGET_DIR"
