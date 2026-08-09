-- bizdata_list_entity_summaries：精简实体列表 Tool（不含 fields）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES (
    '66666666-6666-4666-8666-666666666641',
    '55555555-5555-4555-8555-555555555501',
    '精简列出实体',
    'bizdata-list-entity-summaries',
    'bizdata_list_entity_summaries',
    '精简列出业务数据实体（不含 fields，含 fieldCount）；浏览 Scope 或批量操作时优先使用',
    'client',
    '{"type":"object","properties":{"codePrefix":{"type":"string","description":"code 前缀，如 fmms 或 fmms:logistics"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"page":{"type":"integer"},"size":{"type":"integer","description":"默认 500，最大 500"}}}'::jsonb,
    E'## bizdata_list_entity_summaries\n\n**浏览 Scope、批量改 code、选型时优先使用**（响应小，不含 fields）。\n\n返回：`id`、`code`、`label`、`entityKind`、`tableName`、`status`、`version`、`fieldCount`、`modelValidated`。\n\n需要字段详情时再调 **`bizdata_get_entity`**（传 entityCode）。\n\n可选 `codePrefix`、`entityKind`、`page`、`size` 过滤/分页。',
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
    description = '列出业务数据实体（含完整 fields，数据量大时响应冗长）；浏览请优先 bizdata_list_entity_summaries',
    review_markdown = E'## bizdata_list_entities\n\n返回**含完整 fields** 的实体列表，实体多或字段多时会非常冗长。\n\n**浏览 Scope、批量操作、改 code 验证**请优先 **`bizdata_list_entity_summaries`**；需要某实体字段详情时用 **`bizdata_get_entity`**。\n\n可选 `codePrefix`、`entityKind` 过滤。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_list_entities';

UPDATE aibase.skills
SET
    content_markdown = REPLACE(
        content_markdown,
        'list_entities → 逐个 rename_entity_code → 再 list 验证',
        'list_entity_summaries → 逐个 rename_entity_code → 再 list_entity_summaries 验证'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown LIKE '%list_entities → 逐个 rename_entity_code%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown || E'\n\n## 实体列表 Tool 选用\n- **浏览 / 批量 / Scope 调整**：优先 **`bizdata_list_entity_summaries`**（不含 fields，含 fieldCount）\n- **单实体字段详情**：`bizdata_get_entity`（传 entityCode）\n- **`bizdata_list_entities`**：仅当确实需要一次性拉取全部 fields 时使用',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%bizdata_list_entity_summaries%';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 1
FROM aibase.skills s
JOIN aibase.tools t ON t.function_name = 'bizdata_list_entity_summaries'
WHERE s.slug = 'bizdata-model-design'
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
JOIN aibase.tools t ON t.function_name = 'bizdata_list_entity_summaries'
WHERE s.slug IN ('bizdata-materialization', 'bizdata-api-service-create', 'bizdata-api-service-manage', 'bizdata-metrics', 'api-services-collection-pipeline')
ON CONFLICT DO NOTHING;
