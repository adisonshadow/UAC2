#!/usr/bin/env bash
# scripts/offline-deploy.sh
#
# 在本机（需 Docker + pnpm + 可访问镜像仓库）一键生成 deploy-offline 生产离线包。
# 用法：
#   pnpm offline:deploy
#   OFFLINE_OS=ubuntu OFFLINE_ARCH=amd64 pnpm offline:deploy   # 可选；默认示例 centos + amd64
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/offline"
OUT_DIR="$REPO_ROOT/deploy-offline"
RELEASES_DIR="$OUT_DIR/releases"
ARCHIVE_NAME="deploy-offline-v1.0.tar.gz"
ARCHIVE_PATH="$RELEASES_DIR/$ARCHIVE_NAME"
API_IMAGE="eadaf-api:v1"
FPCU2_BFF_IMAGE="fpcu2-bff:v1"
FPCU2_WEB_IMAGE="fpcu2-web:v1"
PLATFORM="linux/amd64"
# 可用环境变量覆盖：FPCU2_ROOT=/path/to/FPCU2
FPCU2_ROOT="${FPCU2_ROOT:-/Volumes/dev/Asset-Management-Hub803/FPCU2}"

cd "$REPO_ROOT"

log() { printf '\n==== %s ====\n' "$*"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1"
    exit 1
  fi
}

need_cmd docker
need_cmd pnpm
need_cmd curl
need_cmd tar

if ! docker info >/dev/null 2>&1; then
  echo "Docker 未运行，请先启动 Docker Desktop"
  exit 1
fi

download_with_fallback() {
  local dest="$1"
  shift
  local url
  for url in "$@"; do
    echo "尝试下载: $url"
    if curl -fL --retry 2 --connect-timeout 20 -o "$dest" "$url"; then
      echo "下载成功: $dest"
      return 0
    fi
    rm -f "$dest"
  done
  echo "全部镜像源下载失败: $dest"
  return 1
}

# 按 PLATFORM 拉取镜像；官方源失败时走国内 library 镜像并 tag 回标准名
pull_platform_image() {
  local name="$1"
  local want_arch="${OFFLINE_ARCH:-amd64}"
  if docker image inspect "$name" >/dev/null 2>&1; then
    local existing
    existing="$(docker image inspect "$name" --format '{{.Architecture}}')"
    if [[ "$existing" == "$want_arch" ]]; then
      echo "本地已有 ${want_arch}: $name"
      return 0
    fi
    echo "本地 $name 为 $existing，需重新拉取 ${want_arch}"
  fi
  local mirrors=(
    "$name"
    "docker.m.daocloud.io/library/${name}"
    "docker.1ms.run/library/${name}"
    "docker.xuanyuan.me/library/${name}"
  )
  local m
  for m in "${mirrors[@]}"; do
    echo "拉取 --platform ${PLATFORM}: $m"
    if docker pull --platform "$PLATFORM" "$m"; then
      if [[ "$m" != "$name" ]]; then
        docker tag "$m" "$name"
      fi
      local arch
      arch="$(docker image inspect "$name" --format '{{.Architecture}}')"
      if [[ "$arch" != "$want_arch" ]]; then
        echo "架构不是 ${want_arch}: $name ($arch)，继续尝试下一源"
        continue
      fi
      echo "OK $name arch=$arch"
      return 0
    fi
  done
  echo "无法拉取 ${want_arch} 镜像: $name"
  return 1
}

