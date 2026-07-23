-- 增量：bizdata_query_relation_graph — 关系图谱查询 Tool（支持 scope）
-- 绑定到 bizdata-model-design Skill

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666643',
        '55555555-5555-4555-8555-555555555501',
        '查询关系图谱',
        'bizdata-query-relation-graph',
        'bizdata_query_relation_graph',
        '查询实体关系图谱（节点+边）；可传 scope（一级 Scope）或 codePrefix；含 orphan 实体',
        'client',
        '{"type":"object","properties":{"scope":{"type":"string","description":"一级 Scope（code 第一段），如 IPS、fmms；不传则全库"},"codePrefix":{"type":"string","description":"更细 code 前缀，如 IPS:bom；可与 scope 同时用"}}}'::jsonb,
        E'## bizdata_query_relation_graph\n\n总览某 Scope 下实体关系（与「关系图谱」页过滤一致）。\n\n### 参数\n- **scope**：一级 Scope（code 第一段），如 `IPS`、`fmms`\n- **codePrefix**：可选更细前缀，如 `IPS:bom`（与 scope 同时传时取交集）\n\n### 返回\n- `nodes` / `edges`（含 cardinality、directionSummary）\n- `orphanNodes`：无关系边的实体（建模缺口）\n- `availableScopes`：当前库已有一级 Scope\n\n### 何时用\n- 添加关系前先摸清现有边与缺口\n- 用户问「某 Scope 关系是否完整」时优先本 Tool（比全量 list_relations 更适合总览）',
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
SELECT s.id, t.id, 55
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_query_relation_graph'
ON CONFLICT DO NOTHING;

-- 在 Skill 文案中补充图谱 Tool（若尚未包含）
UPDATE aibase.skills SET
    content_markdown = REPLACE(
      content_markdown,
      E'## 实体列表 Tool 选用\n- **浏览 / 批量 / Scope 调整**：优先 **`bizdata_list_entity_summaries`**（不含 fields，含 fieldCount）\n- **单实体字段详情**：`bizdata_get_entity`（传 entityCode）',
      E'## 实体列表 Tool 选用\n- **浏览 / 批量 / Scope 调整**：优先 **`bizdata_list_entity_summaries`**（不含 fields，含 fieldCount）\n- **关系图谱总览**：`bizdata_query_relation_graph`（传 `scope` 如 IPS，与关系图谱页一致；看 nodes/edges/orphanNodes）\n- **单实体字段详情**：`bizdata_get_entity`（传 entityCode）'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%bizdata_query_relation_graph%';
