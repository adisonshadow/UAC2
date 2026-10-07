#!/usr/bin/env bash
# Shell A：交互或参数打包 EADAF 平台（不含业务应用）。
#   bash scripts/deploy/pack-eadaf.sh
#   bash scripts/deploy/pack-eadaf.sh --mode offline --os centos --arch amd64 --kind install --non-interactive --yes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib-pack.sh"

MODE=""
OS_NAME=""
ARCH=""
KIND=""
PATCH_PARTS=""
WEB_PORT=""
API_PORT=""
VERSION=""
OUT_DIR=""
NONINT=0
ASSUME_YES=0

usage() {
  cat <<'EOF'
用法: bash scripts/deploy/pack-eadaf.sh [选项]

  --mode offline|normal|k8s
  --os centos|ubuntu|debian     默认发行版（写入包内，离线包仍含三种安装脚本）
  --arch amd64|arm64
  --kind install|upgrade|patch
  --patch web,api,bizdata       补丁种类，可逗号组合
  --web-port N                  仅安装包，默认 9527
  --api-port N                  仅安装包，默认 9526
  --version VER                 默认 package.json
  --out DIR                     默认 <仓库>/deploy/EADAF
  --non-interactive             缺参即失败，不再提问
  --yes                         跳过确认
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="${2:-}"; shift 2 ;;
    --os) OS_NAME="${2:-}"; shift 2 ;;
    --arch) ARCH="${2:-}"; shift 2 ;;
    --kind) KIND="${2:-}"; shift 2 ;;
    --patch) PATCH_PARTS="${2:-}"; shift 2 ;;
    --web-port) WEB_PORT="${2:-}"; shift 2 ;;
    --api-port) API_PORT="${2:-}"; shift 2 ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    --out) OUT_DIR="${2:-}"; shift 2 ;;
    --non-interactive) NONINT=1; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "未知参数: $1（见 --help）" ;;
  esac
done

ask() {
  local prompt="$1" default="${2:-}" answer
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default]: " answer
    echo "${answer:-$default}"
  else
    read -r -p "$prompt: " answer
    echo "$answer"
  fi
}

if [[ "$NONINT" != "1" && -t 0 ]]; then
  [[ -n "$MODE" ]] || {
    echo "模式:"
    echo "  1) 离线  2) 普通  3) K8s"
    read -r -p "选择 [1-3]: " c
    case "$c" in
      1) MODE=offline ;;
      2) MODE=normal ;;
      3) MODE=k8s ;;
      *) die "无效模式" ;;
    esac
  }
  if [[ "$MODE" != "k8s" && -z "$OS_NAME" ]]; then
    echo "默认发行版（包内仍带齐 CentOS / Ubuntu / Debian 的安装脚本）:"
    echo "  1) centos  2) ubuntu  3) debian"
    read -r -p "选择 [1-3，回车=centos]: " c
    case "${c:-1}" in
      1) OS_NAME=centos ;;
      2) OS_NAME=ubuntu ;;
      3) OS_NAME=debian ;;
      *) die "无效发行版" ;;
    esac
  fi
  [[ -n "$ARCH" ]] || {
    echo "CPU 架构:"
    echo "  1) amd64  2) arm64"
    read -r -p "选择 [1-2，回车=amd64]: " c
    case "${c:-1}" in
      1) ARCH=amd64 ;;
      2) ARCH=arm64 ;;
      *) die "无效架构" ;;
    esac
  }
  [[ -n "$KIND" ]] || {
    echo "种类:"
    echo "  1) 安装  2) 升级  3) 补丁"
    read -r -p "选择 [1-3]: " c
    case "$c" in
      1) KIND=install ;;
      2) KIND=upgrade ;;
      3) KIND=patch ;;
      *) die "无效种类" ;;
    esac
  }
  if [[ "$KIND" == "patch" && -z "$PATCH_PARTS" ]]; then
    echo "补丁种类（可多选，逗号分隔）:"
    echo "  1) 前端程序 web  2) 后端程序 api  3) 数据 bizdata"
    read -r -p "选择，例如 1,3: " c
    PATCH_PARTS=""
    IFS=',' read -r -a arr <<<"$c"
    for item in "${arr[@]}"; do
      item="$(printf '%s' "$item" | tr -d '[:space:]')"
      case "$item" in
        1|web) PATCH_PARTS="${PATCH_PARTS:+$PATCH_PARTS,}web" ;;
        2|api) PATCH_PARTS="${PATCH_PARTS:+$PATCH_PARTS,}api" ;;
        3|bizdata) PATCH_PARTS="${PATCH_PARTS:+$PATCH_PARTS,}bizdata" ;;
        *) die "无效补丁种类: $item" ;;
      esac
    done
  fi
  if [[ "$KIND" == "install" ]]; then
    WEB_PORT="$(ask "前端宿主机端口" "${WEB_PORT:-9527}")"
    API_PORT="$(ask "后端宿主机端口" "${API_PORT:-9526}")"
  fi
  VERSION="$(ask "版本" "${VERSION:-$(package_version)}")"
  OUT_DIR="$(ask "输出目录" "${OUT_DIR:-$REPO_ROOT/deploy/EADAF}")"