# ---------------------------------------------------------------------------
log "1/7 清理并准备 deploy-offline（保留 Git 跟踪的脚本骨架，只清大产物）"
# ---------------------------------------------------------------------------
# 默认示例平台（可用 OFFLINE_OS / OFFLINE_ARCH 覆盖，如 ubuntu + arm64）
OFFLINE_OS="$(printf '%s' "${OFFLINE_OS:-centos}" | tr '[:upper:]' '[:lower:]')"
OFFLINE_ARCH="$(printf '%s' "${OFFLINE_ARCH:-amd64}" | tr '[:upper:]' '[:lower:]')"
case "$OFFLINE_ARCH" in
  amd64|x86_64) OFFLINE_ARCH=amd64; DOCKER_STATIC_ARCH=x86_64; COMPOSE_ARCH=x86_64; PLATFORM="linux/amd64" ;;
  arm64|aarch64) OFFLINE_ARCH=arm64; DOCKER_STATIC_ARCH=aarch64; COMPOSE_ARCH=aarch64; PLATFORM="linux/arm64" ;;
  *) echo "不支持的 OFFLINE_ARCH=$OFFLINE_ARCH（amd64|arm64）"; exit 1 ;;
esac
case "$OFFLINE_OS" in
  centos|ubuntu|debian) ;;
  *) echo "不支持的 OFFLINE_OS=$OFFLINE_OS（centos|ubuntu|debian）"; exit 1 ;;
esac
STATIC_BUNDLE="docker-static/${OFFLINE_OS}-${OFFLINE_ARCH}"

mkdir -p \
  "$OUT_DIR/docker-images" \
  "$OUT_DIR/frontend" \
  "$OUT_DIR/nginx/conf" \
  "$OUT_DIR/init-sql" \
  "$OUT_DIR/init/fpcu-seed" \
  "$OUT_DIR/centos-docker-static" \
  "$OUT_DIR/docker-static/centos-amd64" \
  "$OUT_DIR/docker-static/centos-arm64" \
  "$OUT_DIR/docker-static/ubuntu-amd64" \
  "$OUT_DIR/docker-static/ubuntu-arm64" \
  "$OUT_DIR/docker-static/debian-amd64" \
  "$OUT_DIR/docker-static/debian-arm64" \
  "$OUT_DIR/logs/api" \
  "$OUT_DIR/logs/nginx" \
  "$OUT_DIR/logs/fpcu2-nginx" \
  "$OUT_DIR/logs/fpcu2-bff" \
  "$OUT_DIR/data" \
  "$RELEASES_DIR"

