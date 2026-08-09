#!/usr/bin/env bash
# scripts/dev.sh
#
# 串行启动 monorepo 开发环境：
#   1) 先启动 backend（pnpm --filter backend dev），等到它真正监听端口后再继续
#   2) 再启动 frontend（pnpm --filter frontend dev）
#
# 设计要点：
#   - backend 的「就绪信号」使用它自己打印的启动日志行：
#       🚀 ✅✅✅✅ API Server started on port <N>
#     我们从该行解析出真实端口（避免依赖 .env 里可能不一致的配置），并用它做健康检查兜底。
#   - frontend（vite）在前台运行，Ctrl+C 时会触发 trap，连带 backend 一起清理。
#   - 失败（backend 启动失败、超时、用户中断）都返回非 0，并打印 backend 日志尾部便于排查。

set -euo pipefail

# ----------------------------- 基础配置 -----------------------------

# 解析仓库根目录（脚本位于 <root>/scripts/dev.sh）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# 用目录路径过滤（./backend、./frontend），不依赖各包的 name 字段
# （backend 的 package name 是 "uac-api"，frontend 没有 name 字段）。
BACKEND_FILTER="${BACKEND_FILTER:-./backend}"
FRONTEND_FILTER="${FRONTEND_FILTER:-./frontend}"

# backend 启动后最多等待这么久（秒）
BACKEND_WAIT_TIMEOUT="${BACKEND_WAIT_TIMEOUT:-60}"

# 临时文件：backend 日志 + PID
BACKEND_LOG="$(mktemp -t eadaf-backend-dev.XXXXXX.log)"
BACKEND_PID_FILE="$(mktemp -t eadaf-backend-dev.XXXXXX.pid)"
BACKEND_PORT=""
# 防止 EXIT + INT/TERM 重复触发清理（信号触发后脚本退出时还会再走一次 EXIT）。
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
      # 给它一点时间优雅退出，必要时强杀整个进程组
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

# ----------------------------- 工具函数 -----------------------------

# 等待某个 TCP 端口可连。返回 0 表示已就绪，1 表示超时。
wait_for_port() {
  local port="$1"
  local timeout="${2:-$BACKEND_WAIT_TIMEOUT}"
  local elapsed=0
  while (( elapsed < timeout )); do
    # macOS 自带的 nc 支持 -z；没有 nc 时退化为 /dev/tcp（bash 专用）
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

# ----------------------------- 启动 backend -----------------------------

echo "================================================================"
echo "🟢 [1/2] 启动 backend  (pnpm --filter \"$BACKEND_FILTER\" dev)"
echo "        日志: $BACKEND_LOG"
echo "================================================================"

# 后台启动 backend，把输出重定向到日志文件。
# 注意：用 setsid / nohup 难以跨平台，这里用普通后台 + 记录 PID 即可（trap 会兜底清理）。
pnpm --filter "$BACKEND_FILTER" dev >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$BACKEND_PID_FILE"
echo "    backend pid=$BACKEND_PID"

# 1) 优先等待启动日志行（最可靠的「真正就绪」信号），并从中解析端口。
echo "    等待 backend 启动（最多 ${BACKEND_WAIT_TIMEOUT}s）..."
STARTED=0
DEADLINE=$(( $(date +%s) + BACKEND_WAIT_TIMEOUT ))
while :; do
  # backend 意外退出？
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "❌ backend 进程已退出，请查看日志尾部："
    echo "------------------------------------------------------------"
    tail -n 60 "$BACKEND_LOG" || true
    echo "------------------------------------------------------------"
    exit 1
  fi

  # 匹配形如:  🚀 ✅✅✅✅ API Server started on port 9526
  # 注意：日志行后面还带 winston 的 timestamp（如 ...14:18:33），
  # 所以必须精确抓 "on port " 后面紧跟的那一段数字，不能简单取行内最后一个数字。
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

# 2) 如果拿到端口，再用 TCP 健康检查兜底，确保端口真的在监听。
if [[ "$STARTED" -eq 1 ]] && [[ -n "$BACKEND_PORT" ]]; then
  echo "    检测到启动日志：$STARTED_LINE"
  if wait_for_port "$BACKEND_PORT" "$BACKEND_WAIT_TIMEOUT"; then
    echo "    ✅ 端口 $BACKEND_PORT 已就绪"
  else
    echo "    ⚠️  backend 已打印启动日志，但端口 $BACKEND_PORT 在超时内仍未可连（可能仍在初始化）。"
    echo "        继续启动 frontend，若接口报错请稍后重试或检查 backend 日志。"
  fi
elif [[ "$STARTED" -eq 0 ]]; then
  echo ""
  echo "❌ backend 在 ${BACKEND_WAIT_TIMEOUT}s 内未打印启动成功日志。"
  echo "   日志尾部："
  echo "------------------------------------------------------------"
  tail -n 60 "$BACKEND_LOG" || true
  echo "------------------------------------------------------------"
  exit 1
fi

echo ""
echo "================================================================"
echo "🟢 [2/2] 启动 frontend (pnpm --filter \"$FRONTEND_FILTER\" dev)"
echo "        backend: http://localhost:${BACKEND_PORT:-<unknown>}"
echo "================================================================"
echo ""

# ----------------------------- 启动 frontend -----------------------------

# frontend 放在前台运行，这样用户可以直接看到 vite 输出，Ctrl+C 能正常退出。
# 用 & + wait 是为了让 trap 在 Ctrl+C 时能被触发（直接前台阻塞 nodemon/vite 时，
# 信号处理依然 OK，但显式 wait 可以让我们在结束时干净地结束 frontend 再清理 backend）。
pnpm --filter "$FRONTEND_FILTER" dev &
FRONTEND_PID=$!
wait "$FRONTEND_PID" || true
