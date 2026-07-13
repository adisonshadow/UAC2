-- 采集管道 AI Skills / Tools 种子（挂载 business-data Scope）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666650',
        '55555555-5555-4555-8555-555555555501',
        '列出采集管道',
        'collection-pipeline-list',
        'collection_pipeline_list',
        '列出采集管道，可按 code 前缀、状态、协议类型过滤',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"status":{"type":"string","enum":["draft","published","disabled"]},"protocolType":{"type":"string","enum":["serial","modbus_rtu","modbus_tcp"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## collection_pipeline_list\n\n返回 items 与 total。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666651',
        '55555555-5555-4555-8555-555555555501',
        '获取采集管道详情',
        'collection-pipeline-get',
        'collection_pipeline_get',
        '按 ID 或 code 获取采集管道详情',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## collection_pipeline_get\n\npipelineId 或 code 二选一；优先从 Surface 读取 pipelineId。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666652',
        '55555555-5555-4555-8555-555555555501',
        '创建或更新采集管道',
        'collection-pipeline-upsert',
        'collection_pipeline_upsert',
        '创建或更新采集管道（样本、目标 interface、解析/存储脚本）',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"scopeCode":{"type":"string"},"pipelineSlug":{"type":"string"},"name":{"type":"string"},"protocolType":{"type":"string","enum":["serial","modbus_rtu","modbus_tcp"]},"entityId":{"type":"string"},"sampleData":{"type":"string"},"targetStructure":{"type":"string"},"parseScript":{"type":"string"},"storeScript":{"type":"string"},"restrictSources":{"type":"boolean"},"applicationIds":{"type":"array","items":{"type":"string"}}}}'::jsonb,
        E'## collection_pipeline_upsert\n\n- 有 pipelineId 则更新，否则创建\n- parse 导出 function parse(raw, ctx)\n- store 导出 async function store(data, ctx)\n- 绑定 entityId 前须已物化',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666653',
        '55555555-5555-4555-8555-555555555501',
        '发布采集管道',
        'collection-pipeline-publish',
        'collection_pipeline_publish',
        '发布 draft 采集管道，对外暴露 ingest API',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## collection_pipeline_publish\n\n发布前须有 parseScript、storeScript 与 entityId。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666654',
        '55555555-5555-4555-8555-555555555501',
        '禁用采集管道',
        'collection-pipeline-disable',
        'collection_pipeline_disable',
        '禁用已发布的采集管道',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## collection_pipeline_disable',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666655',
        '55555555-5555-4555-8555-555555555501',
        '删除采集管道',
        'collection-pipeline-delete',
        'collection_pipeline_delete',
        '软删除采集管道',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## collection_pipeline_delete',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666656',
        '55555555-5555-4555-8555-555555555501',
        '获取采集测试配置',
        'collection-pipeline-get-test-profile',
        'collection_pipeline_get_test_profile',
        '获取样本、脚本、ingest URL 等测试上下文',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## collection_pipeline_get_test_profile\n\n测试页优先从 Surface 读取 pipelineId。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666657',
        '55555555-5555-4555-8555-555555555501',
        '执行采集管道测试',
        'collection-pipeline-run-test',
        'collection_pipeline_run_test',
        '使用 rawInput 执行解析+存储测试（事务回滚）',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"},"rawInput":{"type":"string"},"runType":{"type":"string","enum":["test","ai_test"]}}}'::jsonb,
        E'## collection_pipeline_run_test\n\n- rawInput 省略时使用 sampleData\n- rolledBack=true 表示存储已回滚\n- 失败返回 success=false 与 error',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666658',
        '55555555-5555-4555-8555-555555555501',
        '写入脚本草稿',
        'collection-pipeline-suggest-scripts',
        'collection_pipeline_suggest_scripts',
        '将 AI 生成的 parse/store 脚本同步到编辑页',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"parseScript":{"type":"string"},"storeScript":{"type":"string"},"targetStructure":{"type":"string"}},"required":["parseScript","storeScript"]}'::jsonb,
        E'## collection_pipeline_suggest_scripts\n\n通过 mutation 同步到 edit/create Surface。\n\n### 脚本契约（必须）\n- parse(raw, ctx) → 对象，字段对齐 targetStructure\n- **store(data, ctx)** — 第一参数为 parse 结果，第二参数为 ctx\n- **禁止** `store(ctx, data)` 或 `store(ctx, parsed)` 参数顺序\n- **禁止** `ctx.bizdata.find/create` — 不存在该 API\n- store 须使用 **ctx.queryPg**、**ctx.tableQualified** 写入绑定实体的物化表\n- 物化表 id 列通常无默认值，INSERT 须显式 `gen_random_uuid()` 或传入 UUID',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666659',
        '55555555-5555-4555-8555-555555555501',
        '采集管道页面跳转',
        'collection-pipeline-navigate',
        'collection_pipeline_navigate',
        '在 list / test 页面间跳转',
        'client',
        '{"type":"object","properties":{"target":{"type":"string","enum":["list","test"]},"pipelineId":{"type":"string"}},"required":["target"]}'::jsonb,
        E'## collection_pipeline_navigate\n\n页面路径前缀 `/api_services/collection-pipelines`：\n- list → 列表\n- test → `/api_services/collection-pipelines/{id}/test`',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666665a',
        '55555555-5555-4555-8555-555555555501',
        '过滤采集管道',
        'collection-pipeline-filter',
        'collection_pipeline_filter',
        '按页面过滤项检索采集管道：code 前缀 + 状态 + 协议类型，返回全部命中项（size=-1）。',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string","description":"code 前缀"},"status":{"type":"string","enum":["draft","published","disabled"]},"protocolType":{"type":"string","enum":["serial","modbus_rtu","modbus_tcp"]}}}'::jsonb,
        E'## collection_pipeline_filter\n\n参数全可选；不传则返回全部。返回 { items, total }。',
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

INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_active)
VALUES
    (
        '77777777-7777-4777-8777-777777777710',
        '55555555-5555-4555-8555-555555555501',
        '采集数据结构化',
        'api-services-collection-pipeline',
        '配置 API 服务菜单下的采集管道：parse/store 脚本、测试与发布',
        E'# 采集数据结构化助手（API 服务）\n\n你是 EADAF 采集数据结构化助手，帮助用户在 **API 服务 → 采集数据结构化**（路径 `/api_services/collection-pipelines`）配置采集管道。\n\n业务系统 POST plain text / 二进制数据，经 parse + store 脚本写入物化表。\n\n## 页面与 Surface\n- 列表：surfaceId=`bizdata.collection-pipelines.list`\n- 新建/编辑：surfaceId=`bizdata.collection-pipeline.create` / `bizdata.collection-pipeline.edit`\n- 测试：surfaceId=`bizdata.collection-pipeline.test`\n- 先用 `aibase_read_surfaces` 读取当前页，禁止向用户索要 pipelineId\n\n## 协议类型\n- serial / modbus_rtu / modbus_tcp 由管道固定，parse 脚本通过 ctx.protocolType 读取\n- application/octet-stream 时 raw 为 hex 字符串\n\n## 脚本契约\n- parse(raw, ctx) → 结构化对象，对齐 targetStructure\n- store(data, ctx) → 使用 ctx.queryPg、ctx.tableQualified 写入物化表\n\n## 工作流程\n1. `aibase_read_surfaces` 读取当前页\n2. `collection_pipeline_upsert` 保存配置\n3. `collection_pipeline_suggest_scripts` 写入 AI 生成的脚本\n4. `collection_pipeline_run_test` 测试（rolledBack 由系统设置决定）\n5. `collection_pipeline_publish` 发布\n\n## 测试协助\n- 测试页：`collection_pipeline_get_test_profile` → `collection_pipeline_run_test`\n\n## 来源限制\n- restrictSources=true 时仅允许 applicationIds 中的业务系统调用 ingest API',
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
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'api-services-collection-pipeline'
  AND t.function_name IN (
    'aibase_read_surfaces',
    'collection_pipeline_list',
    'collection_pipeline_filter',
    'collection_pipeline_get',
    'collection_pipeline_upsert',
    'collection_pipeline_publish',
    'collection_pipeline_disable',
    'collection_pipeline_delete',
    'collection_pipeline_get_test_profile',
    'collection_pipeline_run_test',
    'collection_pipeline_suggest_scripts',
    'collection_pipeline_navigate',
    'bizdata_get_entity',
    'bizdata_list_entities'
  )
ON CONFLICT (skill_id, tool_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
