#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/erp-frontend"

FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo "前端开发服务器启动中: http://127.0.0.1:${FRONTEND_PORT}"
echo "提示：如需后台常驻启动，可执行 bash scripts/frontend-dev-bg.sh"
exec npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT}"
