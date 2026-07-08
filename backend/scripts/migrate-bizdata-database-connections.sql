-- 业务数据：多数据库连接 + 物化 run 关联 connection
-- PostgreSQL 12+

CREATE TABLE IF NOT EXISTS bizdata.database_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    db_type VARCHAR(32) NOT NULL CHECK (db_type IN ('postgresql', 'mongodb', 'redis')),
    host VARCHAR(255) NOT NULL DEFAULT 'localhost',
    port INTEGER NOT NULL DEFAULT 5432,
    username VARCHAR(128) NOT NULL,
    password_enc TEXT,
    database_name VARCHAR(128) NOT NULL,
    target_schema VARCHAR(128) NOT NULL DEFAULT 'bizdata_mat',
    is_default BOOLEAN NOT NULL DEFAULT false,
    last_test_status VARCHAR(32),
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bizdata_db_conn_default ON bizdata.database_connections (is_default);

ALTER TABLE bizdata.materialization_runs
    ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES bizdata.database_connections(id);

CREATE INDEX IF NOT EXISTS idx_bizdata_mat_runs_conn ON bizdata.materialization_runs (connection_id);

-- 默认本地 PostgreSQL 连接（密码需在应用内通过 API 更新或使用环境变量初始化）
INSERT INTO bizdata.database_connections (
    id, name, db_type, host, port, username, password_enc, database_name, target_schema, is_default
)
SELECT
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    '本地 PostgreSQL（应用库）',
    'postgresql',
    'localhost',
    35432,
    'yoyo',
    NULL,
    'fyMOM',
    'bizdata_mat',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM bizdata.database_connections WHERE is_default = true
);
