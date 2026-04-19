#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOCKER_BIN="${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}"
if [[ ! -x "$DOCKER_BIN" ]]; then
  DOCKER_BIN="docker"
fi

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.prod.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  cat <<EOF
未找到 $ENV_FILE

请先执行：
cp .env.prod.example .env.prod

然后打开 .env.prod，把以下内容改成你自己的值：
- APP_ORIGIN
- MINIO_PUBLIC_ENDPOINT
- MYSQL_ROOT_PASSWORD
- MINIO_ROOT_PASSWORD
- SECRET_KEY
- INIT_ADMIN_USERNAME
- INIT_ADMIN_PASSWORD
EOF
  exit 1
fi

"$DOCKER_BIN" compose "${COMPOSE_ARGS[@]}" up -d --build

echo "服务已启动，开始执行数据库迁移..."

for _ in {1..20}; do
  if "$DOCKER_BIN" compose "${COMPOSE_ARGS[@]}" exec -T api alembic upgrade head; then
    MIGRATION_OK=1
    break
  fi
  sleep 3
done

if [[ "${MIGRATION_OK:-0}" != "1" ]]; then
  echo "数据库迁移失败，请先执行 bash scripts/prod-status.sh 查看容器状态。"
  exit 1
fi

echo "数据库迁移完成，开始初始化管理员账号..."
"$DOCKER_BIN" compose "${COMPOSE_ARGS[@]}" exec -T api python -m app.db.bootstrap_admin

cat <<'EOF'
生产环境部署完成。

建议你马上验证这 4 项：
1. 打开 http://你的服务器IP/health ，确认返回 {"status":"ok"}
2. 打开 http://你的服务器IP ，确认前端页面能打开
3. 用 .env.prod 里的 INIT_ADMIN_USERNAME / INIT_ADMIN_PASSWORD 登录
4. 如需上传图片，确认浏览器能访问 MinIO 对外地址（默认是 http://你的服务器IP:9000）

常用命令：
- 查看状态：bash scripts/prod-status.sh
- 停止服务：bash scripts/prod-down.sh
EOF
