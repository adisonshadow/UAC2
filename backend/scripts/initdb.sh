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

echo "开始创建 API 服务数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-api-services.sql" || { echo "创建 API 服务数据库结构失败"; exit 1; }
echo "API 服务数据库结构创建完成"

echo "开始创建采集管道数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-collection-pipelines.sql" || { echo "创建采集管道数据库结构失败"; exit 1; }
echo "采集管道数据库结构创建完成"

echo "开始创建外部 API 提交（Outbound Webhook）数据库结构..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-outbound-webhooks.sql" || { echo "创建 Outbound Webhook 数据库结构失败"; exit 1; }
echo "Outbound Webhook 数据库结构创建完成"

# ---------------------------------------------------------------------------
# 结构对齐增量迁移（幂等，IF NOT EXISTS）
# 这些列/表已前向合并进上面的 base schema，此处同时运行以兼容已存在旧表的库，
# 确保「以现网为准」的结构在 init 后完整。顺序无关、可重复执行。
# ---------------------------------------------------------------------------
echo "开始执行结构对齐增量迁移..."

PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-builtin-api-system.sql" || { echo "内置 API 系统迁移失败"; exit 1; }
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-permission-access-restriction.sql" || { echo "权限 access_restriction 迁移失败"; exit 1; }
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-api-services-optional-entity.sql" || { echo "API 服务可选实体迁移失败"; exit 1; }
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-api-services-form-v2.sql" || { echo "API 服务表单 v2 迁移失败"; exit 1; }
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-apiservice-transport-protocols.sql" || { echo "API 服务传输协议迁移失败"; exit 1; }
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-skill-completion-strategy.sql" || { echo "Skill 完成策略迁移失败"; exit 1; }
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/20260710_add_model_rate_limit.sql" || { echo "模型 rate_limit 迁移失败"; exit 1; }

echo "结构对齐增量迁移完成"

echo "开始导入业务数据示例种子..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-seed.sql" || { echo "导入业务数据示例种子失败"; exit 1; }
echo "业务数据示例种子导入完成"

echo "开始导入 UAC 权限目录..."
PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/uac-permissions-catalog-seed.sql" || { echo "导入 UAC 权限目录失败"; exit 1; }
echo "UAC 权限目录导入完成"

if [[ "$*" == *"--with-aibase-seed"* ]]; then
    echo "开始导入 AIBase 种子数据..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-seed.sql" || { echo "导入 AIBase 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-skill-tool-seed.sql" || { echo "导入 AIBase Skill/Tool 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-ai-seed.sql" || { echo "导入业务数据 AI 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-entity-code-ai-tool.sql" || { echo "实体 Code 编辑 AI Tool/Skill 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-rename-entity-code-tool.sql" || { echo "实体 Code 重命名 Tool/Skill 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-list-entity-summaries-tool.sql" || { echo "精简列出实体 Tool/Skill 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-prefer-entity-summaries.sql" || { echo "停用 list_entities / 优先 summaries 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-entity-deletion-cascade-tool.sql" || { echo "实体级联删除 Tool 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-api-service-ai-seed.sql" || { echo "导入 API 服务 AI 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-bizdata-api-service-entity-coverage-skill.sql" || { echo "API 服务实体覆盖率 Skill 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/bizdata-collection-pipeline-ai-seed.sql" || { echo "导入采集管道 AI 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-outbound-webhook-ai-seed.sql" || { echo "导入提交外部API AI 种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-admin-ai-seed.sql" || { echo "导入 AI 管理种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/aibase-provider-model-ai-seed.sql" || { echo "导入 AI 服务商/模型种子数据失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/uac-ai-seed.sql" || { echo "导入 UAC AI 种子数据失败"; exit 1; }
    echo "AIBase 种子数据导入完成"

    echo "开始执行 AIBase 增量迁移（skills.scope_id）..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-aibase-skills-scope.sql" || { echo "AIBase 增量迁移失败"; exit 1; }

    echo "开始执行 AI Chat 框架 Skill 迁移..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-aibase-chat-framework-skill.sql" || { echo "AI Chat 框架 Skill 迁移失败"; exit 1; }

    echo "开始执行 EADAF Skill 可见性与顶层 Skill 迁移..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-eadaf-skill-visibility-and-top-level.sql" || { echo "EADAF Skill 迁移失败"; exit 1; }

    echo "开始执行 ToolResponse 框架 Skill 迁移..."
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-aibase-tool-response-framework-skill.sql" || { echo "ToolResponse 框架 Skill 迁移失败"; exit 1; }
    PGPASSWORD="$DB_PASS" $PSQL_CMD -f "$SCRIPT_DIR/migrate-apiservice-publish-verification-skill.sql" || { echo "API 发布防幻觉 Skill 迁移失败"; exit 1; }

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
