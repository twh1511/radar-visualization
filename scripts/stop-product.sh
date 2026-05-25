#!/bin/bash
set -euo pipefail

PORT=3000
PID_FILE="/tmp/radar-viz-product.pid"

echo "========================================"
echo "Radar Visualization - 停止服务"
echo "========================================"
echo

STOPPED=0
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "停止 PID 文件记录的服务: $PID"
    kill "$PID" 2>/dev/null || true
    STOPPED=1
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

PIDS="$(lsof -ti :${PORT} || true)"
if [ -n "$PIDS" ]; then
  echo "停止端口 ${PORT} 上的服务: $PIDS"
  echo "$PIDS" | xargs -r kill
  STOPPED=1
  sleep 1
fi

if [ "$STOPPED" -eq 0 ]; then
  echo "ℹ️  没有检测到正在运行的产品服务"
  exit 0
fi

echo "✅ 服务已停止"
