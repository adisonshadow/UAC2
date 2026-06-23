#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_DIR="$SCRIPT_DIR/images"
BUNDLE_FILE="$IMAGES_DIR/euac-docker-images.tar"
MANIFEST_FILE="$IMAGES_DIR/images.manifest"

POSTGRES_IMAGE="postgres:16-alpine"
REDIS_IMAGE="redis:7-alpine"

echo "========================================="
echo " EUAC Docker 镜像导出脚本"
echo " 用于开发机联网环境，导出后拷贝至内网离线安装"
echo "========================================="

if ! command -v docker > /dev/null 2>&1; then
  echo "错误：未检测到 Docker"
  exit 1
fi

mkdir -p "$IMAGES_DIR"

echo ">>> 拉取镜像..."
docker pull "$POSTGRES_IMAGE"
docker pull "$REDIS_IMAGE"

echo ">>> 导出镜像到 $BUNDLE_FILE ..."
docker save "$POSTGRES_IMAGE" "$REDIS_IMAGE" -o "$BUNDLE_FILE"

echo ""
echo "导出完成。"
echo "镜像包: $BUNDLE_FILE"
echo "清单文件: $MANIFEST_FILE"
echo ""
echo "内网部署步骤："
echo "  1. 将 install/images/ 目录（含 euac-docker-images.tar）拷贝到内网机器"
echo "  2. 执行: bash install/install-offline.sh"
