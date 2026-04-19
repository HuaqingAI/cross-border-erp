#!/usr/bin/env bash

set -euo pipefail

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PID_FILE="${FRONTEND_PID_FILE:-/tmp/cross-border-erp-frontend-${FRONTEND_PORT}.pid}"

is_pid_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

read_pid() {
  if [[ -f "$PID_FILE" ]]; then
    tr -d '[:space:]' <"$PID_FILE"
  fi
}

pid="$(read_pid)"

if [[ -z "${pid:-}" ]]; then
  echo "未找到前端 PID 文件，无需停止。"
  exit 0
fi

if ! is_pid_running "$pid"; then
  rm -f "$PID_FILE"
  echo "前端 PID 文件已过期，已清理：${PID_FILE}"
  exit 0
fi

kill "$pid"

for _ in $(seq 1 10); do
  if ! is_pid_running "$pid"; then
    rm -f "$PID_FILE"
    echo "前端开发服务器已停止（PID: ${pid}）。"
    exit 0
  fi
  sleep 1
done

echo "前端进程未在预期时间内退出，请手动检查（PID: ${pid}）。"
exit 1
