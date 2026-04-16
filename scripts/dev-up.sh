#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOCKER_BIN="${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}"
MYSQL_PORT="${MYSQL_PORT:-3307}"
if [[ ! -x "$DOCKER_BIN" ]]; then
  DOCKER_BIN="docker"
fi

"$DOCKER_BIN" compose -f docker-compose.yml -f docker-compose.dev.yml up -d db minio api

cat <<EOF
开发环境已启动：
- API: http://127.0.0.1:8000
- MySQL: 127.0.0.1:${MYSQL_PORT}
- MinIO API: http://127.0.0.1:9000
- MinIO Console: http://127.0.0.1:9001
- 前端开发：bash scripts/frontend-dev.sh

推荐开发方式：
- 后端开发：默认使用 Docker 中的 api/db/minio
- 前端开发：本地运行 Vite，后端与依赖服务走 Docker

常用脚本：
- bash scripts/dev-status.sh
- bash scripts/backend-test.sh
- bash scripts/frontend-test.sh
- bash scripts/frontend-dev.sh
- bash scripts/dev-down.sh
EOF
