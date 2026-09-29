#!/usr/bin/env bash
# Shared helpers for offline deploy ops (source from other scripts).
# shellcheck disable=SC2034

OFFLINE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OFFLINE_ROOT="${OFFLINE_ROOT:-$OFFLINE_LIB_DIR}"

# module|compose_service|container_name|image|tar_filename
OFFLINE_MODULES=(
  "postgres|postgres|EADAF-postgres|postgres:16-alpine|postgres_16-alpine.tar"
  "redis|redis|EADAF-redis|redis:7-alpine|redis_7-alpine.tar"
  "mysql|mysql|EADAF-mysql|mysql:8.0|mysql_8.0.tar"
  "eadaf-api|eadaf-api|EADAF-api|eadaf-api:v1|eadaf-api_v1.tar"
  "eadaf-web|eadaf-web|EADAF-web|nginx:1.25-alpine|nginx_1.25-alpine.tar"
  "fpcu2-bff|fpcu2-bff|FPCU2-bff|fpcu2-bff:v1|fpcu2-bff_v1.tar"
  "fpcu2-web|fpcu2-web|FPCU2-web|fpcu2-web:v1|fpcu2-web_v1.tar"
)

OFFLINE_APP_MODULES=(eadaf-api eadaf-web fpcu2-bff fpcu2-web)
OFFLINE_DB_MODULES=(postgres redis mysql)
OFFLINE_ALL_MODULES=(postgres redis mysql eadaf-api eadaf-web fpcu2-bff fpcu2-web)

log_step() { printf '\n==== %s ====\n' "$*"; }
log_ok() { printf '[OK] %s\n' "$*"; }
log_warn() { printf '[WARN] %s\n' "$*"; }
log_err() { printf '[ERR] %s\n' "$*" >&2; }

die() {
  log_err "$*"
  exit 1
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "未找到 docker。请先进入 centos-docker-static 执行 ./install-docker-static.sh"
  docker info >/dev/null 2>&1 || die "Docker 未运行或当前用户无权限"
}

init_compose() {
  COMPOSE=(docker-compose)
  if docker compose version >/dev/null 2>&1; then
    COMPOSE=(docker compose)
  elif ! command -v docker-compose >/dev/null 2>&1; then
    die "未找到 docker-compose / docker compose"
  fi
}

compose() {
  (cd "$OFFLINE_ROOT" && "${COMPOSE[@]}" "$@")
}

load_dotenv() {
  local env_file="$OFFLINE_ROOT/.env"
  [[ -f "$env_file" ]] || return 0
  set -a
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$env_file" | sed 's/#.*//' | xargs) || true
  set +a
}

apply_public_host_urls() {
  local env_file="$OFFLINE_ROOT/.env"
  [[ -f "$env_file" ]] || return 0
  load_dotenv
  local host="${PUBLIC_HOST:-localhost}"
  local scheme="${PUBLIC_SCHEME:-http}"
  [[ -n "$host" ]] || return 0

  EADAF_PUBLIC_URL="${scheme}://${host}:9527"
  FPCU2_PUBLIC_URL="${scheme}://${host}:13308"
  SSO_CALLBACK_URL="${scheme}://${host}:13303/auth/callback"
  export EADAF_PUBLIC_URL FPCU2_PUBLIC_URL SSO_CALLBACK_URL PUBLIC_HOST="$host" PUBLIC_SCHEME="$scheme"

  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' \
      -e "s|^EADAF_PUBLIC_URL=.*|EADAF_PUBLIC_URL=${EADAF_PUBLIC_URL}|" \
      -e "s|^FPCU2_PUBLIC_URL=.*|FPCU2_PUBLIC_URL=${FPCU2_PUBLIC_URL}|" \
      -e "s|^SSO_CALLBACK_URL=.*|SSO_CALLBACK_URL=${SSO_CALLBACK_URL}|" \
      "$env_file"
  else
    sed -i \
      -e "s|^EADAF_PUBLIC_URL=.*|EADAF_PUBLIC_URL=${EADAF_PUBLIC_URL}|" \
      -e "s|^FPCU2_PUBLIC_URL=.*|FPCU2_PUBLIC_URL=${FPCU2_PUBLIC_URL}|" \
      -e "s|^SSO_CALLBACK_URL=.*|SSO_CALLBACK_URL=${SSO_CALLBACK_URL}|" \
      "$env_file"
  fi
  log_ok "已按 PUBLIC_HOST=${host} 写入对外 URL"
}

module_field() {
  # usage: module_field <module> <index 1=service 2=container 3=image 4=tar>
  local want="$1" idx="$2" row
  for row in "${OFFLINE_MODULES[@]}"; do
    IFS='|' read -r name service container image tar <<<"$row"
    if [[ "$name" == "$want" ]]; then
      case "$idx" in
        1) printf '%s\n' "$service" ;;
        2) printf '%s\n' "$container" ;;
        3) printf '%s\n' "$image" ;;
        4) printf '%s\n' "$tar" ;;
      esac
      return 0
    fi
  done
  return 1
}

