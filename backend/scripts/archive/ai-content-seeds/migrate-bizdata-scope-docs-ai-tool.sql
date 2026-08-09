-- 增量：Scope 业务说明 Tool + Skill 指引（bizdata-model-design）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666644',
        '55555555-5555-4555-8555-555555555501',
        '读取 Scope 业务说明',
        'bizdata-get-scope-description',
        'bizdata_get_scope_description',
        '读取 Scope 业务说明（Markdown）及祖先链有内容的说明；对某 Scope 建模前应先调用',
        'client',
        '{"type":"object","properties":{"scopeCode":{"type":"string","description":"Scope code，如 IPS 或 IPS:bom"}},"required":["scopeCode"]}'::jsonb,
        E'## bizdata_get_scope_description\n\n读取 Scope 级业务说明（类似 Skill 的领域知识，不是字段 DDL）。\n\n### 参数\n- **scopeCode**：与模型树 Scope 节点一致，如 `IPS`、`IPS:bom`\n\n### 返回\n- `contentMarkdown`：本 Scope 正文（可空）\n- `ancestors`：祖先链上**有内容**的说明（由近及远）\n\n### 何时用\n- 对某 Scope 下实体做设计/补齐前，**优先**调用本 Tool\n- Surface `scopeDocsSummary` 可提示哪些 Scope 已有说明',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666645',
        '55555555-5555-4555-8555-555555555501',
        '写入 Scope 业务说明',
        'bizdata-upsert-scope-description',
        'bizdata_upsert_scope_description',
        '写入/更新 Scope 业务说明；合并已有内容，禁止无故清空；空字符串删除',
        'client',
        '{"type":"object","properties":{"scopeCode":{"type":"string","description":"Scope code，如 IPS 或 IPS:bom"},"contentMarkdown":{"type":"string","description":"完整 Markdown；空字符串删除"}},"required":["scopeCode","contentMarkdown"]}'::jsonb,
        E'## bizdata_upsert_scope_description\n\n沉淀该 Scope 的**稳定领域知识**，供后续建模复用。\n\n### 应写入（重要信息）\n- 业务目标、边界与术语表\n- 关键业务规则/约束（状态机、编号规则、权限边界等）\n- 实体职责划分与建模约定（哪些该建表、哪些不该）\n- 与上下游 Scope / 外部系统的关系说明\n\n### 不应写入\n- 具体字段类型/长度、索引明细（仍落实体模型）\n- 临时调试笔记\n\n### 写法\n- 先 `bizdata_get_scope_description`，在已有正文上**合并**更新，禁止无故整篇覆盖清空\n- 传空 `contentMarkdown` 会删除该 Scope 说明\n- 以 `_verification.verified=true` 为准',
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
SELECT s.id, t.id, 12
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_get_scope_description'
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 13
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'bizdata_upsert_scope_description'
ON CONFLICT DO NOTHING;

-- Skill 文案：补充 Scope 业务说明指引
UPDATE aibase.skills SET
    content_markdown = REPLACE(
      content_markdown,
      E'## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`、`sales:order:Order`）\n- Enum code：同 Scope 层级 + 枚举名（如 `fmms:production:WorkCardStatus`）\n- Scope 树由实体 code 冒号路径推导，**无独立 create_scope Tool**\n',
      E'## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`、`sales:order:Order`）\n- Enum code：同 Scope 层级 + 枚举名（如 `fmms:production:WorkCardStatus`）\n- Scope 树由实体 code 冒号路径推导，**无独立 create_scope Tool**\n\n## Scope 业务说明（领域知识）\n- 任意 Scope 节点（如 `IPS`、`IPS:bom`）可有一份 Markdown 业务说明，类似 Skill 描述\n- **建模前**：对目标 Scope 优先 `bizdata_get_scope_description`（含祖先链有内容说明）\n- **应写入**（`bizdata_upsert_scope_description`）：业务目标/边界、术语表、关键规则与约束、实体职责划分、与上下游关系\n- **不应写入**：字段类型/长度、索引明细、临时笔记\n- 发现稳定领域规则时写入；先 get 再合并更新，禁止无故清空\n'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%bizdata_get_scope_description%';

UPDATE aibase.skills SET
    content_markdown = REPLACE(
      content_markdown,
      E'## 实体列表 Tool 选用\n- **浏览 / 批量 / Scope 调整**：优先 **`bizdata_list_entity_summaries`**（不含 fields，含 fieldCount）\n- **关系图谱总览**：`bizdata_query_relation_graph`（传 `scope` 如 IPS，与关系图谱页一致；看 nodes/edges/orphanNodes）\n- **单实体字段详情**：`bizdata_get_entity`（传 entityCode）\n',
      E'## 实体列表 Tool 选用\n- **浏览 / 批量 / Scope 调整**：优先 **`bizdata_list_entity_summaries`**（不含 fields，含 fieldCount）\n- **Scope 业务说明**：`bizdata_get_scope_description` / `bizdata_upsert_scope_description`\n- **关系图谱总览**：`bizdata_query_relation_graph`（传 `scope` 如 IPS，与关系图谱页一致；看 nodes/edges/orphanNodes）\n- **单实体字段详情**：`bizdata_get_entity`（传 entityCode）\n'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown LIKE '%bizdata_get_scope_description%'
  AND content_markdown NOT LIKE '%Scope 业务说明**：`bizdata_get_scope_description%';
