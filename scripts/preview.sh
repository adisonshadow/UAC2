#!/usr/bin/env bash
# scripts/preview.sh
#
# 串行启动 monorepo 生产构建预览：
#   1) 先启动 backend（pnpm --filter backend dev），等到监听端口
#   2) 再启动 frontend preview（pnpm --filter frontend preview，静态资源来自 frontend/dist）
#
# 使用前请先构建前端：pnpm --filter ./frontend build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

BACKEND_FILTER="${BACKEND_FILTER:-./backend}"
FRONTEND_FILTER="${FRONTEND_FILTER:-./frontend}"
BACKEND_WAIT_TIMEOUT="${BACKEND_WAIT_TIMEOUT:-60}"

FRONTEND_DIST="$REPO_ROOT/frontend/dist"
if [[ ! -d "$FRONTEND_DIST" ]] || [[ -z "$(ls -A "$FRONTEND_DIST" 2>/dev/null)" ]]; then
  echo "❌ 未找到 frontend/dist，请先执行："
  echo "   pnpm --filter ./frontend build"
  exit 1
fi

BACKEND_LOG="$(mktemp -t eadaf-backend-preview.XXXXXX.log)"
BACKEND_PID_FILE="$(mktemp -t eadaf-backend-preview.XXXXXX.pid)"
BACKEND_PORT=""
CLEANUP_DONE=0

cleanup() {
  [[ "$CLEANUP_DONE" -eq 1 ]] && return 0
  CLEANUP_DONE=1
  echo ""
  echo "↩️  收到退出信号，正在清理子进程 ..."
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -f "$BACKEND_PID_FILE" ]] && [[ -s "$BACKEND_PID_FILE" ]]; then
    local pid
    pid="$(cat "$BACKEND_PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "🛑 停止 backend (pid=$pid) ..."
      kill "$pid" 2>/dev/null || true
      for _ in 1 2 3 4 5; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
  fi
  rm -f "$BACKEND_LOG" "$BACKEND_PID_FILE" 2>/dev/null || true
  echo "👋 已退出。"
}
trap cleanup EXIT INT TERM

wait_for_port() {
  local port="$1"
  local timeout="${2:-$BACKEND_WAIT_TIMEOUT}"
  local elapsed=0
  while (( elapsed < timeout )); do
    if command -v nc >/dev/null 2>&1; then
      if nc -z -w 1 127.0.0.1 "$port" >/dev/null 2>&1; then
        return 0
      fi
    else
      if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  return 1
}

echo "================================================================"
echo "🟢 [1/2] 启动 backend  (pnpm --filter \"$BACKEND_FILTER\" dev)"
echo "        日志: $BACKEND_LOG"
echo "================================================================"

pnpm --filter "$BACKEND_FILTER" dev >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$BACKEND_PID_FILE"
echo "    backend pid=$BACKEND_PID"

echo "    等待 backend 启动（最多 ${BACKEND_WAIT_TIMEOUT}s）..."
STARTED=0
DEADLINE=$(( $(date +%s) + BACKEND_WAIT_TIMEOUT ))
while :; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "❌ backend 进程已退出，请查看日志尾部："
    echo "------------------------------------------------------------"
    tail -n 60 "$BACKEND_LOG" || true
    echo "------------------------------------------------------------"
    exit 1
  fi

  STARTED_LINE="$(grep -m1 -E 'API Server started on port [0-9]+' "$BACKEND_LOG" 2>/dev/null || true)"
  if [[ -n "$STARTED_LINE" ]]; then
    BACKEND_PORT="$(printf '%s' "$STARTED_LINE" | grep -oE 'on port [0-9]+' | grep -oE '[0-9]+' | head -n1)"
    STARTED=1
    break
  fi

  if [[ $(date +%s) -ge $DEADLINE ]]; then
    break
  fi
  sleep 0.5
done

if [[ "$STARTED" -eq 1 ]] && [[ -n "$BACKEND_PORT" ]]; then
  echo "    检测到启动日志：$STARTED_LINE"
  if wait_for_port "$BACKEND_PORT" "$BACKEND_WAIT_TIMEOUT"; then
    echo "    ✅ 端口 $BACKEND_PORT 已就绪"
  else
    echo "    ⚠️  backend 已打印启动日志，但端口 $BACKEND_PORT 在超时内仍未可连。"
  fi
elif [[ "$STARTED" -eq 0 ]]; then
  echo ""
  echo "❌ backend 在 ${BACKEND_WAIT_TIMEOUT}s 内未打印启动成功日志。"
  tail -n 60 "$BACKEND_LOG" || true
  exit 1
fi

echo ""
echo "================================================================"
echo "🟢 [2/2] 预览 frontend/dist (pnpm --filter \"$FRONTEND_FILTER\" preview)"
echo "        backend: http://localhost:${BACKEND_PORT:-<unknown>}"
echo "        frontend: http://localhost:9527 (vite preview)"
echo "================================================================"
echo ""

pnpm --filter "$FRONTEND_FILTER" preview &
FRONTEND_PID=$!
wait "$FRONTEND_PID" || true
