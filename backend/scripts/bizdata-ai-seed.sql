-- 业务数据 AI Scope / Skills / Tools 种子数据

INSERT INTO aibase.scopes (id, name, slug, description, is_active)
VALUES (
    '55555555-5555-4555-8555-555555555501',
    '业务数据',
    'business-data',
    'EADAF 业务数据模型设计与物化',
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
        '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"tableName":{"type":"string"},"fields":{"type":"array","items":{"type":"object"}},"indexes":{"type":"array","items":{"type":"object"}},"relations":{"type":"array","items":{"type":"object"}}},"required":["code","label"]}'::jsonb,
        E'## bizdata_create_entity\n\ncode 格式 Scope:EntityName。推荐同时传 fields、indexes、relations 完成完整建模；分步则须调用 upsert_entity_indexes 与 add_relation。',
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
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"label":{"type":"string"},"replaceFields":{"type":"boolean"},"layout":{"type":"object","description":"实体 layout，含 indexes 等"},"jsonSchema":{"type":"object","description":"JSON Schema 结构"},"fields":{"type":"array","items":{"type":"object","properties":{"fieldKey":{"type":"string"},"name":{"type":"string"},"label":{"type":"string"},"type":{"type":"string"},"length":{"type":"integer"},"nullable":{"type":"boolean"},"unique":{"type":"boolean"},"primary":{"type":"boolean"},"columnInfo":{"type":"object"},"typeormConfig":{"type":"object"}}}}}}'::jsonb,
        E'## bizdata_update_entity\n\n保存后 version 自增，**页面 UI 会自动同步**，无需用户手动刷新。\n\n### 定位实体\n- entityId 或 entityCode（如 sale:customer）二选一\n\n### 字段格式\n每项至少提供 fieldKey 或 name：\n```json\n{ "name": "company_name", "label": "公司名称", "type": "varchar", "length": 255, "nullable": false }\n```\n\n### 索引与关系\n- 索引请用 **bizdata_upsert_entity_indexes**\n- 关系请用 **bizdata_add_relation** + **bizdata_list_relations**\n\n### 合并策略\n- 默认 merge：只传新增/修改字段，保留已有字段\n- replaceFields=true：全量替换\n\n### 页面上下文\n- 可用 `aibase_read_surfaces` 读取当前选中实体等页面状态',
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
        '创建 ADB 枚举定义；有限取值字段须先建枚举再在实体字段用 adb-enum 引用',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"values":{"type":"object"},"items":{"type":"object"}},"required":["code","values"]}'::jsonb,
        E'## bizdata_create_enum\n\ncode 如 production:WorkOrderStatus。实体字段引用：`type: adb-enum` + `enumCode`。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666636',
        '55555555-5555-4555-8555-555555555501',
        '列出枚举',
        'bizdata-list-enums',
        'bizdata_list_enums',
        '列出已定义的 ADB 枚举',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"}}}'::jsonb,
        '## bizdata_list_enums\n\n创建 status 等字段前先查可复用枚举。',
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
        '{"type":"object","properties":{"type":{"type":"string","enum":["oneToMany","manyToOne","oneToOne","manyToMany"]},"name":{"type":"string"},"inverseName":{"type":"string"},"fromEntityCode":{"type":"string"},"toEntityCode":{"type":"string"},"fromEntityId":{"type":"string"},"toEntityId":{"type":"string"},"joinTable":{"type":"string"},"config":{"type":"object"}},"required":["type","name"]}'::jsonb,
        E'## bizdata_add_relation\n\n**优先 fromEntityCode / toEntityCode**。manyToOne：from 多方 → to 一方。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666608',
        '55555555-5555-4555-8555-555555555501',
        '校验模型',
        'bizdata-validate-model',
        'bizdata_validate_model',
        '校验实体模型完整性；默认 markValidated=true，通过时写入 entityInfo.modelValidated=true',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string","description":"如 production:WorkOrder"},"markValidated":{"type":"boolean","description":"为 true 时根据校验结果更新是否验证通过，默认 true"}}}'::jsonb,
        E'## bizdata_validate_model\n\n**每个实体创建/修改后必须调用**（传 entityCode）。\n\n- 默认 markValidated=true：isValid 为 true 时自动标记「验证通过」\n- 批量创建后须对每个实体各调用一次',
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
        '{"type":"object","properties":{"connectionId":{"type":"string"}}}'::jsonb,
        '## bizdata_get_materialization_status',
        '{"handler":"bizdata_get_materialization_status"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666638',
        '55555555-5555-4555-8555-555555555501',
        '浏览物化表结构',
        'bizdata-browse-materialized-schema',
        'bizdata_browse_materialized_schema',
        '读取已物化物理表/集合/Redis 结构的字段定义',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"}},"required":["connectionId"]}'::jsonb,
        E'## bizdata_browse_materialized_schema\n\n传 connectionId + entityCode（或 entityId）。',
        '{"handler":"bizdata_browse_materialized_schema"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666639',
        '55555555-5555-4555-8555-555555555501',
        '浏览物化表数据',
        'bizdata-browse-materialized-rows',
        'bizdata_browse_materialized_rows',
        '分页读取已物化物理表数据',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"},"page":{"type":"integer"},"pageSize":{"type":"integer"}},"required":["connectionId"]}'::jsonb,
        E'## bizdata_browse_materialized_rows',
        '{"handler":"bizdata_browse_materialized_rows"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666640',
        '55555555-5555-4555-8555-555555555501',
        '插入MOCK数据',
        'bizdata-insert-mock-data',
        'bizdata_insert_mock_data',
        '向已物化物理表插入 MOCK 测试数据',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"},"rows":{"type":"array","items":{"type":"object"}}},"required":["connectionId","rows"]}'::jsonb,
        E'## bizdata_insert_mock_data\n\n开发测试用途，传 rows 数组。',
        '{"handler":"bizdata_insert_mock_data"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666637',
        '55555555-5555-4555-8555-555555555501',
        '列出关系',
        'bizdata-list-relations',
        'bizdata_list_relations',
        '列出全部实体关系',
        'client',
        '{"type":"object","properties":{}}'::jsonb,
        '## bizdata_list_relations',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666638',
        '55555555-5555-4555-8555-555555555501',
        '删除关系',
        'bizdata-delete-relation',
        'bizdata_delete_relation',
        '删除实体关系',
        'client',
        '{"type":"object","properties":{"relationId":{"type":"string"}},"required":["relationId"]}'::jsonb,
        '## bizdata_delete_relation',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666639',
        '55555555-5555-4555-8555-555555555501',
        '更新实体索引',
        'bizdata-upsert-entity-indexes',
        'bizdata_upsert_entity_indexes',
        '创建或合并实体 layout.indexes',
        'client',
        '{"type":"object","properties":{"entityCode":{"type":"string"},"indexes":{"type":"array","items":{"type":"object"}}},"required":["indexes"]}'::jsonb,
        E'## bizdata_upsert_entity_indexes\n\n创建实体后为主键/外键/唯一/查询字段建索引。',
        '{}'::jsonb,
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
        E'# 业务数据模型设计助手\n\n你是 EADAF 业务数据建模助手。**禁止**只建空实体或只写字段就结束。\n\n## 编码规范\n- Entity code：`Scope:EntityName`（如 production:WorkOrder）\n- Enum code：`Scope:EnumName`（如 production:WorkOrderStatus）\n\n## 完整建模（必遵）\n1. **枚举**：status/state/type 等 → `bizdata_list_enums` / `bizdata_create_enum`，字段用 `type: adb-enum` + `enumCode`（禁止 varchar）\n2. **字段**：`bizdata_create_entity` 传 fields\n3. **索引（必做）**：`bizdata_upsert_entity_indexes` 或 create 时传 indexes\n4. **关系（必做）**：`bizdata_add_relation` 或 create 时传 relations，再 `bizdata_list_relations` 验证\n5. **校验**：`bizdata_validate_model` 每个实体必调（entityCode，markValidated 默认 true）\n\n## 验证通过标记\n- 新建实体默认未验证通过\n- 批量创建后须对每个实体调用 `bizdata_validate_model`，isValid 为 true 时自动标记验证通过\n- 校验失败则根据 errors 修复后重新校验\n\n## 连续执行（重要）\n用户确认「开始」「继续」「完善」后，须**连续调用 Tool** 完成枚举→字段→索引→关系→**校验**，**禁止**做完一步只输出「第N步」叙述就停。\n- 写了「第五步：模型校验」必须立刻对每个实体调用 `bizdata_validate_model`（entityCode）。\n\n## ID 规则\n- 禁止编造 entityId；用 entityCode 或 list 返回的 UUID\n\n## UI 同步\n- 写操作成功后前端会自动刷新，不要提示用户手动刷新\n\n## 阶段边界（必遵）\n- **默认任务范围**：仅**逻辑模型**（枚举 → 字段 → 索引 → 关系 → `bizdata_validate_model` 校验）\n- 全部目标实体的 `bizdata_validate_model` 均 isValid=true 后，**本阶段结束**，停止 Tool 调用\n- **禁止**在本阶段调用：物化、MOCK 数据、API 服务、指标、采集管道\n- 仅当用户**明确**要求「一并物化 / 创建 API / 创建指标 / 全套服务」时，才在总结中说明需切换对应页面\n\n## 阶段完成后的下一步（A2UI）\n全部实体校验通过后，按 **aibase-chat-framework** 约定，在回复末尾输出 `a2ui-commands` 块（见全局 Framework Skill），建议 materialize / create_api / create_metrics / refine_model 等 3～5 条。',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777702',
        '55555555-5555-4555-8555-555555555501',
        '业务数据物化',
        'bizdata-materialization',
        '辅助 SQL/代码物化与版本对比',
        E'# 业务数据物化助手\n\n你是 EADAF 数据物化助手。\n\n## 支持的数据库\n- PostgreSQL（SQL DDL）\n- MongoDB（Collection + 索引）\n- Redis（Key 结构/schema 元数据）\n\n## 流程\n1. 确认目标 connectionId（可先让用户在「物化执行」页选择连接）\n2. bizdata_get_materialization_status 查看 stale 状态\n3. bizdata_preview_materialization 预览脚本（传 connectionId）\n4. 用户确认后 bizdata_execute_materialization（dryRun=false，传 connectionId）\n\n## MOCK 测试数据（开发用途）\n- **仅用于开发/测试**，会向物化物理表写入真实数据\n- 流程：`bizdata_get_entity` → `bizdata_insert_mock_data`（connectionId + entityCode + rows）\n- 可选 `bizdata_browse_materialized_rows` 查看现有数据\n- 每个实体建议 5–10 条；枚举用 enum items 的 value\n\n## 版本\n- 物化记录绑定 entity_version 与 connection_id\n- 若模型 version > 物化 version，需提示用户重新物化',
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
    'bizdata_list_enums',
    'bizdata_list_relations', 'bizdata_add_relation', 'bizdata_delete_relation',
    'bizdata_upsert_entity_indexes', 'bizdata_validate_model'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'aibase_read_surfaces'
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
    'bizdata_browse_materialized_schema', 'bizdata_browse_materialized_rows',
    'bizdata_insert_mock_data',
    'bizdata_list_entities', 'bizdata_get_entity'
  )
ON CONFLICT DO NOTHING;
