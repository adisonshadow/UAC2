#!/usr/bin/env bash
# Offline ops CLI: status / up / down / restart / logs / load-images / reinstall / seed
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$ROOT/lib.sh"
OFFLINE_ROOT="$ROOT"

usage() {
  cat <<'EOF'
用法: ./ctl.sh <command> [args]

命令:
  status                         全组件状态 + HTTP 巡检
  ps                             docker compose ps
  up                             等同 ./up.sh（完整首次启动流水线）
  down                           停止全部服务（不删 volume）
  restart <module|all>           重启模块
  logs <module> [-f] [--tail N]  查看日志（默认 --tail 100）
  load-images [module|all]       从 docker-images/*.tar 加载镜像
  reinstall <module|all>         覆盖重装：load 镜像 + force-recreate + 等待 + status
  seed [--force]                 运行 FPCU seed（--force 删除 data/.fpcu-seeded）

模块名:
  postgres redis mysql eadaf-api eadaf-web fpcu2-bff fpcu2-web

示例:
  ./ctl.sh status
  ./ctl.sh reinstall eadaf-web
  ./ctl.sh logs eadaf-api -f
  ./ctl.sh seed --force
EOF
}

cmd="${1:-}"
shift || true

require_docker
init_compose

case "$cmd" in
  status|"")
    bash "$ROOT/status.sh"
    ;;
  ps)
    compose ps
    ;;
  up)
    bash "$ROOT/up.sh"
    ;;
  down)
    log_step "停止全部服务（保留数据卷）"
    compose down
    log_ok "已 down"
    ;;
  restart)
    [[ $# -ge 1 ]] || die "用法: ./ctl.sh restart <module|all>"
    while IFS= read -r m; do
      [[ -n "$m" ]] || continue
      svc="$(module_service "$m")"
      log_step "重启 $m ($svc)"
      compose restart "$svc"
      wait_container_healthy "$(module_container "$m")" 120
    done < <(resolve_modules "$@")
    bash "$ROOT/status.sh"
    ;;
  logs)
    [[ $# -ge 1 ]] || die "用法: ./ctl.sh logs <module> [-f] [--tail N]"
    mod="$1"
    shift
    cname="$(module_container "$mod")" || die "未知模块: $mod"
    follow=0
    tail_n=100
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -f|--follow) follow=1; shift ;;
        --tail)
          tail_n="${2:-100}"
          shift 2
          ;;
        --tail=*)
          tail_n="${1#--tail=}"
          shift
          ;;
        *)
          die "未知 logs 参数: $1"
          ;;
      esac
    done
    if [[ "$follow" -eq 1 ]]; then
      docker logs -f --tail "$tail_n" "$cname"
    else
      docker logs --tail "$tail_n" "$cname"
    fi
    ;;
  load-images)
    if [[ $# -eq 0 ]]; then
      load_module_images all
    else
      load_module_images "$@"
    fi
    ;;
  reinstall)
    [[ $# -ge 1 ]] || die "用法: ./ctl.sh reinstall <module|all>"
    apply_public_host_urls
    mkdir -p "$ROOT/data" "$ROOT/logs/api" "$ROOT/logs/nginx" "$ROOT/logs/fpcu2-nginx" "$ROOT/logs/fpcu2-bff"
    if docker inspect EADAF-nginx >/dev/null 2>&1; then
      log_warn "检测到旧容器 EADAF-nginx，将移除"
      docker rm -f EADAF-nginx >/dev/null || true
    fi
    while IFS= read -r m; do
      [[ -n "$m" ]] || continue
      load_module_image "$m"
      svc="$(module_service "$m")"
      cname="$(module_container "$m")"
      log_step "覆盖重建 $m ($svc)"
      # --no-deps：不连带重建依赖库；force-recreate 用新镜像
      compose up -d --force-recreate --no-deps "$svc"
      wait_container_healthy "$cname" 180
    done < <(resolve_modules "$@")
    bash "$ROOT/status.sh"
    ;;
  seed)
    force=0
    if [[ "${1:-}" == "--force" ]]; then
      force=1
    fi
    if [[ "$force" -eq 1 ]]; then
      rm -f "$ROOT/data/.fpcu-seeded"
      log_ok "已清除 data/.fpcu-seeded，将重新 seed"
    fi
    bash "$ROOT/seed-fpcu.sh"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    die "未知命令: $cmd"
    ;;
esac
