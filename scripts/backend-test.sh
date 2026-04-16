#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOCKER_BIN="${DOCKER_BIN:-/Applications/Docker.app/Contents/Resources/bin/docker}"
if [[ ! -x "$DOCKER_BIN" ]]; then
  DOCKER_BIN="docker"
fi

"$DOCKER_BIN" run --rm \
  -v "$ROOT_DIR/erp-backend:/app" \
  -w /app \
  cross-border-erp-api:latest \
  sh -lc "pip install -r requirements-dev.txt >/tmp/backend-test-pip.log && pytest tests -q"