# 只清理可再生的大产物，不整目录 rm（避免误删已跟踪脚本）
rm -rf "$OUT_DIR/docker-images"/*
rm -rf "$OUT_DIR/frontend/dist"
rm -rf "$OUT_DIR/init-sql"
rm -rf "$OUT_DIR/init/fpcu-seed"
mkdir -p "$OUT_DIR/docker-images" "$OUT_DIR/init-sql" "$OUT_DIR/init/fpcu-seed"
rm -f \
  "$OUT_DIR/centos-docker-static/docker-24.0.9.tgz" \
  "$OUT_DIR/centos-docker-static/docker-compose" \
  "$OUT_DIR/$STATIC_BUNDLE/docker-24.0.9.tgz" \
  "$OUT_DIR/$STATIC_BUNDLE/docker-compose"
rm -rf "$OUT_DIR/centos-docker-static/docker" "$OUT_DIR/$STATIC_BUNDLE/docker"
# 旧版曾放在仓库根的整包，若存在则移到 releases/
if [[ -f "$REPO_ROOT/$ARCHIVE_NAME" ]]; then
  mv -f "$REPO_ROOT/$ARCHIVE_NAME" "$ARCHIVE_PATH"
fi
rm -f "$ARCHIVE_PATH"

touch "$OUT_DIR/docker-images/.gitkeep" "$RELEASES_DIR/.gitkeep"
cp "$TEMPLATE_DIR/logs/api/.gitkeep" "$OUT_DIR/logs/api/.gitkeep"
cp "$TEMPLATE_DIR/logs/nginx/.gitkeep" "$OUT_DIR/logs/nginx/.gitkeep"
cp "$TEMPLATE_DIR/logs/fpcu2-nginx/.gitkeep" "$OUT_DIR/logs/fpcu2-nginx/.gitkeep"
mkdir -p "$OUT_DIR/logs/fpcu2-bff"
cp "$TEMPLATE_DIR/logs/fpcu2-bff/.gitkeep" "$OUT_DIR/logs/fpcu2-bff/.gitkeep"
cp "$TEMPLATE_DIR/data/.gitkeep" "$OUT_DIR/data/.gitkeep"

if [[ ! -d "$FPCU2_ROOT" ]]; then
  echo "找不到 FPCU2 源码目录: $FPCU2_ROOT"
  echo "请设置 FPCU2_ROOT=/path/to/FPCU2"
  exit 1
fi
echo "FPCU2_ROOT=$FPCU2_ROOT"

# ---------------------------------------------------------------------------
log "2/7 构建前端（含 ai-base）"
# ---------------------------------------------------------------------------
if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  pnpm install
fi
pnpm --filter ./AIBase_with_example/package/ai-base build
pnpm --filter ./frontend build
if [[ ! -d "$REPO_ROOT/frontend/dist" ]]; then
  echo "前端 dist 未生成"
  exit 1
fi
cp -R "$REPO_ROOT/frontend/dist" "$OUT_DIR/frontend/dist"

# ---------------------------------------------------------------------------
log "3/7 拉取基础镜像 (${PLATFORM}) 并构建 API"
# ---------------------------------------------------------------------------
BASE_IMAGES=(
  "nginx:1.25-alpine"
  "postgres:16-alpine"
  "mysql:8.0"
  "redis:7-alpine"
)
# API Dockerfile 的 FROM 依赖，必须先有对应架构的 node
pull_platform_image "node:22-bookworm"
for img in "${BASE_IMAGES[@]}"; do
  pull_platform_image "$img"
done

# dockerignore 必须放在 build context 根目录名为 .dockerignore
IGNORE_BACKUP=""
if [[ -f "$REPO_ROOT/.dockerignore" ]]; then
  IGNORE_BACKUP="$REPO_ROOT/.dockerignore.offline-bak"
  mv "$REPO_ROOT/.dockerignore" "$IGNORE_BACKUP"
fi
cp "$TEMPLATE_DIR/dockerignore.api" "$REPO_ROOT/.dockerignore"

cleanup_dockerignore() {
  rm -f "$REPO_ROOT/.dockerignore"
  if [[ -n "${IGNORE_BACKUP:-}" && -f "$IGNORE_BACKUP" ]]; then
    mv "$IGNORE_BACKUP" "$REPO_ROOT/.dockerignore"
  fi
}
trap cleanup_dockerignore EXIT

# 普通 docker build（需本机已有 amd64 的 node:22-bookworm）
docker build \
  --platform "$PLATFORM" \
  -f "$TEMPLATE_DIR/Dockerfile.api" \
  -t "$API_IMAGE" \
  "$REPO_ROOT"

cleanup_dockerignore
trap - EXIT

# ---------------------------------------------------------------------------
log "3b/7 构建 FPCU2 镜像 (${PLATFORM})"
# ---------------------------------------------------------------------------
FPCU_STAGING="$REPO_ROOT/.offline-fpcu2-staging"
rm -rf "$FPCU_STAGING"
mkdir -p "$FPCU_STAGING/fpcu2" "$FPCU_STAGING/docker/fpcu2-web"

rsync -a \
  --exclude node_modules \
  --exclude .git \
  --exclude EADAF-Deploy \
  --exclude .build-staging \
  --exclude .DS_Store \
  --exclude '**/dist' \
  "$FPCU2_ROOT/" "$FPCU_STAGING/fpcu2/"