else
  [[ -n "$MODE" && -n "$KIND" && -n "$ARCH" ]] || die "非交互模式需要 --mode --kind --arch"
  [[ "$KIND" != "patch" || -n "$PATCH_PARTS" ]] || die "补丁需要 --patch web,api,bizdata"
  OS_NAME="${OS_NAME:-centos}"
  WEB_PORT="${WEB_PORT:-9527}"
  API_PORT="${API_PORT:-9526}"
  VERSION="${VERSION:-$(package_version)}"
  OUT_DIR="${OUT_DIR:-$REPO_ROOT/deploy/EADAF}"
  ASSUME_YES=1
fi

MODE="$(printf '%s' "$MODE" | tr '[:upper:]' '[:lower:]')"
KIND="$(printf '%s' "$KIND" | tr '[:upper:]' '[:lower:]')"
case "$MODE" in
  offline|normal|k8s) ;;
  *) die "不支持的模式: $MODE" ;;
esac
case "$KIND" in
  install|upgrade|patch) ;;
  *) die "不支持的种类: $KIND" ;;
esac
ARCH="$(normalize_arch "$ARCH")" || die "不支持的架构: $ARCH"
if [[ "$MODE" != "k8s" ]]; then
  OS_NAME="$(normalize_os "${OS_NAME:-centos}")" || die "不支持的发行版: $OS_NAME"
else
  OS_NAME="${OS_NAME:-centos}"
fi
PLATFORM="$(platform_of_arch "$ARCH")"

PATCH_SLUG=""
NEED_WEB=0
NEED_API=0
NEED_BIZ=0
NEED_BASE=0
NEED_SQL=0
if [[ "$KIND" == "install" ]]; then
  NEED_WEB=1; NEED_API=1; NEED_BASE=1; NEED_SQL=1
elif [[ "$KIND" == "upgrade" ]]; then
  NEED_WEB=1; NEED_API=1; NEED_SQL=1
else
  IFS=',' read -r -a parts <<<"$PATCH_PARTS"
  for p in "${parts[@]}"; do
    p="$(printf '%s' "$p" | tr -d '[:space:]')"
    case "$p" in
      web) NEED_WEB=1 ;;
      api) NEED_API=1 ;;
      bizdata) NEED_BIZ=1 ;;
      *) die "未知补丁种类: $p" ;;
    esac
    PATCH_SLUG="${PATCH_SLUG:+$PATCH_SLUG+}$p"
  done
  [[ -n "$PATCH_SLUG" ]] || die "未选择补丁种类"
fi

DATE_STAMP="$(date +%Y%m%d)"
if [[ "$KIND" == "patch" ]]; then
  if [[ "$NEED_WEB" == "0" && "$NEED_API" == "0" ]]; then
    ARCHIVE="eadaf-${MODE}-patch-${PATCH_SLUG}-v${VERSION}-${DATE_STAMP}.tar.gz"
  else
    ARCHIVE="eadaf-${MODE}-patch-${PATCH_SLUG}-${ARCH}-v${VERSION}-${DATE_STAMP}.tar.gz"
  fi
else
  ARCHIVE="eadaf-${MODE}-${KIND}-${ARCH}-v${VERSION}-${DATE_STAMP}.tar.gz"
fi

echo ""
echo "摘要"
echo "  模式: $MODE"
echo "  发行版默认: $OS_NAME"
echo "  架构: $ARCH"
echo "  种类: $KIND ${PATCH_SLUG:+($PATCH_SLUG)}"
if [[ "$KIND" == "install" ]]; then
  echo "  端口: web=$WEB_PORT api=$API_PORT（只改宿主机映射）"
fi
echo "  版本: $VERSION"
echo "  输出: $OUT_DIR/$ARCHIVE"
confirm_or_die "$ASSUME_YES"

if [[ "$NEED_API" == "1" || "$NEED_BASE" == "1" || "$NEED_WEB" == "1" ]]; then
  need_cmd docker
  docker info >/dev/null 2>&1 || die "Docker 未运行"
fi
if [[ "$NEED_WEB" == "1" || "$NEED_SQL" == "1" ]]; then
  need_cmd pnpm
fi
need_cmd tar
need_cmd curl

STAGE="$(mktemp -d "$REPO_ROOT/deploy/.staging.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
INNER="deploy-offline"
if [[ "$KIND" != "install" ]]; then
  INNER="${ARCHIVE%.tar.gz}"
fi
DEST="$STAGE/$INNER"
mkdir -p "$DEST"

