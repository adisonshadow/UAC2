#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export NODE_ENV="${NODE_ENV:-development}"

# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env.sh"
load_env_file "$PROJECT_ROOT"

cd "$PROJECT_ROOT"

echo "========================================="
echo " EUAC Backend 启动脚本"
echo " 环境: $NODE_ENV"
echo "========================================="

if ! command -v docker > /dev/null 2>&1; then
  echo "错误：未检测到 Docker"
  exit 1
fi

echo ">>> 启动 Docker 容器 (PostgreSQL / Redis)..."
start_docker_services

echo ">>> 启动 API 服务..."
if command -v yarn > /dev/null 2>&1; then
  exec yarn dev:watch
else
  exec npm run dev:watch
fi
