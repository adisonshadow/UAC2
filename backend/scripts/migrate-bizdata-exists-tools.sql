-- 增量：实体 / 枚举 / Scope 存在性判断 Tool（AI 自动新建前准备）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-6666666666d1',
        '55555555-5555-4555-8555-555555555501',
        '判断实体是否存在',
        'bizdata-exists-entity',
        'bizdata_exists_entity',
        '按精确 code 判断实体是否已存在。AI 自动新建前必须先调用：exists=true 则改用 update/rename，禁止盲目 create',
        'client',
        '{"type":"object","required":["code"],"properties":{"code":{"type":"string","description":"实体 code，如 sales:order:Order"}}}'::jsonb,
        E'## bizdata_exists_entity\n\n按精确 code 查询实体是否存在。始终返回 `{ exists, item }`，不抛 404。\n\n### 何时用\n- **create 之前必须调用**\n- exists=true：用 `bizdata_update_entity` / `bizdata_rename_entity_code`，禁止 delete+create\n- exists=false：再 `bizdata_create_entity`',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-6666666666d2',
        '55555555-5555-4555-8555-555555555501',
        '判断枚举是否存在',
        'bizdata-exists-enum',
        'bizdata_exists_enum',
        '按精确 code 判断枚举是否已存在。AI 自动新建前必须先调用：exists=true 则改用 update，禁止盲目 create',
        'client',
        '{"type":"object","required":["code"],"properties":{"code":{"type":"string","description":"枚举 code，如 production:WorkOrderStatus"}}}'::jsonb,
        E'## bizdata_exists_enum\n\n按精确 code 查询枚举是否存在。始终返回 `{ exists, item }`。\n\n### 何时用\n- **create_enum 之前必须调用**\n- exists=true：`bizdata_update_enum` 补齐 values/items\n- exists=false：再 `bizdata_create_enum`',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-6666666666d3',
        '55555555-5555-4555-8555-555555555501',
        '判断 Scope 是否存在',
        'bizdata-exists-scope',
        'bizdata_exists_scope',
        '判断 Scope（实体 code 前缀）下是否已有实体。新建域/子域前调用；Scope 由实体 code 推导，无独立 create_scope',
        'client',
        '{"type":"object","required":["code"],"properties":{"code":{"type":"string","description":"Scope code，如 sales 或 sales:order"}}}'::jsonb,
        E'## bizdata_exists_scope\n\n判断实体 code 前缀下是否已有实体。返回 `{ exists, item, entityCount }`。\n\n### 说明\n- Scope 由实体 code 冒号路径推导，**无独立 create_scope**\n- 查询 `sales:order`：若已有 `sales:order:Order` 则 exists=true\n- 完整实体 code 请用 `bizdata_exists_entity`',
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
SELECT s.id, t.id, 3
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_exists_entity'
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 4
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_exists_enum'
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 5
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_exists_scope'
ON CONFLICT DO NOTHING;

UPDATE aibase.skills SET
    content_markdown = REPLACE(
      content_markdown,
      E'## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`、`sales:order:Order`）\n- Enum code：同 Scope 层级 + 枚举名（如 `fmms:production:WorkCardStatus`）\n- Scope 树由实体 code 冒号路径推导，**无独立 create_scope Tool**\n',
      E'## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`、`sales:order:Order`）\n- Enum code：同 Scope 层级 + 枚举名（如 `fmms:production:WorkCardStatus`）\n- Scope 树由实体 code 冒号路径推导，**无独立 create_scope Tool**\n\n## 自动新建前必须 exists\n- 实体：`bizdata_exists_entity({ code })`，true 则 update/rename，禁止盲目 create\n- 枚举：`bizdata_exists_enum({ code })`，true 则 `bizdata_update_enum`\n- Scope：`bizdata_exists_scope({ code })` 判断前缀下是否已有实体（完整实体 code 用 exists_entity）\n'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%bizdata_exists_entity%';
