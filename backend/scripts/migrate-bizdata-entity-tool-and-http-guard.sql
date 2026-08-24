-- 实测1 / MS4：bizdata_entity 读收敛 Tool 入库并授权给 bizdata-model-design
-- 幂等：已存在则跳过

INSERT INTO aibase.tools (
  id, scope_id, name, slug, function_name, description, execution_type,
  parameters_schema, review_markdown, server_config, is_active, created_at, updated_at
)
SELECT
  '66666666-6666-4666-8666-666666666650',
  '55555555-5555-4555-8555-555555555501',
  '业务实体（读）',
  'bizdata-entity',
  'bizdata_entity',
  '业务实体资源读操作。action=list 列出摘要；action=get 取详情。写操作仍用 create/update/delete 等显式动词。',
  'client',
  '{"type":"object","required":["action"],"properties":{"action":{"type":"string","enum":["list","get"]},"codePrefix":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"page":{"type":"integer"},"size":{"type":"integer"},"entityId":{"type":"string"},"entityCode":{"type":"string"}}}'::jsonb,
  '## bizdata_entity

优先使用本 Tool 读实体。list 对应 summaries；get 对应详情。
REST 前缀为 `/api/v1/business-data`，禁止用 http_request 猜 `/api/v1/bizdata`。',
  '{}'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM aibase.tools WHERE function_name = 'bizdata_entity'
);

INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT
  'c0a1b2d3-e4f5-4678-89ab-cdef01234567',
  '77777777-7777-4777-8777-777777777701',
  t.id,
  0
FROM aibase.tools t
WHERE t.function_name = 'bizdata_entity'
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_tools st
    WHERE st.skill_id = '77777777-7777-4777-8777-777777777701'
      AND st.tool_id = t.id
  );

-- 建模 Skill 正文追加硬约束（仅当尚未包含时）
UPDATE aibase.skills
SET
  content_markdown = content_markdown || E'\n\n## 硬约束（实测加固）\n- 列举/查询实体与枚举必须用 `bizdata_list_entity_summaries` / `bizdata_list_enums` / `bizdata_entity`，**禁止**用 `http_request` 访问 `/api/v1/bizdata/*`（正确 REST 前缀是 `/api/v1/business-data`）。\n',
  updated_at = NOW()
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%禁止**用 `http_request` 访问 `/api/v1/bizdata%';
