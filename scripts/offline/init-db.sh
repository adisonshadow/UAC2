#!/usr/bin/env bash
# Offline first-time DB init (runs SQL inside the postgres container).
# Skips if schema already has tables (avoids DROP SCHEMA on existing data).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a
# Prefer .env next to this script
if [[ -f "$ROOT/.env" ]]; then
  # strip comments / blank lines for safe sourcing of KEY=VALUE
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ROOT/.env" | sed 's/#.*//' | xargs)
fi
set +a

DB_NAME="${POSTGRES_DATABASE:-eadaf_db}"
DB_USER="${POSTGRES_USER:-my_name}"
DB_PASS="${POSTGRES_PASSWORD:-123456}"
DB_SCHEMA="${POSTGRES_SCHEMA:-uac}"
CONTAINER="${POSTGRES_CONTAINER:-EADAF-postgres}"
SQL_DIR="$ROOT/init-sql"

if [[ ! -d "$SQL_DIR" ]]; then
  echo "缺少 init-sql 目录: $SQL_DIR"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Postgres 容器未运行: $CONTAINER"
  exit 1
fi

psql_exec() {
  docker exec -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

echo "测试数据库连接..."
psql_exec -c "SELECT 1;" >/dev/null

TABLE_COUNT="$(psql_exec -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${DB_SCHEMA}';" | tr -d '[:space:]')"
SKIP_FULL_INIT=0
if [[ "${TABLE_COUNT:-0}" != "0" ]]; then
  echo "schema ${DB_SCHEMA} 已有 ${TABLE_COUNT} 张表，跳过全量初始化（避免 DROP SCHEMA）。"
  SKIP_FULL_INIT=1
fi

register_fpcu_app() {
  local tpl="$ROOT/init/fpcu-application.sql.template"
  local tmp
  if [[ ! -f "$tpl" ]]; then
    echo "缺少 $tpl，跳过 FPCU 应用注册"
    return 0
  fi
  local app_id="${FPCU2_APPLICATION_ID:-10000000-0001-4000-8000-000000006666}"
  local app_secret="${FPCU2_APP_SECRET:-}"
  local sso_cb="${SSO_CALLBACK_URL:-http://localhost:13303/auth/callback}"
  local fpcu_pub="${FPCU2_PUBLIC_URL:-http://localhost:13308}"
  if [[ -z "$app_secret" ]]; then
    echo "缺少 FPCU2_APP_SECRET，跳过 FPCU 应用注册"
    return 0
  fi
  echo "注册 FPCU 应用与存储桶..."
  tmp="$(mktemp)"
  sed \
    -e "s|\${FPCU2_APPLICATION_ID}|${app_id}|g" \
    -e "s|\${FPCU2_APP_SECRET}|${app_secret}|g" \
    -e "s|\${SSO_CALLBACK_URL}|${sso_cb}|g" \
    -e "s|\${FPCU2_PUBLIC_URL}|${fpcu_pub}|g" \
    "$tpl" >"$tmp"
  docker exec -i -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <"$tmp"
  rm -f "$tmp"
  echo "FPCU 应用注册完成"
}

if [[ "$SKIP_FULL_INIT" -eq 1 ]]; then
  register_fpcu_app
  echo "数据库初始化完成（仅确保 FPCU 应用）"
  exit 0
fi

run_sql_file() {
  local file="$1"
  local base
  base="$(basename "$file")"
  if [[ ! -f "$file" ]]; then
    echo "缺少 SQL: $base"
    exit 1
  fi
  echo "执行 $base ..."
  docker exec -i -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <"$file"
}

echo "开始重置 schema ${DB_SCHEMA}..."
psql_exec -c "DROP SCHEMA IF EXISTS ${DB_SCHEMA} CASCADE; CREATE SCHEMA ${DB_SCHEMA};"
echo "安装 pgcrypto..."
psql_exec -c "CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;"

# 顺序与 backend/scripts/initdb.sh 默认路径一致（不含 mock / aibase-seed）
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
  run_sql_file "$SQL_DIR/$name"
done

echo "数据库结构初始化完成"
register_fpcu_app
echo "数据库初始化完成"
