#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3000
URL="http://127.0.0.1:${PORT}/"
PID_FILE="/tmp/radar-viz-product.pid"
LOG_FILE="/tmp/radar-viz-product.log"

cd "$PROJECT_ROOT"

echo "========================================"
echo "Radar Visualization - 一键启动"
echo "========================================"
echo

echo "[1/5] 检查 Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
  exit 1
fi
echo "✅ Node.js: $(node --version)"
echo

echo "[2/5] 检查依赖..."
if [ ! -d node_modules ]; then
  echo "首次运行，正在安装依赖..."
  npm install
else
  echo "✅ 依赖已存在"
fi
echo

echo "[3/5] 构建前端..."
npm run build
echo

echo "[4/5] 清理旧服务..."
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "停止旧服务 PID=$OLD_PID"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi
PIDS="$(lsof -ti :${PORT} || true)"
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs -r kill
  sleep 1
fi

echo "[5/5] 启动本地产品服务 (deploy-agent: 静态托管 + 一键部署 API)..."
PORT="${PORT}" HOST=127.0.0.1 nohup node tools/deploy-agent/server.mjs >"$LOG_FILE" 2>&1 < /dev/null &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
sleep 2

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "❌ 启动失败，进程未存活。请检查日志: $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi

if ! lsof -ti :${PORT} >/dev/null 2>&1; then
  echo "❌ 启动失败，端口 ${PORT} 未监听。请检查日志: $LOG_FILE"
  kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  exit 1
fi

echo "✅ 服务已启动: ${URL}"
echo "PID 文件: ${PID_FILE}"
echo "日志文件: ${LOG_FILE}"
echo

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi

echo "如果没有自动打开浏览器，请手动访问: ${URL}"