cp "$TEMPLATE_DIR/fpcu2/bff/Dockerfile" "$FPCU_STAGING/fpcu2/Dockerfile.bff"
cp "$TEMPLATE_DIR/fpcu2/bff/dockerignore" "$FPCU_STAGING/fpcu2/.dockerignore"
cp "$TEMPLATE_DIR/fpcu2/web/Dockerfile" "$FPCU_STAGING/docker/fpcu2-web/Dockerfile"
cp "$TEMPLATE_DIR/fpcu2/web/nginx.conf.template" "$FPCU_STAGING/docker/fpcu2-web/nginx.conf.template"
cp "$TEMPLATE_DIR/fpcu2/web/docker-entrypoint.sh" "$FPCU_STAGING/docker/fpcu2-web/docker-entrypoint.sh"
chmod +x "$FPCU_STAGING/docker/fpcu2-web/docker-entrypoint.sh"

docker build \
  --platform "$PLATFORM" \
  -f "$FPCU_STAGING/fpcu2/Dockerfile.bff" \
  -t "$FPCU2_BFF_IMAGE" \
  "$FPCU_STAGING/fpcu2"

docker build \
  --platform "$PLATFORM" \
  -f "$FPCU_STAGING/docker/fpcu2-web/Dockerfile" \
  -t "$FPCU2_WEB_IMAGE" \
  "$FPCU_STAGING"

rm -rf "$FPCU_STAGING"

# ---------------------------------------------------------------------------
log "4/7 导出镜像 tar"
# ---------------------------------------------------------------------------
SAVE_IMAGES=(
  "$API_IMAGE"
  "$FPCU2_BFF_IMAGE"
  "$FPCU2_WEB_IMAGE"
  "${BASE_IMAGES[@]}"
)
for img in "${SAVE_IMAGES[@]}"; do
  filename="$(echo "$img" | tr ':' '_').tar"
  echo "docker save $img -> docker-images/$filename"
  docker save -o "$OUT_DIR/docker-images/$filename" "$img"

  arch="$(docker image inspect "$img" --format '{{.Architecture}}')"
  if [[ "$arch" != "$OFFLINE_ARCH" ]]; then
    echo "错误: $img 架构为 $arch，期望 $OFFLINE_ARCH"
    exit 1
  fi
  echo "OK $img arch=$arch"
done

# ---------------------------------------------------------------------------
log "5/7 下载静态 Docker + 组装配置（示例平台: ${OFFLINE_OS}-${OFFLINE_ARCH}）"
# ---------------------------------------------------------------------------
# Docker 静态包按 CPU 架构区分；同一 arch 下 CentOS/Ubuntu/Debian 共用二进制
STATIC_CACHE="$OUT_DIR/.docker-static-cache-${OFFLINE_ARCH}"
mkdir -p "$STATIC_CACHE"
download_with_fallback "$STATIC_CACHE/docker-24.0.9.tgz" \
  "https://mirrors.aliyun.com/docker-ce/linux/static/stable/${DOCKER_STATIC_ARCH}/docker-24.0.9.tgz" \
  "https://download.docker.com/linux/static/stable/${DOCKER_STATIC_ARCH}/docker-24.0.9.tgz"

download_with_fallback "$STATIC_CACHE/docker-compose" \
  "https://mirror.ghproxy.com/https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-linux-${COMPOSE_ARCH}" \
  "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-linux-${COMPOSE_ARCH}"
chmod +x "$STATIC_CACHE/docker-compose"

for os in centos ubuntu debian; do
  dest="$OUT_DIR/docker-static/${os}-${OFFLINE_ARCH}"
  mkdir -p "$dest"
  cp -f "$STATIC_CACHE/docker-24.0.9.tgz" "$dest/docker-24.0.9.tgz"
  cp -f "$STATIC_CACHE/docker-compose" "$dest/docker-compose"
  chmod +x "$dest/docker-compose"
done
rm -rf "$STATIC_CACHE"

