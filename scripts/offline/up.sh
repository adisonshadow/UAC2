#!/usr/bin/env bash
# Load images, start production stack (EADAF + FPCU2), init DB + FPCU seed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker。请先进入 centos-docker-static 执行 ./install-docker-static.sh"
  exit 1
fi

COMPOSE=(docker-compose)
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif ! command -v docker-compose >/dev/null 2>&1; then
  echo "未找到 docker-compose / docker compose"
  exit 1
fi

# 根据 PUBLIC_HOST 写回对外 URL（若 .env 存在）
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ROOT/.env" | sed 's/#.*//' | xargs)
  set +a
  PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
  PUBLIC_SCHEME="${PUBLIC_SCHEME:-http}"
  if [[ -n "$PUBLIC_HOST" ]]; then
    EADAF_PUBLIC_URL="${PUBLIC_SCHEME}://${PUBLIC_HOST}:9527"
    FPCU2_PUBLIC_URL="${PUBLIC_SCHEME}://${PUBLIC_HOST}:13308"
    SSO_CALLBACK_URL="${PUBLIC_SCHEME}://${PUBLIC_HOST}:13303/auth/callback"
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' \
        -e "s|^EADAF_PUBLIC_URL=.*|EADAF_PUBLIC_URL=${EADAF_PUBLIC_URL}|" \
        -e "s|^FPCU2_PUBLIC_URL=.*|FPCU2_PUBLIC_URL=${FPCU2_PUBLIC_URL}|" \
        -e "s|^SSO_CALLBACK_URL=.*|SSO_CALLBACK_URL=${SSO_CALLBACK_URL}|" \
        "$ROOT/.env"
    else
      sed -i \
        -e "s|^EADAF_PUBLIC_URL=.*|EADAF_PUBLIC_URL=${EADAF_PUBLIC_URL}|" \
        -e "s|^FPCU2_PUBLIC_URL=.*|FPCU2_PUBLIC_URL=${FPCU2_PUBLIC_URL}|" \
        -e "s|^SSO_CALLBACK_URL=.*|SSO_CALLBACK_URL=${SSO_CALLBACK_URL}|" \
        "$ROOT/.env"
    fi
    echo "已按 PUBLIC_HOST=${PUBLIC_HOST} 写入对外 URL"
  fi
fi

echo "===== 加载镜像 ====="
shopt -s nullglob
for f in ./docker-images/*.tar; do
  echo "docker load -i $f"
  docker load -i "$f"
done
shopt -u nullglob

mkdir -p ./data ./logs/api ./logs/nginx ./logs/fpcu2-nginx

echo "===== 启动基础与 EADAF / FPCU2 ====="
"${COMPOSE[@]}" up -d postgres redis mysql
echo "===== 等待 Postgres healthy ====="
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' EADAF-postgres 2>/dev/null || echo starting)"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 2
done

echo "===== 初始化 EADAF 数据库 + 注册 FPCU 应用 ====="
bash ./init-db.sh

echo "===== 启动 API / Web / BFF ====="
"${COMPOSE[@]}" up -d eadaf-api nginx fpcu2-bff fpcu2-web

echo "===== FPCU 业务 seed ====="
bash ./seed-fpcu.sh

echo ""
echo "启动完成。"
echo "  EADAF 管理端: http://${PUBLIC_HOST:-<服务器IP>}:9527"
echo "  EADAF API:    http://${PUBLIC_HOST:-<服务器IP>}:9526/api/v1/health"
echo "  FPCU2 管理端: http://${PUBLIC_HOST:-<服务器IP>}:13308"
echo "  FPCU2 BFF:    http://${PUBLIC_HOST:-<服务器IP>}:13303/health"
echo "  日志:         ./logs/api  ./logs/nginx  ./logs/fpcu2-nginx"
echo "查看容器: ${COMPOSE[*]} ps"
