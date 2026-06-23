-- 业务数据模型 Schema
-- PostgreSQL 12+

DROP SCHEMA IF EXISTS bizdata CASCADE;
CREATE SCHEMA bizdata;

-- 单应用配置
CREATE TABLE bizdata.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO bizdata.settings (key, value) VALUES
    ('default_materialization_schema', '"bizdata_mat"'::jsonb),
    ('catalog_version', '1'::jsonb);

-- 实体主表
CREATE TABLE bizdata.entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(255) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    entity_kind VARCHAR(32) NOT NULL DEFAULT 'er_table'
        CHECK (entity_kind IN ('er_table', 'json_schema')),
    table_name VARCHAR(128),
    status VARCHAR(20) NOT NULL DEFAULT 'enabled'
        CHECK (status IN ('enabled', 'disabled', 'archived')),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    entity_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    json_schema JSONB,
    layout JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bizdata_entities_code ON bizdata.entities (code);
CREATE INDEX idx_bizdata_entities_kind ON bizdata.entities (entity_kind);

-- ER 实体字段
CREATE TABLE bizdata.entity_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES bizdata.entities(id) ON DELETE CASCADE,
    field_key VARCHAR(128) NOT NULL,
    column_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    typeorm_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entity_id, field_key)
);

CREATE INDEX idx_bizdata_entity_fields_entity ON bizdata.entity_fields (entity_id);

-- ADB 枚举
CREATE TABLE bizdata.enums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(255) NOT NULL UNIQUE,
    enum_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    values JSONB NOT NULL DEFAULT '{}'::jsonb,
    items JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 实体关系
CREATE TABLE bizdata.relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    inverse_name VARCHAR(128),
    from_entity_id UUID NOT NULL REFERENCES bizdata.entities(id) ON DELETE CASCADE,
    to_entity_id UUID NOT NULL REFERENCES bizdata.entities(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    join_table JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bizdata_relations_from ON bizdata.relations (from_entity_id);
CREATE INDEX idx_bizdata_relations_to ON bizdata.relations (to_entity_id);

-- 物化批次
CREATE TABLE bizdata.materialization_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_schema VARCHAR(128) NOT NULL DEFAULT 'bizdata_mat',
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'preview', 'running', 'success', 'failed')),
    sql_preview TEXT,
    generated_code JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 物化明细（保留历史，按 entity 查最新成功记录对比版本）
CREATE TABLE bizdata.materialization_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES bizdata.materialization_runs(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES bizdata.entities(id) ON DELETE CASCADE,
    entity_version INTEGER NOT NULL,
    table_name VARCHAR(128),
    ddl_applied BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bizdata_mat_entities_entity ON bizdata.materialization_entities (entity_id);
CREATE INDEX idx_bizdata_mat_entities_run ON bizdata.materialization_entities (run_id);