# 兼容旧路径 centos-docker-static（仅当默认示例 arch=amd64）
mkdir -p "$OUT_DIR/centos-docker-static"
if [[ "$OFFLINE_ARCH" == "amd64" ]]; then
  cp -f "$OUT_DIR/docker-static/centos-amd64/docker-24.0.9.tgz" "$OUT_DIR/centos-docker-static/docker-24.0.9.tgz"
  cp -f "$OUT_DIR/docker-static/centos-amd64/docker-compose" "$OUT_DIR/centos-docker-static/docker-compose"
  chmod +x "$OUT_DIR/centos-docker-static/docker-compose"
fi
cp "$TEMPLATE_DIR/centos-docker-static/install-docker-static.sh" "$OUT_DIR/centos-docker-static/install-docker-static.sh"
cp "$TEMPLATE_DIR/docker-static/install-docker-static.sh" "$OUT_DIR/docker-static/install-docker-static.sh"
chmod +x \
  "$OUT_DIR/centos-docker-static/install-docker-static.sh" \
  "$OUT_DIR/docker-static/install-docker-static.sh"

cp "$TEMPLATE_DIR/docker-compose.yml" "$OUT_DIR/docker-compose.yml"
cp "$TEMPLATE_DIR/nginx/conf/default.conf" "$OUT_DIR/nginx/conf/default.conf"
cp "$TEMPLATE_DIR/env.template" "$OUT_DIR/env.template"
# 现场仍可用 .env；打包机用模板生成一份可编辑副本（不入库）
if [[ ! -f "$OUT_DIR/.env" ]]; then
  cp "$TEMPLATE_DIR/env.template" "$OUT_DIR/.env"
else
  # 保持现场已有 .env，同时刷新模板文件
  :
fi
cp "$TEMPLATE_DIR/lib.sh" "$OUT_DIR/lib.sh"
cp "$TEMPLATE_DIR/init-db.sh" "$OUT_DIR/init-db.sh"
cp "$TEMPLATE_DIR/seed-fpcu.sh" "$OUT_DIR/seed-fpcu.sh"
cp "$TEMPLATE_DIR/status.sh" "$OUT_DIR/status.sh"
cp "$TEMPLATE_DIR/ctl.sh" "$OUT_DIR/ctl.sh"
cp "$TEMPLATE_DIR/up.sh" "$OUT_DIR/up.sh"
cp "$TEMPLATE_DIR/start.sh" "$OUT_DIR/start.sh"
cp "$TEMPLATE_DIR/README-offline.md" "$OUT_DIR/README-offline.md"
cp "$TEMPLATE_DIR/init/fpcu-application.sql.template" "$OUT_DIR/init/fpcu-application.sql.template"
cp "$TEMPLATE_DIR/init/fix-db-connection.js" "$OUT_DIR/init/fix-db-connection.js"
# 预写打包时的示例平台，客户仍可用 ./start.sh 重选
cat >"$OUT_DIR/.deploy-platform" <<EOF
# 打包默认示例平台；客户可用 ./start.sh 重新选择
DEPLOY_OS=${OFFLINE_OS}
DEPLOY_ARCH=${OFFLINE_ARCH}
EOF
chmod +x \
  "$OUT_DIR/lib.sh" \
  "$OUT_DIR/init-db.sh" \
  "$OUT_DIR/seed-fpcu.sh" \
  "$OUT_DIR/status.sh" \
  "$OUT_DIR/ctl.sh" \
  "$OUT_DIR/up.sh" \
  "$OUT_DIR/start.sh" \
  "$OUT_DIR/centos-docker-static/install-docker-static.sh" \
  "$OUT_DIR/docker-static/install-docker-static.sh"

# FPCU seed 脚本（来自 FPCU2 仓库）
for seed in seed-fpcu-bizdata.mjs seed-fpcu-api-services.mjs seed-fpcu-device-mock.mjs; do
  src="$FPCU2_ROOT/backend/scripts/$seed"
  if [[ ! -f "$src" ]]; then
    echo "缺少 FPCU seed: $src"
    exit 1
  fi
  cp "$src" "$OUT_DIR/init/fpcu-seed/$seed"
done