module_service() { module_field "$1" 1; }
module_container() { module_field "$1" 2; }
module_image() { module_field "$1" 3; }
module_tar() { module_field "$1" 4; }

resolve_modules() {
  # args: all | module...  -> prints module names one per line
  local arg
  if [[ $# -eq 0 || "$1" == "all" ]]; then
    printf '%s\n' "${OFFLINE_ALL_MODULES[@]}"
    return 0
  fi
  for arg in "$@"; do
    if ! module_service "$arg" >/dev/null; then
      die "未知模块: $arg（可选: ${OFFLINE_ALL_MODULES[*]}）"
    fi
    printf '%s\n' "$arg"
  done
}

dump_container_logs() {
  local cname="$1" lines="${2:-100}"
  log_err "---- docker logs --tail ${lines} ${cname} ----"
  docker logs --tail "$lines" "$cname" 2>&1 || true
  log_err "---- end logs ${cname} ----"
}

container_running() {
  local cname="$1"
  local st
  st="$(docker inspect -f '{{.State.Running}}' "$cname" 2>/dev/null || echo false)"
  [[ "$st" == "true" ]]
}

container_health() {
  local cname="$1"
  local h
  h="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cname" 2>/dev/null || echo missing)"
  printf '%s\n' "$h"
}

wait_container_running() {
  local cname="$1" timeout="${2:-60}"
  local i
  for i in $(seq 1 "$timeout"); do
    if container_running "$cname"; then
      return 0
    fi
    sleep 1
  done
  dump_container_logs "$cname"
  die "容器未运行: $cname（等待 ${timeout}s）"
}

wait_container_healthy() {
  local cname="$1" timeout="${2:-180}"
  local i h
  wait_container_running "$cname" 30
  for i in $(seq 1 "$timeout"); do
    h="$(container_health "$cname")"
    case "$h" in
      healthy|none)
        # none = no healthcheck configured but running
        if [[ "$h" == "healthy" ]] || [[ "$h" == "none" ]]; then
          if [[ "$h" == "healthy" ]]; then
            log_ok "$cname healthy"
            return 0
          fi
          # no healthcheck: accept running after short settle
          if [[ "$i" -ge 3 ]]; then
            log_ok "$cname running（无 healthcheck）"
            return 0
          fi
        fi
        ;;
      unhealthy)
        dump_container_logs "$cname"
        die "容器 unhealthy: $cname"
        ;;
      starting|missing)
        ;;
    esac
    sleep 1
  done
  dump_container_logs "$cname"
  die "等待 healthy 超时: $cname（${timeout}s） health=$(container_health "$cname")"
}

http_check() {
  # http_check <url> [expect_substr]
  local url="$1" expect="${2:-}"
  local code body tmp
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w '%{http_code}' --connect-timeout 3 --max-time 10 "$url" 2>/dev/null || echo 000)"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  if [[ "$code" == "000" ]]; then
    log_err "HTTP 无法连接: $url"
    return 1
  fi
  if [[ "$code" =~ ^[45] ]]; then
    log_err "HTTP $code: $url"
    return 1
  fi
  if [[ -n "$expect" ]] && ! grep -q "$expect" <<<"$body"; then
    log_err "HTTP 响应缺少期望内容「${expect}」: $url (code=$code)"
    return 1
  fi
  log_ok "HTTP $code $url"
  return 0
}

load_module_image() {
  local mod="$1"
  local tar_name image_name tar_path
  tar_name="$(module_tar "$mod")"
  image_name="$(module_image "$mod")"
  tar_path="$OFFLINE_ROOT/docker-images/$tar_name"
  [[ -f "$tar_path" ]] || die "缺少镜像包: $tar_path"
  log_step "加载镜像 $mod -> $image_name ($tar_name)"
  docker load -i "$tar_path"
  log_ok "已加载 $image_name"
}

load_module_images() {
  local m
  while IFS= read -r m; do
    [[ -n "$m" ]] || continue
    load_module_image "$m"
  done < <(resolve_modules "$@")
}

print_access_urls() {
  local host="${PUBLIC_HOST:-<服务器IP>}"
  echo ""
  echo "访问地址:"
  echo "  EADAF 管理端: http://${host}:9527"
  echo "  EADAF API:    http://${host}:9526/api/v1/health"
  echo "  FPCU2 管理端: http://${host}:13308"
  echo "  FPCU2 BFF:    http://${host}:13303/health"
  echo "  日志目录:     ./logs/api  ./logs/nginx  ./logs/fpcu2-nginx"
}
