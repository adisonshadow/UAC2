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
echo " EUAC Backend 安装脚本"
echo " 环境: $NODE_ENV"
echo "========================================="

if ! command -v docker > /dev/null 2>&1; then
  echo "错误：未检测到 Docker，请先安装 Docker Desktop 或 Docker Engine"
  exit 1
fi

if ! docker compose version > /dev/null 2>&1; then
  echo "错误：未检测到 docker compose，请升级 Docker 或安装 compose 插件"
  exit 1
fi

echo ">>> 安装 Node 依赖..."
if command -v yarn > /dev/null 2>&1; then
  yarn install
else
  npm install
fi

echo ">>> 启动 PostgreSQL / Redis 容器..."
start_docker_services

if ! command -v psql > /dev/null 2>&1; then
  echo "警告：未检测到本地 psql 客户端，将跳过数据库初始化"
  echo "如需初始化数据库，请安装 PostgreSQL 客户端后执行: yarn init-db"
else
  echo ">>> 初始化数据库..."
  bash "$PROJECT_ROOT/scripts/initdb.sh"
fi

echo ""
echo "安装完成。"
echo "启动项目: bash lunch/start.sh"
echo "Swagger:  http://localhost:${API_PORT:-3000}/swagger"
