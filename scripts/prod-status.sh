#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOCKER_BIN="${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}"
if [[ ! -x "$DOCKER_BIN" ]]; then
  DOCKER_BIN="docker"
fi

ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "未找到 $ENV_FILE"
  exit 1
fi

"$DOCKER_BIN" compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.prod.yml ps

cat <<'EOF'

如果你想继续排查：
- 查看健康检查：curl http://你的服务器IP/health
- 查看日志：docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml logs -f
EOF
