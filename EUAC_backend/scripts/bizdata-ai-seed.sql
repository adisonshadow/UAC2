-- 业务数据 AI Scope / Skills / Tools 种子数据

INSERT INTO aibase.scopes (id, name, slug, description, is_active)
VALUES (
    '55555555-5555-4555-8555-555555555501',
    '业务数据',
    'business-data',
    'EUAC 业务数据模型设计与物化',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666601',
        '55555555-5555-4555-8555-555555555501',
        '列出实体',
        'bizdata-list-entities',
        'bizdata_list_entities',
        '列出业务数据实体与 Scope 树',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]}}}'::jsonb,
        '## bizdata_list_entities\n\n可选 codePrefix、entityKind 过滤。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666602',
        '55555555-5555-4555-8555-555555555501',
        '获取实体详情',
        'bizdata-get-entity',
        'bizdata_get_entity',
        '按 ID 或 code 获取实体详情含字段',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"}}}'::jsonb,
        '## bizdata_get_entity\n\nentityId 或 entityCode 二选一。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666603',
        '55555555-5555-4555-8555-555555555501',
        '创建实体',
        'bizdata-create-entity',
        'bizdata_create_entity',
        '创建 ER 表或 JSON 结构实体',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"tableName":{"type":"string"}},"required":["code","label"]}'::jsonb,
        '## bizdata_create_entity\n\ncode 格式 Scope1:Scope2:EntityName。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666604',
        '55555555-5555-4555-8555-555555555501',
        '更新实体',
        'bizdata-update-entity',
        'bizdata_update_entity',
        '更新实体信息与字段',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"label":{"type":"string"},"replaceFields":{"type":"boolean"},"fields":{"type":"array","items":{"type":"object","properties":{"fieldKey":{"type":"string"},"name":{"type":"string"},"label":{"type":"string"},"type":{"type":"string"},"length":{"type":"integer"},"nullable":{"type":"boolean"},"unique":{"type":"boolean"},"primary":{"type":"boolean"},"columnInfo":{"type":"object"},"typeormConfig":{"type":"object"}}}}}}'::jsonb,
        E'## bizdata_update_entity\n\n保存后 version 自增。\n\n### 定位实体\n- entityId 或 entityCode（如 sale:customer）二选一\n\n### 字段格式\n每项至少提供 fieldKey 或 name：\n```json\n{ "name": "company_name", "label": "公司名称", "type": "varchar", "length": 255, "nullable": false }\n```\n\n### 合并策略\n- 默认 merge：只传新增/修改字段，保留已有字段\n- replaceFields=true：全量替换',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666605',
        '55555555-5555-4555-8555-555555555501',
        '删除实体',
        'bizdata-delete-entity',
        'bizdata_delete_entity',
        '删除实体',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"}},"required":["entityId"]}'::jsonb,
        '## bizdata_delete_entity',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666606',
        '55555555-5555-4555-8555-555555555501',
        '创建枚举',
        'bizdata-create-enum',
        'bizdata_create_enum',
        '创建 ADB 枚举定义',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"enumInfo":{"type":"object"},"values":{"type":"object"}},"required":["code"]}'::jsonb,
        '## bizdata_create_enum',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666607',
        '55555555-5555-4555-8555-555555555501',
        '添加关系',
        'bizdata-add-relation',
        'bizdata_add_relation',
        '添加实体间关系',
        'client',
        '{"type":"object","properties":{"type":{"type":"string"},"name":{"type":"string"},"fromEntityId":{"type":"string"},"toEntityId":{"type":"string"}},"required":["type","name","fromEntityId","toEntityId"]}'::jsonb,
        '## bizdata_add_relation',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666608',
        '55555555-5555-4555-8555-555555555501',
        '校验模型',
        'bizdata-validate-model',
        'bizdata_validate_model',
        '校验实体结构命名与字段配置',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"}}}'::jsonb,
        '## bizdata_validate_model',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666609',
        '55555555-5555-4555-8555-555555555501',
        '物化预览',
        'bizdata-preview-materialization',
        'bizdata_preview_materialization',
        '预览 SQL 与 TypeScript 代码',
        'server_builtin',
        '{"type":"object","properties":{"entityIds":{"type":"array","items":{"type":"string"}},"targetSchema":{"type":"string"}}}'::jsonb,
        '## bizdata_preview_materialization',
        '{"handler":"bizdata_preview_materialization"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666610',
        '55555555-5555-4555-8555-555555555501',
        '执行物化',
        'bizdata-execute-materialization',
        'bizdata_execute_materialization',
        '执行 DDL 物化并记录 entity_version',
        'server_builtin',
        '{"type":"object","properties":{"entityIds":{"type":"array","items":{"type":"string"}},"targetSchema":{"type":"string"},"dryRun":{"type":"boolean"},"expectedVersions":{"type":"object"}}}'::jsonb,
        '## bizdata_execute_materialization\n\n执行前确认 dryRun=false。',
        '{"handler":"bizdata_execute_materialization"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666611',
        '55555555-5555-4555-8555-555555555501',
        '物化历史',
        'bizdata-list-materialization-runs',
        'bizdata_list_materialization_runs',
        '查询物化批次历史',
        'server_builtin',
        '{"type":"object","properties":{"page":{"type":"integer"},"pageSize":{"type":"integer"}}}'::jsonb,
        '## bizdata_list_materialization_runs',
        '{"handler":"bizdata_list_materialization_runs"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666612',
        '55555555-5555-4555-8555-555555555501',
        '物化状态',
        'bizdata-get-materialization-status',
        'bizdata_get_materialization_status',
        '获取各实体当前版本与物化版本对比',
        'server_builtin',
        '{"type":"object","properties":{}}'::jsonb,
        '## bizdata_get_materialization_status',
        '{"handler":"bizdata_get_materialization_status"}'::jsonb,
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    function_name = EXCLUDED.function_name,
    description = EXCLUDED.description,
    execution_type = EXCLUDED.execution_type,
    parameters_schema = EXCLUDED.parameters_schema,
    server_config = EXCLUDED.server_config,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_active)
