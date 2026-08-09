-- 增量：业务数据模型设计 — 索引与关系相关 AI Tool / Skill 说明

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        -- 与 bizdata-ai-seed.sql 对齐；不可用 …613/614/615（metadata 工具占用）或 …637/638/639
        '66666666-6666-4666-8666-666666666646',
        '55555555-5555-4555-8555-555555555501',
        '列出关系',
        'bizdata-list-relations',
        'bizdata_list_relations',
        '列出全部实体关系',
        'client',
        '{"type":"object","properties":{}}'::jsonb,
        '## bizdata_list_relations\n\n返回所有关系，含 fromEntity/toEntity 的 code。创建实体后应用此 Tool 核对关系是否已建立。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666647',
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
        '66666666-6666-4666-8666-666666666648',
        '55555555-5555-4555-8555-555555555501',
        '更新实体索引',
        'bizdata-upsert-entity-indexes',
        'bizdata_upsert_entity_indexes',
        '创建或合并实体 layout.indexes',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"replaceIndexes":{"type":"boolean"},"indexes":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"fields":{"type":"array","items":{"type":"string"}},"unique":{"type":"boolean"},"type":{"type":"string","enum":["btree","hash","gin","gist"]}},"required":["name","fields"]}}},"required":["indexes"]}'::jsonb,
        E'## bizdata_upsert_entity_indexes\n\n写入 `layout.indexes`，创建实体并添加字段后**必须**调用。\n\n### 索引建议\n- 主键：`{ "name": "pk_id", "fields": ["id"], "unique": true }`\n- 唯一字段：email、code 等设 `unique: true`\n- 外键：`customer_id` 等设普通 btree\n- 复合索引：多字段查询场景\n\n### 参数\n- entityCode（推荐）或 entityId\n- indexes 数组；replaceIndexes=true 全量替换\n- fields 必须是实体已有 fieldKey\n\n### 示例\n```json\n{\n  "entityCode": "sale:Customer",\n  "indexes": [\n    { "name": "pk_id", "fields": ["id"], "unique": true, "type": "btree" },\n    { "name": "idx_customer_email", "fields": ["email"], "unique": true }\n  ]\n}\n```',
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

UPDATE aibase.tools SET
    description = '创建实体；可同时传 fields、indexes、relations 一次性完成建模',
    parameters_schema = '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"tableName":{"type":"string"},"fields":{"type":"array","items":{"type":"object"}},"indexes":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"fields":{"type":"array","items":{"type":"string"}},"unique":{"type":"boolean"},"type":{"type":"string"}}}},"relations":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string"},"name":{"type":"string"},"fromEntityCode":{"type":"string"},"toEntityCode":{"type":"string"},"inverseName":{"type":"string"},"joinTable":{"type":"string"}}}}},"required":["code","label"]}'::jsonb,
    review_markdown = E'## bizdata_create_entity\n\ncode 格式 `Scope:EntityName`（如 sale:Customer）。\n\n### 完整建模（推荐）\n一次调用同时传：\n1. **fields** — 字段定义\n2. **indexes** — 主键/唯一/外键/查询字段索引\n3. **relations** — 与其他实体的关系（用 entityCode）\n\n若分步创建，创建后必须调用 `bizdata_upsert_entity_indexes` 和 `bizdata_add_relation`。\n\n### relations 示例\n```json\n{\n  "type": "manyToOne",\n  "name": "customer",\n  "fromEntityCode": "sale:Order",\n  "toEntityCode": "sale:Customer"\n}\n```\n\n关系 type：oneToMany / manyToOne / oneToOne / manyToMany',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_entity';

