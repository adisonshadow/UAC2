#!/usr/bin/env bash
# scripts/offline-patch.sh
#
# 为本机已部署的 deploy-offline 打「单模块升级小包」，方便发给客户。
# 支持 4 个应用服务：eadaf-api | eadaf-web | fpcu2-bff | fpcu2-web
#
# 用法：
#   pnpm offline:patch eadaf-api
#   pnpm offline:patch eadaf-web
#   pnpm offline:patch fpcu2-bff
#   pnpm offline:patch fpcu2-web
#   pnpm offline:patch all
#
# 环境变量：
#   FPCU2_ROOT   FPCU2 源码目录（默认 /Volumes/dev/Asset-Management-Hub803/FPCU2）
#   PLATFORM     默认 linux/amd64
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/offline"
PLATFORM="${PLATFORM:-linux/amd64}"
FPCU2_ROOT="${FPCU2_ROOT:-/Volumes/dev/Asset-Management-Hub803/FPCU2}"
PATCH_VERSION="${PATCH_VERSION:-v1.0}"

API_IMAGE="eadaf-api:v1"
FPCU2_BFF_IMAGE="fpcu2-bff:v1"
FPCU2_WEB_IMAGE="fpcu2-web:v1"

cd "$REPO_ROOT"

log() { printf '\n==== %s ====\n' "$*"; }
die() { printf '[ERR] %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1"
}

need_cmd docker
need_cmd tar
need_cmd rsync

docker info >/dev/null 2>&1 || die "Docker 未运行"

APP_MODULES=(eadaf-api eadaf-web fpcu2-bff fpcu2-web)

usage() {
  cat <<EOF
用法: pnpm offline:patch <module|all>

模块:
  eadaf-api     重建 API 镜像小包
  eadaf-web     重建 EADAF 前端静态资源小包（+ nginx 镜像可选）
  fpcu2-bff     重建 FPCU2 BFF 镜像小包
  fpcu2-web     重建 FPCU2 Web 镜像小包
  all           依次打出以上 4 个独立包

产物（deploy-offline/releases/）:
  deploy-offline/releases/deploy-offline-patch-<module>-${PATCH_VERSION}/
  deploy-offline/releases/deploy-offline-patch-<module>-${PATCH_VERSION}.tar.gz
  deploy-offline/releases/deploy-offline-patch-<module>-${PATCH_VERSION}.md   # 同级简要安装说明

客户侧：
  tar -zxvf deploy-offline-patch-<module>-${PATCH_VERSION}.tar.gz
  cd deploy-offline-patch-<module>-${PATCH_VERSION}
  DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
EOF
}

resolve_targets() {
  local arg="${1:-}"
  case "$arg" in
    ""|-h|--help|help)
      usage
      exit 0
      ;;
    all)
      printf '%s\n' "${APP_MODULES[@]}"
      ;;
    eadaf-api|eadaf-web|fpcu2-bff|fpcu2-web)
      printf '%s\n' "$arg"
      ;;
    *)
      usage >&2
      die "未知模块: $arg（可选: ${APP_MODULES[*]} all）"
      ;;
  esac
}

pull_amd64_if_needed() {
  local name="$1"
  if docker image inspect "$name" >/dev/null 2>&1; then
    local arch
    arch="$(docker image inspect "$name" --format '{{.Architecture}}')"
    if [[ "$arch" == "amd64" ]]; then
      echo "本地已有 amd64: $name"
      return 0
    fi
  fi
  local mirrors=(
    "$name"
    "docker.m.daocloud.io/library/${name}"
    "docker.1ms.run/library/${name}"
  )
  local m
  for m in "${mirrors[@]}"; do
    echo "拉取 --platform ${PLATFORM}: $m"
    if docker pull --platform "$PLATFORM" "$m"; then
      [[ "$m" != "$name" ]] && docker tag "$m" "$name"
      return 0
    fi
  done
  die "无法拉取 amd64 镜像: $name"
}

