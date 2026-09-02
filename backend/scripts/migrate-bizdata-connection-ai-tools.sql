-- 数据库连接 list/create AI Tools + Skill 扩展（含 MySQL ≥ 8.0.13）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
) VALUES
    (
        '66666666-6666-4666-8666-6666666666e1',
        '55555555-5555-4555-8555-555555555501',
        '列出数据库连接',
        'bizdata-list-database-connections',
        'bizdata_list_database_connections',
        '列出已配置的数据库连接（id、名称、dbType、host、port、databaseName、targetSchema）',
        'client',
        '{"type":"object","properties":{}}'::jsonb,
        E'## bizdata_list_database_connections\n\n无参数。创建前先调用，避免重复创建同 host+port+databaseName 的连接。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-6666666666e2',
        '55555555-5555-4555-8555-555555555501',
        '创建数据库连接',
        'bizdata-create-database-connection',
        'bizdata_create_database_connection',
        '创建数据库连接。PostgreSQL/MySQL：databaseName=库名、targetSchema=schema（MySQL Schema 即库，须 ≥8.0.13）；MongoDB：targetSchema 须等于 databaseName；Redis：databaseName 为 0-15 索引、targetSchema 为 Key 前缀，username/password 可选',
        'client',
        '{"type":"object","required":["name","dbType","host","databaseName"],"properties":{"name":{"type":"string"},"dbType":{"type":"string","enum":["postgresql","mysql","mongodb","redis"]},"host":{"type":"string"},"port":{"type":"integer"},"username":{"type":"string"},"password":{"type":"string"},"databaseName":{"type":"string"},"targetSchema":{"type":"string"},"isDefault":{"type":"boolean"}}}'::jsonb,
        E'## bizdata_create_database_connection\n\n从连接串/配置创建连接。\n\n- PostgreSQL：databaseName=库名；targetSchema=schema（缺省 bizdata_mat）；username/password 必填\n- MySQL（须 ≥ 8.0.13）：databaseName=登录库；targetSchema=物化目标库（Schema 即库）；默认端口 3306\n- MongoDB：databaseName=库名；targetSchema 必须等于 databaseName\n- Redis：databaseName 为 0–15；targetSchema 为 Key 前缀；username/password 可选\n- 创建前先 bizdata_list_database_connections，避免重复\n- 缺密码等关键项时追问用户，禁止编造',
        '{}'::jsonb,
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    function_name = EXCLUDED.function_name,
    description = EXCLUDED.description,
    execution_type = EXCLUDED.execution_type,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    server_config = EXCLUDED.server_config,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) + 60
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-materialization'
  AND t.function_name IN (
    'bizdata_list_database_connections',
    'bizdata_create_database_connection'
  )
ON CONFLICT DO NOTHING;

UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 从连接串 / 配置创建连接\n用户消息通常只含配置原文（URI / docker-compose / .env / JDBC 等）。须按本段规则执行，勿要求用户复述细则。\n\n1. 先 `bizdata_list_database_connections`；若已有相同 host+port+databaseName（及同类 dbType）则说明已存在并跳过，勿重复创建\n2. 解析一条或多条：`postgres://`、`postgresql://`、`mysql://`、`jdbc:mysql://`、`mongodb://`、`redis://`、compose、环境变量等\n3. 按类型调用 `bizdata_create_database_connection`：\n   - PostgreSQL：`databaseName`=库名，`targetSchema`=schema（缺省 `bizdata_mat`）；username/password 必填\n   - MySQL（须 ≥ 8.0.13）：`databaseName`=登录库，`targetSchema`=物化目标库（Schema 即库，缺省 `bizdata_mat`）；默认端口 3306；username/password 必填\n   - MongoDB：`databaseName`=库名，`targetSchema` 必须与库名相同；username/password 必填\n   - Redis：`databaseName` 为 0–15 索引（如 `"0"`），`targetSchema` 为 Key 前缀（缺省可用 `bizdata_mat`）；username/password 可选\n4. 缺密码等关键项时向用户追问，不要编造\n5. 禁止未调用 `bizdata_create_database_connection` 就声称已创建；完成后简要汇总（名称、类型、host）\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown NOT LIKE '%bizdata_create_database_connection%';

-- 已存在 Skill 段落时，补 MySQL 说明（幂等）
UPDATE aibase.skills SET
    content_markdown = REPLACE(
      content_markdown,
      E'- PostgreSQL：`databaseName`=库名，`targetSchema`=schema（缺省 `bizdata_mat`）\n- MongoDB：',
      E'- PostgreSQL：`databaseName`=库名，`targetSchema`=schema（缺省 `bizdata_mat`）\n- MySQL（须 ≥ 8.0.13）：`databaseName`=登录库，`targetSchema`=物化目标库（Schema 即库）\n- MongoDB：'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown LIKE '%bizdata_create_database_connection%'
  AND content_markdown NOT LIKE '%MySQL（须 ≥ 8.0.13）%';

-- Skill 正文「支持的数据库」补 MySQL（若有该段落）
UPDATE aibase.skills SET
    content_markdown = REPLACE(
      content_markdown,
      E'## 支持的数据库\n- PostgreSQL（SQL DDL）\n- MongoDB（Collection + 索引）\n- Redis（Key 结构/schema 元数据）',
      E'## 支持的数据库\n- PostgreSQL（SQL DDL）\n- MySQL ≥ 8.0.13（SQL DDL，Schema 即库）\n- MongoDB（Collection + 索引）\n- Redis（Key 结构/schema 元数据）'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown LIKE '%## 支持的数据库%'
  AND content_markdown NOT LIKE '%MySQL ≥ 8.0.13%';
