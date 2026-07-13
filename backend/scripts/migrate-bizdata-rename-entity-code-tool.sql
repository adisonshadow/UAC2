-- bizdata_rename_entity_code Tool + Scope 调整禁止 delete+create 指引

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, config, is_active
)
VALUES (
    '66666666-6666-4666-8666-666666666637',
    '55555555-5555-4555-8555-555555555501',
    '重命名实体 Code',
    'bizdata-rename-entity-code',
    'bizdata_rename_entity_code',
    '调整实体 Scope 层级或重命名 code（保留字段/索引/关系/物化/MOCK）；禁止 delete + create',
    'client',
    '{"type":"object","properties":{"entityCode":{"type":"string","description":"当前/旧 code，如 fmms:WorkCard"},"code":{"type":"string","description":"新 code，如 fmms:production:WorkCard"},"tableName":{"type":"string","description":"可选 ER 物理表名"}},"required":["entityCode","code"]}'::jsonb,
    E'## bizdata_rename_entity_code\n\n**Scope 调整 / code 重命名的唯一推荐路径**（FMMS 按二级子 Scope 重建等）。\n\n### 参数（仅这 2～3 项）\n- `entityCode`：当前/旧 code（如 `fmms:WorkCard`）\n- `code`：新 code（如 `fmms:production:WorkCard`）\n- 可选 `tableName`（ER；默认推导表名时随 code 同步）\n\n### 禁止\n- **勿**传 fields / indexes / relations / label\n- **勿**用 `bizdata_delete_entity` + `bizdata_create_entity` 删除重建\n\n### 成功后\n1. 用**新 code** 调 `bizdata_get_entity` / `bizdata_list_entities` 验证 `_verification.verified=true`\n2. 对该实体 `bizdata_validate_model`（传新 entityCode）\n3. 若表名随 code 变更，已物化连接上的物理表/集合会自动重命名；可用 `bizdata_browse_materialized_rows` 验证',
    '{}'::jsonb,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    function_name = EXCLUDED.function_name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

UPDATE aibase.tools
SET
    description = '创建全新实体（code 须不存在）；调整 Scope/重命名请用 bizdata_rename_entity_code',
    review_markdown = E'## bizdata_create_entity\n\ncode 格式 `Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`）。**仅用于 code 不存在的新实体**。\n\n若 code 已存在 → 用 **`bizdata_rename_entity_code`**（仅 entityCode + code），**禁止** delete + create。\n\n推荐同时传 fields、indexes、relations；分步则须 upsert_entity_indexes 与 add_relation。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_entity';

UPDATE aibase.tools
SET
    description = '更新实体 label/字段/layout；改 code 请优先 bizdata_rename_entity_code',
    review_markdown = E'## bizdata_update_entity\n\n### 修改 Code\n- **优先**用 **`bizdata_rename_entity_code`**（仅 entityCode + code）\n- 若用本 Tool：仅传 entityCode + code（可选 tableName），**勿**传 fields/layout 等\n- 成功后须 `_verification.verified=true` 且用新 code 验证\n\n### 字段 / 索引 / 关系\n- 字段：传 fields（默认 merge）\n- 索引：**bizdata_upsert_entity_indexes**\n- 关系：**bizdata_add_relation**\n\n保存后 version 自增，页面 UI 自动同步。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_update_entity';

UPDATE aibase.tools
SET
    description = '永久删除实体；禁止用于 Scope 调整，请用 bizdata_rename_entity_code',
    parameters_schema = '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string","description":"与 entityId 二选一"}}}'::jsonb,
    review_markdown = E'## bizdata_delete_entity\n\n**禁止**用于 Scope 调整或 code 重命名 → 用 **`bizdata_rename_entity_code`**。\n\n仅当用户**明确要求删除**且确认数据可丢失时使用。\n\n须传 entityCode 或 list 返回的真实 entityId；返回 `_verification.verified=true` 才算删除成功。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_delete_entity';

UPDATE aibase.skills
SET
    content_markdown = E'# 业务数据模型设计助手\n\n你是 EADAF 业务数据建模助手。**禁止**只建空实体或只写字段就结束。\n\n## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`）\n- Scope 树由实体 code 冒号路径推导，**无独立 create_scope Tool**\n\n## Scope 调整 / 修改 Code（必遵）\n- **唯一推荐**：**`bizdata_rename_entity_code`**，仅传 `entityCode`（旧）+ `code`（新）\n- 备选：`bizdata_update_entity` 同样仅传 entityCode + code\n- **禁止** `bizdata_delete_entity` + `bizdata_create_entity`（丢失物化/MOCK/关系，且常虚假成功）\n- 批量改 Scope 流程：list_entities → 逐个 rename_entity_code → 再 list 验证 → validate_model\n- 必须以 Tool 返回的 `_verification.verified=true` 为准，禁止未验证就声称成功\n\n## 完整建模（必遵）\n1. 枚举 → 2. 字段 → 3. 索引 → 4. 关系 → 5. `bizdata_validate_model`\n\n## 连续执行\n用户确认后须连续调用 Tool，禁止只输出步骤说明。\n\n## 阶段边界\n默认仅逻辑建模；物化/API/MOCK 须用户明确请求。',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_rename_entity_code'
ON CONFLICT DO NOTHING;
