#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOCKER_BIN="${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}"
if [[ ! -x "$DOCKER_BIN" ]]; then
  DOCKER_BIN="docker"
fi

"$DOCKER_BIN" compose -f docker-compose.yml -f docker-compose.dev.yml stop api db minio

cat <<'EOF'
开发环境已停止：
- api
- db
- minio

提示：
- 数据卷会保留
- 如需连容器和网络一起清理，可手动执行 docker compose down
EOF
