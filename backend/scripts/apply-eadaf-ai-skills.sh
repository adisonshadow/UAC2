#!/bin/bash
# 在目标库执行 migrate-eadaf-ai-skills.sql（幂等 upsert，可重复跑）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export NODE_ENV="${NODE_ENV:-development}"

# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env.sh"
load_env_file "$PROJECT_ROOT"

SQL_FILE="$SCRIPT_DIR/migrate-eadaf-ai-skills.sql"
if [ ! -f "$SQL_FILE" ]; then
  echo "错误：找不到 $SQL_FILE，请先在有完整 Skill 的库上运行 pnpm export-eadaf-ai-skills"
  exit 1
fi

echo "upsert EADAF 全局/专用 Skill/Tool → ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DATABASE" \
  -v ON_ERROR_STOP=1 \
  -f "$SQL_FILE"
echo "EADAF Skill/Tool upsert 完成"