UPDATE aibase.tools SET
    description = '添加实体关系；优先 fromEntityCode/toEntityCode',
    parameters_schema = '{"type":"object","properties":{"type":{"type":"string","enum":["oneToMany","manyToOne","oneToOne","manyToMany"]},"name":{"type":"string"},"inverseName":{"type":"string"},"fromEntityCode":{"type":"string"},"toEntityCode":{"type":"string"},"fromEntityId":{"type":"string"},"toEntityId":{"type":"string"},"joinTable":{"type":"string"},"config":{"type":"object"}},"required":["type","name"]}'::jsonb,
    review_markdown = E'## bizdata_add_relation\n\n**优先传 fromEntityCode / toEntityCode**（如 sale:Order → sale:Customer），禁止编造 UUID。\n\n### type 含义（from → to）\n- **manyToOne**：多对一（Order 多 → Customer 一）\n- **oneToMany**：一对多\n- **oneToOne**：一对一\n- **manyToMany**：多对多（可传 joinTable）\n\n### 示例\n```json\n{\n  "type": "manyToOne",\n  "name": "customer",\n  "inverseName": "orders",\n  "fromEntityCode": "sale:Order",\n  "toEntityCode": "sale:Customer"\n}\n```\n\n创建实体后应用 `bizdata_list_relations` 验证。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_add_relation';

UPDATE aibase.tools SET
    review_markdown = E'## bizdata_update_entity\n\n保存后 version 自增，**页面 UI 会自动同步**。\n\n### 索引\n- 请用 **bizdata_upsert_entity_indexes**（不要手写 layout.indexes）\n\n### 关系\n- 请用 **bizdata_add_relation** + **bizdata_list_relations** 验证',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_update_entity';

UPDATE aibase.tools SET
    description = '校验字段、索引引用与关系完整性',
    review_markdown = E'## bizdata_validate_model\n\n单实体模式传 entityCode，检查：\n- 是否有字段\n- 是否缺少索引建议\n- 索引 fields 是否引用有效 fieldKey\n- 外键字段是否已建关系\n\n全库模式不传参数，返回 entityCount / relationCount。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_validate_model';

UPDATE aibase.skills SET
    content_markdown = E'# 业务数据模型设计助手\n\n你是 EADAF 业务数据建模助手。\n\n## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 sale:Customer）\n- `er_table`：关系型表；`json_schema`：JSON 结构\n\n## 完整建模流程（创建实体时必遵）\n创建实体**不是**只建空表。每次新建或批量新建实体须完成三步：\n\n### 1. 实体 + 字段\n- **推荐**：`bizdata_create_entity` 同时传 `code`、`label`、`fields`\n- 或 `bizdata_create_entity` + `bizdata_update_entity` 补字段\n\n### 2. 索引（必做）\n字段保存后调用 **`bizdata_upsert_entity_indexes`**：\n- 主键 id → unique btree\n- unique 字段（email、code）→ unique 索引\n- 外键字段（`*_id`）→ 普通 btree\n- 常用查询字段（状态、时间）→ btree\n- 复合查询 → 复合索引\n\n### 3. 关系（有外键或业务关联时必做）\n- **`bizdata_add_relation`**，**优先 fromEntityCode / toEntityCode**\n- manyToOne：多的一方 from → 一的一方 to（如 Order → Customer）\n- 批量创建可用 `bizdata_create_entity` 的 `relations` 数组\n- 完成后 **`bizdata_list_relations`** 验证\n\n### 4. 校验\n- `bizdata_validate_model`（传 entityCode）\n- `bizdata_get_entity` 核对 version、layout.indexes\n\n## ID 规则\n- **禁止编造** entityId；用 entityCode 或 list 返回的 UUID\n- relationId 从 list_relations 获取\n\n## 页面上下文\n- `aibase_read_surfaces` 读取当前选中实体\n\n## UI 同步\n- 写操作成功后模型设计页自动刷新，**不要**提示用户手动刷新\n\n## 注意\n- 每次保存 entity version +1\n- 已锁定实体不可修改',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 50 + row_number() OVER (ORDER BY t.slug)
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name IN (
    'bizdata_list_relations',
    'bizdata_delete_relation',
    'bizdata_upsert_entity_indexes'
  )
ON CONFLICT DO NOTHING;
