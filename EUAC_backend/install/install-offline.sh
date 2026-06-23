#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_DIR="$SCRIPT_DIR/images"
BUNDLE_FILE="$IMAGES_DIR/euac-docker-images.tar"

POSTGRES_IMAGE="postgres:16-alpine"
REDIS_IMAGE="redis:7-alpine"

load_local_docker_images() {
  local loaded=0

  if [ -f "$BUNDLE_FILE" ]; then
    echo ">>> 从镜像包加载: $BUNDLE_FILE"
    docker load -i "$BUNDLE_FILE"
    loaded=1
  else
    local tar_files=("$IMAGES_DIR"/*.tar)
    if [ -e "${tar_files[0]}" ]; then
      echo ">>> 从 images 目录逐个加载 tar 镜像..."
      for tar_file in "${tar_files[@]}"; do
        echo "    加载: $(basename "$tar_file")"
        docker load -i "$tar_file"
        loaded=1
      done
    fi
  fi

  if [ "$loaded" -eq 0 ]; then
    echo "错误：未找到本地镜像文件"
    echo "请将开发机导出的镜像放到以下位置之一："
    echo "  - $BUNDLE_FILE"
    echo "  - $IMAGES_DIR/*.tar"
    echo ""
    echo "开发机导出命令: bash install/export-images.sh"
    exit 1
  fi

  echo ">>> 校验本地镜像..."
  docker image inspect "$POSTGRES_IMAGE" > /dev/null 2>&1 || {
    echo "错误：本地缺少镜像 $POSTGRES_IMAGE"
    exit 1
  }
  docker image inspect "$REDIS_IMAGE" > /dev/null 2>&1 || {
    echo "错误：本地缺少镜像 $REDIS_IMAGE"
    exit 1
  }
  echo "本地镜像校验通过"
}

start_docker_services_offline() {
  docker compose up -d --pull never
  wait_for_postgres
  wait_for_redis
}

install_node_dependencies_offline() {
  if [ -d "$PROJECT_ROOT/node_modules" ]; then
    echo ">>> 检测到 node_modules，跳过 Node 依赖安装"
    return 0
  fi

  echo ">>> 安装 Node 依赖（离线模式）..."
  if command -v yarn > /dev/null 2>&1; then
    if yarn install --offline; then
      return 0
    fi
    echo "警告：yarn --offline 失败，尝试普通安装..."
    yarn install || {
      echo "错误：Node 依赖安装失败。请在内网机器上预先准备好 node_modules，或在有网络环境执行 install.sh"
      exit 1
    }
  elif command -v npm > /dev/null 2>&1; then
    if npm ci --offline 2>/dev/null || npm install --offline 2>/dev/null; then
      return 0
    fi
    echo "警告：npm --offline 失败，尝试普通安装..."
    npm install || {
      echo "错误：Node 依赖安装失败。请在内网机器上预先准备好 node_modules，或在有网络环境执行 install.sh"
      exit 1
    }
  else
    echo "错误：未检测到 yarn 或 npm"
    exit 1
  fi
}

export NODE_ENV="${NODE_ENV:-development}"

# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env.sh"
load_env_file "$PROJECT_ROOT"

cd "$PROJECT_ROOT"

echo "========================================="
echo " EUAC Backend 离线安装脚本"
echo " 环境: $NODE_ENV"
echo " 模式: 使用本地 Docker 镜像（不拉取远程）"
echo "========================================="

if ! command -v docker > /dev/null 2>&1; then
  echo "错误：未检测到 Docker，请先安装 Docker Desktop 或 Docker Engine"
  exit 1
fi

if ! docker compose version > /dev/null 2>&1; then
  echo "错误：未检测到 docker compose，请升级 Docker 或安装 compose 插件"
  exit 1
fi

load_local_docker_images
install_node_dependencies_offline

echo ">>> 启动 PostgreSQL / Redis 容器（仅使用本地镜像）..."
start_docker_services_offline

if ! command -v psql > /dev/null 2>&1; then
  echo "警告：未检测到本地 psql 客户端，将跳过数据库初始化"
  echo "如需初始化数据库，请安装 PostgreSQL 客户端后执行: yarn init-db"
else
  echo ">>> 初始化数据库..."
  bash "$PROJECT_ROOT/scripts/initdb.sh"
fi

echo ""
echo "离线安装完成。"
echo "启动项目: bash lunch/start.sh"
echo "Swagger:  http://localhost:${API_PORT:-3000}/swagger"
