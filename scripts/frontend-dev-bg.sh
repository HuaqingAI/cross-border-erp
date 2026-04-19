#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT_DIR/erp-frontend"

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
PID_FILE="${FRONTEND_PID_FILE:-/tmp/cross-border-erp-frontend-${FRONTEND_PORT}.pid}"
LOG_FILE="${FRONTEND_LOG_FILE:-/tmp/cross-border-erp-frontend-${FRONTEND_PORT}.log}"

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

is_port_listening() {
  lsof -nP -iTCP:"${FRONTEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

read_pid() {
  if [[ -f "$PID_FILE" ]]; then
    tr -d '[:space:]' <"$PID_FILE"
  fi
}

cleanup_stale_pid() {
  local pid
  pid="$(read_pid)"
  if [[ -n "$pid" ]] && ! is_pid_running "$pid"; then
    rm -f "$PID_FILE"
  fi
}

cleanup_stale_pid

existing_pid="$(read_pid)"
if [[ -n "${existing_pid:-}" ]] && is_pid_running "$existing_pid"; then
  cat <<EOF
前端开发服务器已在运行：
- PID: ${existing_pid}
- URL: http://${FRONTEND_HOST}:${FRONTEND_PORT}
- 日志: ${LOG_FILE}
EOF
  exit 0
fi

if is_port_listening; then
  cat <<EOF
端口 ${FRONTEND_PORT} 已被其他进程占用，未启动新的前端服务。
请先释放该端口，或用新的端口重试：
- FRONTEND_PORT=5175 bash scripts/frontend-dev-bg.sh
EOF
  exit 1
fi

mkdir -p "$(dirname "$PID_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"
start_command="cd \"$PROJECT_DIR\" && exec npm run dev -- --host 0.0.0.0 --port \"${FRONTEND_PORT}\""

if command -v setsid >/dev/null 2>&1; then
  setsid bash -lc "$start_command" >"${LOG_FILE}" 2>&1 < /dev/null &
  frontend_pid=$!
else
  nohup bash -lc "$start_command" >"${LOG_FILE}" 2>&1 < /dev/null &
  frontend_pid=$!
fi

disown "$frontend_pid" 2>/dev/null || true
echo "$frontend_pid" >"$PID_FILE"

for _ in $(seq 1 20); do
  if is_port_listening; then
    cat <<EOF
前端开发服务器已后台启动：
- PID: ${frontend_pid}
- URL: http://${FRONTEND_HOST}:${FRONTEND_PORT}
- 日志: ${LOG_FILE}
- 停止: bash scripts/frontend-dev-stop.sh
- 状态: bash scripts/frontend-dev-status.sh
EOF
    exit 0
  fi

  if ! is_pid_running "$frontend_pid"; then
    rm -f "$PID_FILE"
    echo "前端开发服务器启动失败，最近日志如下："
    tail -n 40 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done

echo "前端开发服务器启动超时，请检查日志：${LOG_FILE}"
exit 1
