-- 增量：强化业务数据模型设计 AI Skill/Tool（枚举、索引、关系）
-- 用法：psql -f scripts/migrate-bizdata-model-ai-hints.sql

INSERT INTO aibase.tools (
    scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '55555555-5555-4555-8555-555555555501',
        '列出关系',
        'bizdata-list-relations',
        'bizdata_list_relations',
        '列出全部实体关系',
        'client',
        '{"type":"object","properties":{}}'::jsonb,
        E'## bizdata_list_relations\n\n批量建实体后**必须**调用以验证关系是否已建立。',
        '{}'::jsonb,
        true
    ),
    (
        '55555555-5555-4555-8555-555555555501',
        '删除关系',
        'bizdata-delete-relation',
        'bizdata_delete_relation',
        '删除实体关系',
        'client',
        '{"type":"object","properties":{"relationId":{"type":"string"}},"required":["relationId"]}'::jsonb,
        '## bizdata_delete_relation\n\nrelationId 来自 bizdata_list_relations。',
        '{}'::jsonb,
        true
    ),
    (
        '55555555-5555-4555-8555-555555555501',
        '更新实体索引',
        'bizdata-upsert-entity-indexes',
        'bizdata_upsert_entity_indexes',
        '创建或合并实体 layout.indexes',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"replaceIndexes":{"type":"boolean"},"indexes":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"fields":{"type":"array","items":{"type":"string"}},"unique":{"type":"boolean"},"type":{"type":"string","enum":["btree","hash","gin","gist"]}},"required":["name","fields"]}}},"required":["indexes"]}'::jsonb,
        E'## bizdata_upsert_entity_indexes\n\n**每个实体建完字段后必做**。主键/唯一/外键/status 等查询字段均需索引。',
        '{}'::jsonb,
        true
    ),
    (
        '55555555-5555-4555-8555-555555555501',
        '列出枚举',
        'bizdata-list-enums',
        'bizdata_list_enums',
        '列出已定义的 ADB 枚举；创建 status 等字段前先查询可复用枚举',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string","description":"如 production:"}}}'::jsonb,
        E'## bizdata_list_enums\n\n创建 status/state/type 等有限取值字段前**必须先查枚举**。',
        '{}'::jsonb,
        true
    )
ON CONFLICT (function_name) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

UPDATE aibase.tools SET
    description = '创建实体；须同时完成 fields、indexes、relations；status 等字段用 adb-enum',
    review_markdown = E'## bizdata_create_entity\n\ncode 格式 `Scope:EntityName`（如 production:WorkOrder）。\n\n### 完整建模（批量创建时必遵）\n一次调用同时传：\n1. **fields** — 含主键、业务字段\n2. **indexes** — 主键/唯一/外键/status 查询索引\n3. **relations** — 实体间关系（fromEntityCode/toEntityCode）\n\n### 枚举字段（status/state/type 等）\n**禁止**用 varchar 存状态。流程：\n1. `bizdata_list_enums` 查是否已有\n2. 无则 `bizdata_create_enum`（code 如 production:WorkOrderStatus）\n3. 字段：`{ "fieldKey": "status", "label": "状态", "type": "adb-enum", "enumCode": "production:WorkOrderStatus" }`\n\n### 分步创建时\n创建后**必须**调用 `bizdata_upsert_entity_indexes` 和 `bizdata_add_relation`，最后 `bizdata_validate_model`。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_entity';

UPDATE aibase.tools SET
    description = '创建 ADB 枚举；有限取值字段须先建枚举再在实体字段引用',
    parameters_schema = '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"values":{"type":"object"},"items":{"type":"object"}},"required":["code","values"]}'::jsonb,
    review_markdown = E'## bizdata_create_enum\n\n### code 规范\n`Scope:EnumName`，如 `production:WorkOrderStatus`\n\n### 引用到实体字段\n```json\n{ "fieldKey": "status", "type": "adb-enum", "enumCode": "production:WorkOrderStatus", "label": "状态" }\n```',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_enum';

UPDATE aibase.tools SET
    review_markdown = E'## bizdata_update_entity\n\n### 枚举字段\nstatus/state/type 等须 `type: adb-enum` + `enumCode`。\n\n### 索引与关系\n- 索引：**bizdata_upsert_entity_indexes**\n- 关系：**bizdata_add_relation** + **bizdata_list_relations**',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_update_entity';

UPDATE aibase.tools SET
    description = '添加实体关系；优先 fromEntityCode/toEntityCode',
    review_markdown = E'## bizdata_add_relation\n\n**优先 fromEntityCode / toEntityCode**。manyToOne：多方 from → 一方 to。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_add_relation';

UPDATE aibase.tools SET
    description = '校验字段类型、枚举、索引与关系完整性',
    parameters_schema = '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"}}}'::jsonb,
    review_markdown = E'## bizdata_validate_model\n\n**每个实体创建/修改后必须调用**（传 entityCode）。检查 status 是否误用 varchar、是否有索引、外键是否有关系。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_validate_model';

UPDATE aibase.skills SET
    content_markdown = E'# 业务数据模型设计助手\n\n你是 EADAF 业务数据建模助手。**禁止**只建空实体或只写字段就结束。\n\n## 编码规范\n- Entity code：`Scope:EntityName`（如 production:WorkOrder）\n- Enum code：`Scope:EnumName`（如 production:WorkOrderStatus）\n\n## 完整建模流程（批量创建实体时必遵）\n\n### 0. 枚举（有限取值字段）\nstatus/state/type 等固定选项：\n1. `bizdata_list_enums`（codePrefix=Scope）\n2. 无则 `bizdata_create_enum`\n3. 字段 **type=adb-enum** + **enumCode**，**禁止 varchar**\n\n### 1. 实体 + 字段\n`bizdata_create_entity` 传 fields；主键建议 uuid/adb-guid-id\n\n### 2. 索引（每个实体必做）\n`bizdata_upsert_entity_indexes` 或 create 时 indexes：主键/唯一/外键/status/时间字段\n\n### 3. 关系（有外键时必做）\n`bizdata_add_relation` 或 create 时 relations → `bizdata_list_relations` 验证\n\n### 4. 校验（每个实体必做）\n`bizdata_validate_model`（entityCode）+ `bizdata_get_entity`\n\n## 禁止\n- status 用 varchar\n- 未建索引/关系就声称完成\n- 编造 entityId\n\n## UI 同步\n写操作成功后页面自动刷新，勿提示用户手动刷新',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) + 40
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name IN (
    'bizdata_list_enums',
    'bizdata_list_relations',
    'bizdata_delete_relation',
    'bizdata_upsert_entity_indexes'
  )
ON CONFLICT DO NOTHING;