if [[ "$KIND" == "install" || "$KIND" == "upgrade" ]]; then
  copy_runtime_skeleton "$DEST"
  if [[ "$KIND" == "install" ]]; then
    write_install_env "$DEST" "$WEB_PORT" "$API_PORT"
    cat >"$DEST/.deploy-mode" <<EOF
DEPLOY_MODE=${MODE}
DEPLOY_KIND=install
EOF
    cat >"$DEST/.deploy-platform" <<EOF
DEPLOY_OS=${OS_NAME}
DEPLOY_ARCH=${ARCH}
EOF
  fi
fi

if [[ "$NEED_BASE" == "1" ]]; then
  log "拉取基础镜像"
  pull_platform_image "node:22-bookworm" "$PLATFORM" "$ARCH"
  for img in nginx:1.25-alpine postgres:16-alpine mysql:8.0 redis:7-alpine; do
    pull_platform_image "$img" "$PLATFORM" "$ARCH"
  done
fi
if [[ "$NEED_API" == "1" && "$NEED_BASE" == "0" ]]; then
  pull_platform_image "node:22-bookworm" "$PLATFORM" "$ARCH"
fi
if [[ "$KIND" == "upgrade" ]]; then
  pull_platform_image "nginx:1.25-alpine" "$PLATFORM" "$ARCH"
fi

if [[ "$NEED_API" == "1" ]]; then
  build_eadaf_api "$PLATFORM" "eadaf-api:v1"
  save_image "eadaf-api:v1" "$DEST/docker-images" "$ARCH"
fi
if [[ "$NEED_BASE" == "1" ]]; then
  for img in nginx:1.25-alpine postgres:16-alpine mysql:8.0 redis:7-alpine; do
    save_image "$img" "$DEST/docker-images" "$ARCH"
  done
fi
if [[ "$KIND" == "upgrade" ]]; then
  save_image "nginx:1.25-alpine" "$DEST/docker-images" "$ARCH"
fi
if [[ "$NEED_WEB" == "1" ]]; then
  build_eadaf_web "$DEST"
fi
if [[ "$NEED_SQL" == "1" ]]; then
  copy_platform_sql "$DEST"
fi
if [[ "$NEED_BIZ" == "1" ]]; then
  log "导出 EADAF bizdata"
  export_bizdata_sql "EADAF" "$DEST/bizdata-patch.sql"
fi

if [[ "$KIND" == "install" && "$MODE" == "offline" ]]; then
  log "下载静态 Docker ($ARCH)"
  need_cmd curl
  fetch_docker_static "$ARCH" "$DEST"
  rm -f "$DEST/install-docker.sh"
  rm -rf "$DEST/k8s"
elif [[ "$KIND" == "install" && "$MODE" == "normal" ]]; then
  rm -rf "$DEST/k8s" "$DEST/docker-static" "$DEST/centos-docker-static"
elif [[ "$KIND" == "install" && "$MODE" == "k8s" ]]; then
  rm -f "$DEST/install-docker.sh"
  rm -rf "$DEST/docker-static" "$DEST/centos-docker-static"
elif [[ "$KIND" == "upgrade" ]]; then
  if [[ "$MODE" != "k8s" ]]; then
    rm -rf "$DEST/k8s"
  fi
  rm -f "$DEST/install-docker.sh"
  rm -rf "$DEST/docker-static" "$DEST/centos-docker-static"
  cp "$SKELETON/apply-upgrade.sh" "$DEST/apply.sh"
  chmod +x "$DEST/apply.sh"
elif [[ "$KIND" == "patch" ]]; then
  printf '%s' "$(printf '%s' "$PATCH_SLUG" | tr '+' ',')" >"$DEST/patch-parts"
  cp "$SKELETON/apply-patch.sh" "$DEST/apply.sh"
  chmod +x "$DEST/apply.sh"
  if [[ "$MODE" == "k8s" ]]; then
    mkdir -p "$DEST/k8s"
    cp "$SKELETON/k8s/"*.sh "$DEST/k8s/"
    chmod +x "$DEST/k8s/"*.sh
  fi
fi

SHA="$(git_sha)"
cat >"$DEST/MANIFEST.txt" <<EOF
product=eadaf
mode=${MODE}
kind=${KIND}
parts=${PATCH_SLUG:-all}
os_default=${OS_NAME}
arch=${ARCH}
version=${VERSION}
date=${DATE_STAMP}
web_host_port=${WEB_PORT}
api_host_port=${API_PORT}
git=${SHA}
EOF

lf_fix "$DEST"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/$ARCHIVE"
tar -C "$STAGE" -czf "$OUT_DIR/$ARCHIVE" "$INNER"

log "完成"
echo "压缩包: $OUT_DIR/$ARCHIVE"
ls -lh "$OUT_DIR/$ARCHIVE"
