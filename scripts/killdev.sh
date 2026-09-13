#!/usr/bin/env bash
# 查找并结束本仓库的前后端开发进程（pnpm dev / nodemon / vite / preview）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKEND_PORT="${BACKEND_PORT:-${API_PORT:-9526}}"
FRONTEND_PORT="${FRONTEND_PORT:-9527}"

SELF_PID=$$
PARENT_PID=$PPID

is_dev_cmd() {
  local cmd="$1"
  [[ "$cmd" == *"$REPO_ROOT/scripts/dev.sh"* ]] && return 0
  [[ "$cmd" == *"$REPO_ROOT/scripts/preview.sh"* ]] && return 0
  [[ "$cmd" == *"$REPO_ROOT/backend/src/app.js"* ]] && return 0
  [[ "$cmd" == *"nodemon"* && "$cmd" == *"src/app.js"* ]] && return 0
  [[ "$cmd" == *"vite"* ]] && return 0
  [[ "$cmd" == *"pnpm"* && "$cmd" == *"--filter"* && "$cmd" == *"backend"* ]] && return 0
  [[ "$cmd" == *"pnpm"* && "$cmd" == *"--filter"* && "$cmd" == *"frontend"* ]] && return 0
  return 1
}

is_repo_related() {
  local pid="$1"
  local cwd cmd
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
  cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cwd" == "$REPO_ROOT" || "$cwd" == "$REPO_ROOT/"* ]] && return 0
  [[ "$cmd" == *"$REPO_ROOT"* ]] && return 0
  return 1
}

declare -A PIDS=()

add_pid() {
  local p="$1"
  [[ -n "$p" && "$p" =~ ^[0-9]+$ ]] || return 0
  [[ "$p" -eq "$SELF_PID" || "$p" -eq "$PARENT_PID" ]] && return 0
  kill -0 "$p" 2>/dev/null || return 0
  PIDS["$p"]=1
}

# 按命令行 / 工作目录收集本仓库的前后端进程
for proc in /proc/[0-9]*; do
  pid="${proc#/proc/}"
  cmd="$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null || true)"
  [[ -n "$cmd" ]] || continue
  is_dev_cmd "$cmd" || continue
  is_repo_related "$pid" || continue
  add_pid "$pid"
done

# 再按监听端口收一轮（避免 pnpm/nodemon 子进程漏网）
add_listen_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    while read -r pid; do
      add_pid "$pid"
    done < <(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v fuser >/dev/null 2>&1; then
    while read -r pid; do
      add_pid "$pid"
    done < <(fuser -n tcp "$port" 2>/dev/null | tr -s ' ' '\n' || true)
  elif command -v ss >/dev/null 2>&1; then
    while read -r pid; do
      add_pid "$pid"
    done < <(ss -lptn "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 || true)
  fi
}

add_listen_port "$BACKEND_PORT"
add_listen_port "$FRONTEND_PORT"

if [[ ${#PIDS[@]} -eq 0 ]]; then
  echo "没有发现前后端开发进程。"
  exit 0
fi

echo "将结束以下进程："
for pid in "${!PIDS[@]}"; do
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || echo '<已退出>')"
  echo "  pid=$pid  $cmd"
done

for pid in "${!PIDS[@]}"; do
  kill "$pid" 2>/dev/null || true
done

sleep 0.4

for pid in "${!PIDS[@]}"; do
  if kill -0 "$pid" 2>/dev/null; then
    echo "  强制结束 pid=$pid"
    kill -9 "$pid" 2>/dev/null || true
  fi
done

echo "已结束前后端开发进程。"