write_apply_sh() {
  local out_dir="$1"
  local module="$2"
  cat >"$out_dir/apply.sh" <<EOF
#!/usr/bin/env bash
# 将本补丁应用到现场 deploy-offline 目录
set -euo pipefail

PATCH_ROOT="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
MODULE="${module}"

# 定位现场部署根目录
if [[ -n "\${DEPLOY_ROOT:-}" ]]; then
  :
elif [[ -f "\$PATCH_ROOT/../deploy-offline/docker-compose.yml" ]]; then
  DEPLOY_ROOT="\$(cd "\$PATCH_ROOT/../deploy-offline" && pwd)"
elif [[ -f "\$PATCH_ROOT/../../deploy-offline/docker-compose.yml" ]]; then
  DEPLOY_ROOT="\$(cd "\$PATCH_ROOT/../../deploy-offline" && pwd)"
elif [[ -f "./docker-compose.yml" && -d "./docker-images" ]]; then
  DEPLOY_ROOT="\$(pwd)"
else
  echo "请设置 DEPLOY_ROOT=/path/to/deploy-offline"
  echo "示例: DEPLOY_ROOT=/opt/deploy-offline ./apply.sh"
  exit 1
fi

DEPLOY_ROOT="\$(cd "\$DEPLOY_ROOT" && pwd)"
echo "DEPLOY_ROOT=\$DEPLOY_ROOT"
echo "MODULE=\$MODULE"

if [[ ! -f "\$DEPLOY_ROOT/docker-compose.yml" ]]; then
  echo "错误: \$DEPLOY_ROOT 不是有效的 deploy-offline（缺少 docker-compose.yml）"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker"
  exit 1
fi

COMPOSE=(docker-compose)
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
fi

compose() { (cd "\$DEPLOY_ROOT" && "\${COMPOSE[@]}" "\$@"); }

case "\$MODULE" in
  eadaf-api)
    tar_file="\$PATCH_ROOT/docker-images/eadaf-api_v1.tar"
    [[ -f "\$tar_file" ]] || { echo "缺少 \$tar_file"; exit 1; }
    docker load -i "\$tar_file"
    mkdir -p "\$DEPLOY_ROOT/docker-images"
    cp -f "\$tar_file" "\$DEPLOY_ROOT/docker-images/"
    compose up -d --force-recreate --no-deps eadaf-api
    echo "等待 EADAF-api healthy..."
    api_ok=0
    for _i in \$(seq 1 90); do
      _h="\$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' EADAF-api 2>/dev/null || echo missing)"
      if [[ "\$_h" == "healthy" ]]; then
        api_ok=1
        break
      fi
      sleep 2
    done
    if [[ "\$api_ok" -ne 1 ]]; then
      echo "警告: EADAF-api 未在时限内变 healthy（当前=\$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' EADAF-api 2>/dev/null || echo missing)）"
      echo "请检查: docker logs --tail 100 EADAF-api; ls -la \"\$DEPLOY_ROOT/logs/api\""
    else
      echo "EADAF-api healthy；补起依赖它的 web/bff（若此前 up.sh 中断会缺失）"
      # 不用 --no-deps：让 compose 按 depends_on 等待 api healthy
      compose up -d eadaf-web fpcu2-bff fpcu2-web || true
    fi
    ;;
  eadaf-web)
    [[ -d "\$PATCH_ROOT/frontend/dist" ]] || { echo "缺少 frontend/dist"; exit 1; }
    [[ -f "\$PATCH_ROOT/frontend/dist/index.html" ]] || { echo "缺少 frontend/dist/index.html"; exit 1; }
    mkdir -p "\$DEPLOY_ROOT/frontend"
    rm -rf "\$DEPLOY_ROOT/frontend/dist"
    cp -R "\$PATCH_ROOT/frontend/dist" "\$DEPLOY_ROOT/frontend/dist"
    if [[ -f "\$PATCH_ROOT/nginx/conf/default.conf" ]]; then
      mkdir -p "\$DEPLOY_ROOT/nginx/conf"
      cp -f "\$PATCH_ROOT/nginx/conf/default.conf" "\$DEPLOY_ROOT/nginx/conf/default.conf"
    fi
    if [[ -f "\$PATCH_ROOT/docker-images/nginx_1.25-alpine.tar" ]]; then
      docker load -i "\$PATCH_ROOT/docker-images/nginx_1.25-alpine.tar"
      cp -f "\$PATCH_ROOT/docker-images/nginx_1.25-alpine.tar" "\$DEPLOY_ROOT/docker-images/" 2>/dev/null || true
    fi
    # 旧容器名兼容
    docker rm -f EADAF-nginx >/dev/null 2>&1 || true
    compose up -d --force-recreate --no-deps eadaf-web
    ;;
  fpcu2-bff)
    tar_file="\$PATCH_ROOT/docker-images/fpcu2-bff_v1.tar"
    [[ -f "\$tar_file" ]] || { echo "缺少 \$tar_file"; exit 1; }
    docker load -i "\$tar_file"
    mkdir -p "\$DEPLOY_ROOT/docker-images" "\$DEPLOY_ROOT/logs/fpcu2-bff"
    cp -f "\$tar_file" "\$DEPLOY_ROOT/docker-images/"
    # 同步编排（含比对流水日志挂载 ./logs/fpcu2-bff）
    if [[ -f "\$PATCH_ROOT/docker-compose.yml" ]]; then
      cp -f "\$PATCH_ROOT/docker-compose.yml" "\$DEPLOY_ROOT/docker-compose.yml"
      echo "已更新 docker-compose.yml（含 JZ_COMPARE_FLOW_LOG 挂载）"
    fi
    compose up -d --force-recreate --no-deps fpcu2-bff
    ;;
  fpcu2-web)
    tar_file="\$PATCH_ROOT/docker-images/fpcu2-web_v1.tar"
    [[ -f "\$tar_file" ]] || { echo "缺少 \$tar_file"; exit 1; }
    docker load -i "\$tar_file"
    mkdir -p "\$DEPLOY_ROOT/docker-images"
    cp -f "\$tar_file" "\$DEPLOY_ROOT/docker-images/"
    if [[ -f "\$PATCH_ROOT/docker-compose.yml" ]]; then
      cp -f "\$PATCH_ROOT/docker-compose.yml" "\$DEPLOY_ROOT/docker-compose.yml"
      echo "已更新 docker-compose.yml"
    fi
    compose up -d --force-recreate --no-deps fpcu2-web
    ;;
  *)
    echo "未知模块: \$MODULE"
    exit 1
    ;;