# init SQL（与 initdb.sh 默认列表一致）
SQL_FILES=(
  schemas.sql
  seed-eadaf-application.sql
  aibase-schema.sql
  aibase-skill-tool-schema.sql
  bizdata-schema.sql
  migrate-bizdata-api-services.sql
  migrate-bizdata-api-exception-responses.sql
  migrate-bizdata-collection-pipelines.sql
  migrate-outbound-webhooks.sql
  migrate-builtin-api-system.sql
  migrate-operation-log-audit.sql
  migrate-department-roles.sql
  migrate-permission-access-restriction.sql
  migrate-bizdata-api-services-optional-entity.sql
  migrate-bizdata-api-services-form-v2.sql
  migrate-bizdata-metrics.sql
  migrate-bizdata-metrics-cron.sql
  migrate-bizdata-metric-cards.sql
  migrate-bizdata-scope-docs.sql
  migrate-bizdata-data-standards.sql
  migrate-bizdata-metadata-catalog.sql
  migrate-apiservice-transport-protocols.sql
  migrate-outbound-webhooks-contract.sql
  migrate-skill-completion-strategy.sql
  migrate-api-request-log-tool-audit.sql
  migrate-hook-center.sql
  migrate-application-outbound-webhook-scope.sql
  migrate-system-storage-bucket.sql
  migrate-eadaf-ai-skills.sql
  20260710_add_model_rate_limit.sql
  migrate-app-transfer-permissions.sql
  migrate-platform-transfer-permissions.sql
  uac-permissions-catalog-seed.sql
  superadmin.sql
)
for name in "${SQL_FILES[@]}"; do
  src="$REPO_ROOT/backend/scripts/$name"
  if [[ ! -f "$src" ]]; then
    echo "缺少 SQL: $src"
    exit 1
  fi
  cp "$src" "$OUT_DIR/init-sql/$name"
done

# 脚本统一 LF
if [[ "$(uname -s)" == "Darwin" ]]; then
  find "$OUT_DIR" -type f \( -name '*.sh' -o -name '*.yml' -o -name '.env' -o -name '*.conf' \) \
    -exec sed -i '' $'s/\r$//' {} +
else
  find "$OUT_DIR" -type f \( -name '*.sh' -o -name '*.yml' -o -name '.env' -o -name '*.conf' \) \
    -exec sed -i 's/\r$//' {} +
fi

find "$OUT_DIR" -name '.DS_Store' -delete

# 强制校验：包内无 node_modules
if find "$OUT_DIR" -type d -name node_modules | grep -q .; then
  echo "错误: deploy-offline 内发现 node_modules"
  exit 1
fi

# 清理可能残留的 staging
rm -rf "$REPO_ROOT/.offline-fpcu2-staging"

# ---------------------------------------------------------------------------
log "6/7 打包到 deploy-offline/releases/${ARCHIVE_NAME}"
# ---------------------------------------------------------------------------
# 压缩包不包含 releases/ 自身，避免套娃
rm -f "$ARCHIVE_PATH"
tar -C "$REPO_ROOT" \
  --exclude='deploy-offline/releases' \
  --exclude='deploy-offline/.env' \
  --exclude='deploy-offline/**/.DS_Store' \
  -zcvf "$ARCHIVE_PATH" \
  deploy-offline

log "完成"
echo "目录: $OUT_DIR"
echo "压缩包: $ARCHIVE_PATH"
echo "含示例业务应用 FPCU2: $FPCU2_ROOT"
echo "平台示例: ${OFFLINE_OS}-${OFFLINE_ARCH} (PLATFORM=$PLATFORM)"
echo "镜像:"
ls -lh "$OUT_DIR/docker-images"
echo "静态 Docker (${OFFLINE_ARCH}，已写入 centos/ubuntu/debian):"
ls -lh "$OUT_DIR/docker-static/centos-${OFFLINE_ARCH}"
echo "releases:"
ls -lh "$RELEASES_DIR"
