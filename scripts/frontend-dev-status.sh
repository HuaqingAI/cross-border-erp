#!/usr/bin/env bash

set -euo pipefail

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

pid="$(read_pid)"

if [[ -n "${pid:-}" ]] && is_pid_running "$pid" && is_port_listening; then
  cat <<EOF
前端状态：running
- PID: ${pid}
- URL: http://${FRONTEND_HOST}:${FRONTEND_PORT}
- 日志: ${LOG_FILE}
EOF
  exit 0
fi

if [[ -n "${pid:-}" ]] && ! is_pid_running "$pid"; then
  cat <<EOF
前端状态：stale pid
- PID 文件: ${PID_FILE}
- 记录的 PID: ${pid}
- 端口 ${FRONTEND_PORT} 当前未被该进程监听
- 可执行：bash scripts/frontend-dev-stop.sh
EOF
  if [[ -f "$LOG_FILE" ]]; then
    echo "最近日志："
    tail -n 20 "$LOG_FILE" 2>/dev/null || true
  fi
  exit 0
fi

if is_port_listening; then
  cat <<EOF
前端状态：running (unmanaged)
- URL: http://${FRONTEND_HOST}:${FRONTEND_PORT}
- 端口已监听，但当前 PID 文件缺失或不匹配
- 如需接管，请先停止占用进程后重新执行：
  bash scripts/frontend-dev-bg.sh
EOF
  exit 0
fi

cat <<EOF
前端状态：not running
- 目标地址: http://${FRONTEND_HOST}:${FRONTEND_PORT}
- 启动命令: bash scripts/frontend-dev-bg.sh
EOF
if [[ -f "$LOG_FILE" ]]; then
  echo "- 最近日志: ${LOG_FILE}"
fi
