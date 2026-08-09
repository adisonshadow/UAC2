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
        '创建或更新采集管道并持久化（含脚本）。suggest_scripts 仅草稿不能代替；成功须 verified=true',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"scopeCode":{"type":"string"},"pipelineSlug":{"type":"string"},"name":{"type":"string"},"protocolType":{"type":"string","enum":["serial","modbus_rtu","modbus_tcp"]},"entityId":{"type":"string"},"sampleData":{"type":"string"},"targetStructure":{"type":"string"},"parseScript":{"type":"string"},"storeScript":{"type":"string"},"restrictSources":{"type":"boolean"},"applicationIds":{"type":"array","items":{"type":"string"}}}}'::jsonb,
        E'## collection_pipeline_upsert\n\n**唯一**持久化管道配置/脚本的 Tool。\n\n### 参数\n- 有 pipelineId → 更新；否则创建（须 scopeCode + pipelineSlug → code）\n- parseScript / storeScript：写入数据库，供 run_test / ingest 使用\n\n### 脚本契约（纯 JS；禁止未声明标识符）\n```javascript\nfunction parse(raw, ctx) {\n  // 仅可用 raw、ctx（protocolType/pipeline/entity）\n  // 禁止全局 channel/val/idx\n  return { field1: 1 };\n}\nasync function store(data, ctx) {\n  const { queryPg, tableQualified } = ctx;\n  const rows = await queryPg(\n    `INSERT INTO ${tableQualified} (id, col1) VALUES (gen_random_uuid(), $1) RETURNING id`,\n    [data.field1],\n  );\n  return { insertedId: rows[0]?.id };\n}\n```\n- 禁止 store(ctx, data)；禁止 ctx.bizdata\n\n### 成功判定\n- verified===true 且 listedOk；列表 `/api_services/collection-pipelines`，左侧选域如 fmms\n- 禁止未 verified 声称创建完成',
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
        '执行测试（读库内已持久化脚本）。须先 upsert；仅 suggest 不会生效',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"code":{"type":"string"},"rawInput":{"type":"string"},"runType":{"type":"string","enum":["test","ai_test"]}}}'::jsonb,
        E'## collection_pipeline_run_test\n\n- 执行的是**数据库中**的 parseScript/storeScript\n- 若刚 suggest_scripts 未 upsert，测到的是旧脚本\n- rawInput 省略时用 sampleData；rolledBack 表示存储已回滚\n- 失败返回 success=false 与 error（如 ReferenceError: xxx is not defined = 脚本用了未声明变量）',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666658',
        '55555555-5555-4555-8555-555555555501',
        '写入脚本草稿',
        'collection-pipeline-suggest-scripts',
        'collection_pipeline_suggest_scripts',
        '仅同步草稿到编辑页（不写库）。测试前必须 upsert 持久化',
        'client',
        '{"type":"object","properties":{"pipelineId":{"type":"string"},"parseScript":{"type":"string"},"storeScript":{"type":"string"},"targetStructure":{"type":"string"}},"required":["parseScript","storeScript"]}'::jsonb,
        E'## collection_pipeline_suggest_scripts\n\n**不持久化**。只 mutation 到 create/edit 表单。\n\n返回 persisted=false。下一步必须 `collection_pipeline_upsert` 带上同一 parseScript/storeScript，再 `run_test`。\n\n### 脚本契约\n- parse(raw, ctx) → 对象\n- store(data, ctx) 用 ctx.queryPg、ctx.tableQualified\n- 禁止 store(ctx, data)；禁止 ctx.bizdata；禁止未声明变量',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666659',
        '55555555-5555-4555-8555-555555555501',
        '采集管道页面跳转',
        'collection-pipeline-navigate',
        'collection_pipeline_navigate',
        '跳转 list / create / edit / test',
        'client',
        '{"type":"object","properties":{"target":{"type":"string","enum":["list","create","edit","test"]},"pipelineId":{"type":"string"}},"required":["target"]}'::jsonb,
        E'## collection_pipeline_navigate\n\n前缀 `/api_services/collection-pipelines`：\n- list / create / edit / test\n- 创建成功后应 navigate list，并说明左侧选域',
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
        '配置采集管道：脚本须 upsert 落库；测试读库；列表在 API 服务菜单',
        E'# 采集数据结构化助手\n\n路径：**API 服务 → 采集数据结构化** `/api_services/collection-pipelines`（不在「业务数据」下）。\n\n## 硬规则（最高优先级）\n1. `collection_pipeline_suggest_scripts` = **仅编辑页草稿**（persisted=false）\n2. `collection_pipeline_run_test` = 执行**库里**的脚本；只 suggest 未 upsert → 测到旧脚本或空脚本\n3. 改脚本正确顺序：写脚本 → **`collection_pipeline_upsert`** → `run_test`\n4. 声称创建成功前：upsert 信封 `verified===true` / `listedOk`，并 `navigate list`\n5. 列表左侧按 code 域过滤；code=`fmms:digital_measure` 须选 **fmms** 或「全部」才能看见\n\n## Surface\n- list / create / edit / test：`bizdata.collection-pipelines.*` / `bizdata.collection-pipeline.*`\n- 先 `aibase_read_surfaces`，禁止向用户索要 pipelineId\n\n## ctx 与脚本（常见 ReferenceError 根因）\n- parse(raw, ctx)：只有 raw、ctx\n- store(data, ctx)：只有 data、ctx\n- ctx 字段：protocolType、pipeline、entity、tableQualified、queryPg\n- **没有**全局 channel / val / idx；须 `const`/`let` 自行声明\n- 禁止 ctx.bizdata；store 签名必须 store(data, ctx)\n\n## 推荐工作流\n1. read_surfaces\n2. list_entity_summaries / get_entity（确认已物化）\n3. **upsert**（一次带上 name/protocol/entityId/sampleData/parseScript/storeScript）\n4. 确认 verified → navigate list\n5. （可选）run_test；失败则根据 error 改脚本再 upsert 再测\n6. publish\n\n## 禁止\n- 未 upsert 就 run_test 并声称脚本已更新\n- 未 verified / 未 list 回读就声称「创建完成」\n- 把草稿 suggest 当成落库',
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
    'bizdata_list_entity_summaries'
  )
ON CONFLICT (skill_id, tool_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
