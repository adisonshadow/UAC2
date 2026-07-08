#!/bin/bash
# AI Chat 行为修复相关 Skill 增量迁移
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export NODE_ENV="${NODE_ENV:-development}"

# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env.sh"
load_env_file "$PROJECT_ROOT"

PSQL_CMD="psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DATABASE"

echo "测试数据库连接..."
PGPASSWORD="$POSTGRES_PASSWORD" $PSQL_CMD -c "SELECT 1;" || {
  echo "数据库连接失败，请确认 Docker/PostgreSQL 已启动且 .env.$NODE_ENV 配置正确"
  exit 1
}

echo "执行 migrate-aibase-chat-framework-skill.sql ..."
PGPASSWORD="$POSTGRES_PASSWORD" $PSQL_CMD -f "$SCRIPT_DIR/migrate-aibase-chat-framework-skill.sql"

echo "执行 migrate-bizdata-model-phase-boundary.sql ..."
PGPASSWORD="$POSTGRES_PASSWORD" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-model-phase-boundary.sql"

echo "验证迁移结果..."
PGPASSWORD="$POSTGRES_PASSWORD" $PSQL_CMD -c "
SELECT slug, is_global, (content_markdown LIKE '%阶段边界（必遵）%') AS has_phase_boundary
FROM aibase.skills
WHERE slug IN ('aibase-chat-framework', 'bizdata-model-design');
"

echo "AI Chat Skill 迁移完成。"
