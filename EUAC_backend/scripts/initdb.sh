#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export NODE_ENV="${NODE_ENV:-development}"

# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/env.sh"
load_env_file "$PROJECT_ROOT"

DB_HOST="$POSTGRES_HOST"
DB_PORT="$POSTGRES_PORT"
DB_NAME="$POSTGRES_DATABASE"
DB_USER="$POSTGRES_USER"
DB_PASS="$POSTGRES_PASSWORD"
DB_SCHEMA="$POSTGRES_SCHEMA"

PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

echo "测试数据库连接..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -c "SELECT 1;" || { echo "数据库连接失败"; exit 1; }

echo "开始重置数据库表..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -c "DROP SCHEMA IF EXISTS $DB_SCHEMA CASCADE; CREATE SCHEMA $DB_SCHEMA;" || { echo "重置数据库失败"; exit 1; }
echo "数据库重置完成"

echo "安装pgcrypto扩展..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -c "CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;" || { echo "安装pgcrypto扩展失败"; exit 1; }
echo "pgcrypto扩展安装完成"

echo "开始创建数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/schemas.sql" || { echo "创建数据库结构失败"; exit 1; }
echo "数据库结构创建完成"

echo "开始创建 AIBase 数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-schema.sql" || { echo "创建 AIBase 数据库结构失败"; exit 1; }
echo "AIBase 数据库结构创建完成"

echo "开始创建 AIBase Skill/Tool 数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-skill-tool-schema.sql" || { echo "创建 AIBase Skill/Tool 数据库结构失败"; exit 1; }
echo "AIBase Skill/Tool 数据库结构创建完成"

echo "开始创建业务数据数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-schema.sql" || { echo "创建业务数据数据库结构失败"; exit 1; }
echo "业务数据数据库结构创建完成"

echo "开始导入业务数据示例种子..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-seed.sql" || { echo "导入业务数据示例种子失败"; exit 1; }
echo "业务数据示例种子导入完成"

if [[ "$*" == *"--with-aibase-seed"* ]]; then
    echo "开始导入 AIBase 种子数据..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-seed.sql" || { echo "导入 AIBase 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-skill-tool-seed.sql" || { echo "导入 AIBase Skill/Tool 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-ai-seed.sql" || { echo "导入业务数据 AI 种子数据失败"; exit 1; }
    echo "AIBase 种子数据导入完成"

    echo "开始执行 AIBase 增量迁移（skills.scope_id）..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-aibase-skills-scope.sql" || { echo "AIBase 增量迁移失败"; exit 1; }

    echo "开始初始化销售 Demo SQLite..."
    (cd "$PROJECT_ROOT" && node scripts/init-sales-demo-db.js) || { echo "初始化销售 Demo SQLite 失败"; exit 1; }
    echo "销售 Demo SQLite 初始化完成"
fi

echo "创建超级管理员..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/superadmin.sql" || { echo "创建超级管理员失败"; exit 1; }
echo "超级管理员创建完成"

if [[ "$*" == *"--with-mock"* ]]; then
    echo "开始导入测试数据..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/mock_data.sql" || { echo "导入测试数据失败"; exit 1; }
    echo "测试数据导入完成"
fi

echo "数据库操作完成"
