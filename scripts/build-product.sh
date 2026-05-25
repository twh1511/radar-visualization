#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "Radar Visualization - 一键构建"
echo "========================================"
echo

echo "[1/3] 检查 Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
  exit 1
fi
echo "✅ Node.js: $(node --version)"
echo

echo "[2/3] 检查依赖..."
if [ ! -d node_modules ]; then
  echo "首次运行，正在安装依赖..."
  npm install
else
  echo "✅ 依赖已存在"
fi
echo

echo "[3/3] 构建前端..."
npm run build
echo

echo "✅ 构建完成: $PROJECT_ROOT/dist"