esac

echo ""
echo "补丁已应用: \$MODULE"
if [[ -x "\$DEPLOY_ROOT/ctl.sh" ]]; then
  "\$DEPLOY_ROOT/ctl.sh" status || true
elif [[ -x "\$DEPLOY_ROOT/status.sh" ]]; then
  "\$DEPLOY_ROOT/status.sh" || true
else
  compose ps
fi
EOF
  chmod +x "$out_dir/apply.sh"
}

write_readme() {
  local out_dir="$1"
  local module="$2"
  cat >"$out_dir/README.md" <<EOF
# 离线升级补丁：${module}

独立小包，用于升级现场 \`deploy-offline\` 中的 **${module}**，无需整包重装。

## 客户侧应用

\`\`\`bash
tar -zxvf deploy-offline-patch-${module}-${PATCH_VERSION}.tar.gz
cd deploy-offline-patch-${module}-${PATCH_VERSION}

# 指定现场部署目录
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
\`\`\`

若补丁目录与 \`deploy-offline\` 同级，也可省略 \`DEPLOY_ROOT\`（脚本会自动探测）。

## 说明

- 只覆盖/重建 **${module}**，不删数据库 volume
- 应用后可用现场 \`./ctl.sh status\` 巡检
- 非本地 Mock 比对流水日志：\`logs/fpcu2-bff/jz-compare-flow.log\`
EOF
}

# 与 .tar.gz 同级的简要安装说明（便于不解压也能看到步骤）
write_sidecar_install_md() {
  local module="$1"
  local archive_path="$2"
  local md_path="${archive_path%.tar.gz}.md"
  local archive_name
  archive_name="$(basename "$archive_path")"
  local dir_name="${archive_name%.tar.gz}"

  cat >"$md_path" <<EOF
# ${module} 离线补丁（${PATCH_VERSION}）

独立小包，用于升级现场 \`deploy-offline\` 中的 **${module}**，无需整包重装。

## 应用步骤

\`\`\`bash
tar -zxvf ${archive_name}
cd ${dir_name}

# 指定现场部署目录（按实际路径修改）
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
\`\`\`

若补丁目录与 \`deploy-offline\` **同级**，可省略 \`DEPLOY_ROOT\`：

\`\`\`bash
./apply.sh
\`\`\`

回到现场目录巡检：

\`\`\`bash
cd /path/to/deploy-offline
./status.sh
\`\`\`

## 若其它应用容器仍缺失

本补丁主要重建 **${module}**。若先前 \`./up.sh\` 在依赖失败处退出，\`eadaf-web\` / \`fpcu2-bff\` / \`fpcu2-web\` 可能仍是 missing。目标服务正常后执行：

\`\`\`bash
cd /path/to/deploy-offline
./up.sh
# 或只补三个应用：
# docker compose up -d eadaf-web fpcu2-bff fpcu2-web
./status.sh
\`\`\`

不要执行 \`docker compose down -v\`（会清掉数据库数据卷）。

## 说明

- 不删 postgres / redis / mysql 数据卷
- 包内另有 \`README.md\`；本文档与压缩包同级，便于现场直接查看
EOF
  echo "安装说明: $md_path"
}

build_eadaf_api() {
  local out_dir="$1"
  log "构建 eadaf-api (${PLATFORM})"
  pull_amd64_if_needed "node:22-bookworm"

  local IGNORE_BACKUP=""
  if [[ -f "$REPO_ROOT/.dockerignore" ]]; then
    IGNORE_BACKUP="$REPO_ROOT/.dockerignore.offline-bak"
    mv "$REPO_ROOT/.dockerignore" "$IGNORE_BACKUP"
  fi
  cp "$TEMPLATE_DIR/dockerignore.api" "$REPO_ROOT/.dockerignore"
  cleanup() {
    rm -f "$REPO_ROOT/.dockerignore"
    if [[ -n "${IGNORE_BACKUP:-}" && -f "$IGNORE_BACKUP" ]]; then
      mv "$IGNORE_BACKUP" "$REPO_ROOT/.dockerignore"
    fi
  }
  trap cleanup EXIT

  docker build --platform "$PLATFORM" \
    -f "$TEMPLATE_DIR/Dockerfile.api" \
    -t "$API_IMAGE" \
    "$REPO_ROOT"
  cleanup
  trap - EXIT

  mkdir -p "$out_dir/docker-images"
  docker save -o "$out_dir/docker-images/eadaf-api_v1.tar" "$API_IMAGE"
}

build_eadaf_web() {
  local out_dir="$1"
  log "构建 eadaf-web 静态资源"
  need_cmd pnpm
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    pnpm install
  fi
  pnpm --filter ./AIBase_with_example/package/ai-base build
  pnpm --filter ./frontend build
  [[ -f "$REPO_ROOT/frontend/dist/index.html" ]] || die "frontend dist 未生成"

  mkdir -p "$out_dir/frontend" "$out_dir/nginx/conf" "$out_dir/docker-images"
  cp -R "$REPO_ROOT/frontend/dist" "$out_dir/frontend/dist"
  cp "$TEMPLATE_DIR/nginx/conf/default.conf" "$out_dir/nginx/conf/default.conf"

  # nginx 基础镜像一并带上，方便客户机缺镜像时 load
  pull_amd64_if_needed "nginx:1.25-alpine"
  docker save -o "$out_dir/docker-images/nginx_1.25-alpine.tar" "nginx:1.25-alpine"
}

build_fpcu2_bff() {
  local out_dir="$1"
  [[ -d "$FPCU2_ROOT" ]] || die "找不到 FPCU2: $FPCU2_ROOT（可设 FPCU2_ROOT）"
  log "构建 fpcu2-bff (${PLATFORM}) from $FPCU2_ROOT"
  pull_amd64_if_needed "node:22-bookworm"

  local staging="$REPO_ROOT/.offline-fpcu2-staging-patch"
  rm -rf "$staging"
  mkdir -p "$staging"
  rsync -a \
    --exclude node_modules --exclude .git --exclude EADAF-Deploy \
    --exclude .build-staging --exclude .DS_Store --exclude '**/dist' \
    "$FPCU2_ROOT/" "$staging/"
  cp "$TEMPLATE_DIR/fpcu2/bff/Dockerfile" "$staging/Dockerfile"
  cp "$TEMPLATE_DIR/fpcu2/bff/dockerignore" "$staging/.dockerignore"

  docker build --platform "$PLATFORM" \
    -f "$staging/Dockerfile" \
    -t "$FPCU2_BFF_IMAGE" \
    "$staging"
  rm -rf "$staging"

  mkdir -p "$out_dir/docker-images"
  docker save -o "$out_dir/docker-images/fpcu2-bff_v1.tar" "$FPCU2_BFF_IMAGE"
  # 现场 apply 时同步编排（日志挂载等）
  cp "$TEMPLATE_DIR/docker-compose.yml" "$out_dir/docker-compose.yml"
}

build_fpcu2_web() {
  local out_dir="$1"
  [[ -d "$FPCU2_ROOT" ]] || die "找不到 FPCU2: $FPCU2_ROOT（可设 FPCU2_ROOT）"
  log "构建 fpcu2-web (${PLATFORM}) from $FPCU2_ROOT"
  pull_amd64_if_needed "node:22-bookworm"
  pull_amd64_if_needed "nginx:1.25-alpine"

  local staging="$REPO_ROOT/.offline-fpcu2-staging-patch"
  rm -rf "$staging"
  mkdir -p "$staging/fpcu2" "$staging/docker/fpcu2-web"
  rsync -a \
    --exclude node_modules --exclude .git --exclude EADAF-Deploy \
    --exclude .build-staging --exclude .DS_Store --exclude '**/dist' \
    "$FPCU2_ROOT/" "$staging/fpcu2/"
  cp "$TEMPLATE_DIR/fpcu2/web/Dockerfile" "$staging/docker/fpcu2-web/Dockerfile"
  cp "$TEMPLATE_DIR/fpcu2/web/nginx.conf.template" "$staging/docker/fpcu2-web/nginx.conf.template"
  cp "$TEMPLATE_DIR/fpcu2/web/docker-entrypoint.sh" "$staging/docker/fpcu2-web/docker-entrypoint.sh"
  chmod +x "$staging/docker/fpcu2-web/docker-entrypoint.sh"

  docker build --platform "$PLATFORM" \
    -f "$staging/docker/fpcu2-web/Dockerfile" \
    -t "$FPCU2_WEB_IMAGE" \
    "$staging"
  rm -rf "$staging"

  mkdir -p "$out_dir/docker-images"
  docker save -o "$out_dir/docker-images/fpcu2-web_v1.tar" "$FPCU2_WEB_IMAGE"
  cp "$TEMPLATE_DIR/docker-compose.yml" "$out_dir/docker-compose.yml"
}

pack_module() {
  local module="$1"
  local releases_dir="$REPO_ROOT/deploy-offline/releases"
  local dir_name="deploy-offline-patch-${module}-${PATCH_VERSION}"
  local out_dir="$releases_dir/$dir_name"
  local archive="${dir_name}.tar.gz"
  local archive_path="$releases_dir/$archive"

  mkdir -p "$releases_dir"
  touch "$releases_dir/.gitkeep"

  log "打包模块补丁: $module"
  rm -rf "$out_dir"
  # 兼容旧版根目录产物
  rm -rf "$REPO_ROOT/$dir_name" "$REPO_ROOT/$archive"
  mkdir -p "$out_dir"

  case "$module" in
    eadaf-api) build_eadaf_api "$out_dir" ;;
    eadaf-web) build_eadaf_web "$out_dir" ;;
    fpcu2-bff) build_fpcu2_bff "$out_dir" ;;
    fpcu2-web) build_fpcu2_web "$out_dir" ;;
  esac

  write_apply_sh "$out_dir" "$module"
  write_readme "$out_dir" "$module"

  find "$out_dir" -name '.DS_Store' -delete
  rm -f "$archive_path"
  # 在 releases/ 内打包，包内顶层目录名为 deploy-offline-patch-...
  tar -C "$releases_dir" -zcf "$archive_path" "$dir_name"
  # 解压后的工作目录体积大，打完包可删，只留 tar 给客户
  rm -rf "$out_dir"
  # 与 tar.gz 同级的简要安装文档（不解压也能看）
  write_sidecar_install_md "$module" "$archive_path"

  log "完成 $module"
  echo "压缩包: $archive_path"
  du -sh "$archive_path"
}

# ---------------------------------------------------------------------------
ARG="${1:-}"
case "$ARG" in
  ""|-h|--help|help)
    usage
    exit 0
    ;;
esac

TARGETS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && TARGETS+=("$line")
done < <(resolve_targets "$ARG")

[[ ${#TARGETS[@]} -gt 0 ]] || die "未指定模块"

for m in "${TARGETS[@]}"; do
  pack_module "$m"
done

log "全部补丁已生成（目录: deploy-offline/releases/）"
for m in "${TARGETS[@]}"; do
  echo "  - deploy-offline/releases/deploy-offline-patch-${m}-${PATCH_VERSION}.tar.gz"
  echo "  - deploy-offline/releases/deploy-offline-patch-${m}-${PATCH_VERSION}.md"
done
