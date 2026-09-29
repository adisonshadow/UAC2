#!/usr/bin/env bash
# FPCU 业务模型与 API 服务 seed（依赖 eadaf-api 已健康）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DATA_DIR="$ROOT/data"
MARKER="$DATA_DIR/.fpcu-seeded"
SEED_DIR="$ROOT/init/fpcu-seed"

mkdir -p "$DATA_DIR"

if [[ -f "$MARKER" ]]; then
  echo "[seed] FPCU 已 seed，跳过 ($MARKER)"
  exit 0
fi

# shellcheck disable=SC1091
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ROOT/.env" | sed 's/#.*//' | xargs)
  set +a
fi

EADAF_API_BASE_URL="${EADAF_API_BASE_URL:-http://eadaf-api:9526}"
FPCU2_APPLICATION_ID="${FPCU2_APPLICATION_ID:-10000000-0001-4000-8000-000000006666}"
FPCU2_APP_SECRET="${FPCU2_APP_SECRET:?缺少 FPCU2_APP_SECRET}"
FPCU2_DB_CONNECTION_ID="${FPCU2_DB_CONNECTION_ID:-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa}"

if [[ ! -d "$SEED_DIR" ]]; then
  echo "[seed] 缺少 $SEED_DIR"
  exit 1
fi

COMPOSE=(docker-compose)
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
fi

echo "[seed] 等待 eadaf-api healthy..."
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' EADAF-api 2>/dev/null || echo starting)"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "[seed] 等待 eadaf-api 超时"
    exit 1
  fi
  sleep 2
done

echo "[seed] 执行 FPCU bizdata / api-services ..."
"${COMPOSE[@]}" run --rm --no-deps \
  -e EADAF_API_BASE_URL="$EADAF_API_BASE_URL" \
  -e FPCU2_APPLICATION_ID="$FPCU2_APPLICATION_ID" \
  -e FPCU2_APP_SECRET="$FPCU2_APP_SECRET" \
  -e FPCU2_DB_CONNECTION_ID="$FPCU2_DB_CONNECTION_ID" \
  -e FPCU2_DATA_STORE=eadaf \
  -e EADAF_CONTRACT_CHECK=false \
  -v "$SEED_DIR:/seed:ro" \
  --entrypoint node \
  fpcu2-bff \
  /seed/seed-fpcu-bizdata.mjs

"${COMPOSE[@]}" run --rm --no-deps \
  -e EADAF_API_BASE_URL="$EADAF_API_BASE_URL" \
  -e FPCU2_APPLICATION_ID="$FPCU2_APPLICATION_ID" \
  -e FPCU2_APP_SECRET="$FPCU2_APP_SECRET" \
  -e FPCU2_DB_CONNECTION_ID="$FPCU2_DB_CONNECTION_ID" \
  -e FPCU2_DATA_STORE=eadaf \
  -e EADAF_CONTRACT_CHECK=false \
  -v "$SEED_DIR:/seed:ro" \
  --entrypoint node \
  fpcu2-bff \
  /seed/seed-fpcu-api-services.mjs

if [[ "${FPCU2_SEED_DEVICE_MOCK:-false}" == "true" ]]; then
  "${COMPOSE[@]}" run --rm --no-deps \
    -e EADAF_API_BASE_URL="$EADAF_API_BASE_URL" \
    -e FPCU2_APPLICATION_ID="$FPCU2_APPLICATION_ID" \
    -e FPCU2_APP_SECRET="$FPCU2_APP_SECRET" \
    -v "$SEED_DIR:/seed:ro" \
    --entrypoint node \
    fpcu2-bff \
    /seed/seed-fpcu-device-mock.mjs
fi

echo "[seed] 修正物化数据库连接..."
if [[ -f "$ROOT/init/fix-db-connection.js" ]]; then
  docker cp "$ROOT/init/fix-db-connection.js" EADAF-api:/tmp/fix-db-connection.js
  docker exec \
    -e POSTGRES_HOST=postgres \
    -e POSTGRES_PORT=5432 \
    -e POSTGRES_DATABASE="${POSTGRES_DATABASE:-eadaf_db}" \
    -e POSTGRES_USER="${POSTGRES_USER:-my_name}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-123456}" \
    -e FPCU2_DB_CONNECTION_ID="$FPCU2_DB_CONNECTION_ID" \
    -e ENCRYPTION_KEY="${ENCRYPTION_KEY:-}" \
    -w /app/backend \
    EADAF-api \
    node /tmp/fix-db-connection.js || echo "[seed] 警告: fix-db-connection 未成功（可稍后手动处理）"
fi

touch "$MARKER"
echo "[seed] FPCU seed 完成"
