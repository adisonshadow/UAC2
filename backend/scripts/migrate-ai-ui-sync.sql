-- 增量：AI Tool UI 联动 — 更新 Skill/Tool 说明与 aibase_read_surfaces
-- 用法：psql -f scripts/migrate-ai-ui-sync.sql

-- bizdata_update_entity：扩展 parameters_schema 与 review_markdown
UPDATE aibase.tools
SET
  parameters_schema = '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"label":{"type":"string"},"replaceFields":{"type":"boolean"},"layout":{"type":"object","description":"实体 layout，含 indexes 等"},"jsonSchema":{"type":"object","description":"JSON Schema 结构"},"fields":{"type":"array","items":{"type":"object","properties":{"fieldKey":{"type":"string"},"name":{"type":"string"},"label":{"type":"string"},"type":{"type":"string"},"length":{"type":"integer"},"nullable":{"type":"boolean"},"unique":{"type":"boolean"},"primary":{"type":"boolean"},"columnInfo":{"type":"object"},"typeormConfig":{"type":"object"}}}}}}'::jsonb,
  review_markdown = E'## bizdata_update_entity\n\n保存后 version 自增，**页面 UI 会自动同步**，无需用户手动刷新。\n\n### 定位实体\n- entityId 或 entityCode（如 sale:customer）二选一\n\n### 字段格式\n每项至少提供 fieldKey 或 name：\n```json\n{ "name": "company_name", "label": "公司名称", "type": "varchar", "length": 255, "nullable": false }\n```\n\n### layout / jsonSchema\n- `layout.indexes`：索引配置\n- `jsonSchema`：json_schema 类型实体的结构\n\n### 合并策略\n- 默认 merge：只传新增/修改字段，保留已有字段\n- replaceFields=true：全量替换\n\n### 页面上下文\n- 可用 `aibase_read_surfaces` 读取当前选中实体等页面状态',
  updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_update_entity';

UPDATE aibase.skills
SET content_markdown = E'# 业务数据模型设计助手\n\n你是 EADAF 业务数据建模助手。\n\n## 编码规范\n- Entity code 格式：`Scope1[:Scope2...]:EntityName`\n- Scope 可以是 1~N 级\n- `er_table`：关系型表；`json_schema`：JSON 结构文档\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取当前页面选中实体、实体数量等\n- 用户也可能通过 Chat 引用附加实体/字段上下文\n\n## 工作流程\n1. 用 `aibase_read_surfaces` 或 `bizdata_list_entities` 了解现状\n2. 用 `bizdata_create_entity` / `bizdata_update_entity` 创建或修改\n3. 用 `bizdata_add_relation` 建立关系\n4. 用 `bizdata_validate_model` 校验\n5. 重大变更后用 `bizdata_get_entity` 核对 version\n\n## 字段更新（bizdata_update_entity）\n- 用 entityCode（如 sale:customer）或 entityId 定位实体\n- 字段用 fieldKey 或 name，type/label 可写顶层\n- 支持 layout.indexes、jsonSchema\n- 默认 merge 已有字段，只传新增/修改项；勿反复询问用户确认\n\n## UI 同步\n- 写操作成功后前端会自动刷新模型设计页，**不要**提示用户手动刷新页面\n\n## 注意\n- 每次保存 entity version 会 +1\n- 已锁定实体不可修改',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design';

UPDATE aibase.skills
SET content_markdown = E'# AI 能力设计助手\n\n你是 EADAF AI 管理能力设计助手，帮助管理员规划并创建 Scope、Tool、Skill。\n\n## 概念\n- **Scope**：能力域，slug 为 Scope ID（如 `business-data`、`ai-management`）\n- **Tool**：可调用函数，functionName 全局唯一（snake_case）\n- **Skill**：系统提示与 Tool 组合，slug 为 Skill ID\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取当前页面表单/列表状态\n\n## 设计流程\n1. `aibase_read_surfaces` 或 `aibase_list_*` 了解现状\n2. 缺 Scope 时 `aibase_create_scope`\n3. 设计 Tool：`executionType` 选 client（前端注册）或 server_builtin（后端 handler）\n4. 设计 Skill：编写 contentMarkdown 指令，用 toolIds 关联 Tool\n\n## UI 同步\n- 写操作成功后列表/表单页会自动刷新，**不要**提示用户手动刷新\n\n## 注意\n- slug / functionName 创建后谨慎修改\n- 先预览再创建，避免重复',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'aibase-capability-design';

UPDATE aibase.skills
SET content_markdown = E'# AI 能力管理助手\n\n你是 EADAF AI 管理能力维护助手，帮助管理员查看和维护已有配置。\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取当前页面表单/列表状态\n\n## 常用操作\n1. `aibase_read_surfaces` 或 `aibase_list_*` 浏览列表\n2. `aibase_get_*` 查看详情\n3. `aibase_update_*` 修改描述、参数、指令内容、关联关系\n\n## UI 同步\n- 写操作成功后列表/表单页会自动刷新，**不要**提示用户手动刷新\n\n## 注意\n- 修改前先用 get 接口确认当前配置\n- 批量变更前先向用户确认影响范围',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'aibase-capability-manage';

-- aibase_read_surfaces（client Tool，handler 由 ai-base 内置注册）
INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES (
    '77777777-7777-4777-8777-777777777701',
    '88888888-8888-4888-8888-888888888801',
    '读取页面 Surface',
    'aibase-read-surfaces',
    'aibase_read_surfaces',
    '读取当前页面已注册的 AI Surface 快照',
    'client',
    '{"type":"object","properties":{"domain":{"type":"string"},"surfaceId":{"type":"string"}}}'::jsonb,
    E'## aibase_read_surfaces\n\n返回当前页面注册的 Surface 列表（选中实体、表单值等）。\n\n可选过滤：\n- domain：如 bizdata、aibase\n- surfaceId：如 bizdata.model-designer',
    '{}'::jsonb,
    true
)
ON CONFLICT (function_name) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug IN ('aibase-capability-design', 'aibase-capability-manage', 'bizdata-model-design')
  AND t.function_name = 'aibase_read_surfaces'
ON CONFLICT DO NOTHING;