VALUES
    (
        '77777777-7777-4777-8777-777777777701',
        '55555555-5555-4555-8555-555555555501',
        '业务数据模型设计',
        'bizdata-model-design',
        '辅助设计 Scope:Entity 层级模型',
        E'# 业务数据模型设计助手\n\n你是 EUAC 业务数据建模助手。\n\n## 编码规范\n- Entity code 格式：`Scope1[:Scope2...]:EntityName`\n- Scope 可以是 1~N 级\n- `er_table`：关系型表；`json_schema`：JSON 结构文档\n\n## 工作流程\n1. 用 bizdata_list_entities 了解现状\n2. 用 bizdata_create_entity / bizdata_update_entity 创建或修改\n3. 用 bizdata_add_relation 建立关系\n4. 用 bizdata_validate_model 校验\n\n## 字段更新（bizdata_update_entity）\n- 用 entityCode（如 sale:customer）或 entityId 定位实体\n- 字段用 fieldKey 或 name，type/label 可写顶层\n- 默认 merge 已有字段，只传新增/修改项；勿反复询问用户确认\n\n## 注意\n- 每次保存 entity version 会 +1\n- 已锁定实体不可修改',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777702',
        '55555555-5555-4555-8555-555555555501',
        '业务数据物化',
        'bizdata-materialization',
        '辅助 SQL/代码物化与版本对比',
        E'# 业务数据物化助手\n\n你是 EUAC 数据物化助手。\n\n## 流程\n1. bizdata_get_materialization_status 查看 stale 状态\n2. bizdata_preview_materialization 预览 SQL/TS\n3. 用户确认后 bizdata_execute_materialization（dryRun=false）\n\n## 版本\n- 物化记录绑定 entity_version\n- 若模型 version > 物化 version，需提示用户重新物化',
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (PARTITION BY s.slug ORDER BY t.slug) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.scope_id = '55555555-5555-4555-8555-555555555501'
  AND t.function_name IN (
    'bizdata_list_entities', 'bizdata_get_entity', 'bizdata_create_entity',
    'bizdata_update_entity', 'bizdata_delete_entity', 'bizdata_create_enum',
    'bizdata_add_relation', 'bizdata_validate_model'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (PARTITION BY s.slug ORDER BY t.slug) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-materialization'
  AND t.scope_id = '55555555-5555-4555-8555-555555555501'
  AND t.function_name IN (
    'bizdata_preview_materialization', 'bizdata_execute_materialization',
    'bizdata_list_materialization_runs', 'bizdata_get_materialization_status',
    'bizdata_list_entities', 'bizdata_get_entity'
  )
ON CONFLICT DO NOTHING;
