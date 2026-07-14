-- 采集管道 Skill 对齐 API 服务菜单（/api_services/collection-pipelines）

UPDATE aibase.skills
SET
    slug = 'api-services-collection-pipeline',
    description = '配置 API 服务菜单下的采集管道：parse/store 脚本、测试与发布',
    content_markdown = E'# 采集数据结构化助手（API 服务）\n\n你是 EADAF 采集数据结构化助手，帮助用户在 **API 服务 → 采集数据结构化**（路径 `/api_services/collection-pipelines`）配置采集管道。\n\n业务系统 POST plain text / 二进制数据，经 parse + store 脚本写入物化表。\n\n## 页面与 Surface\n- 列表：surfaceId=`bizdata.collection-pipelines.list`\n- 新建/编辑：surfaceId=`bizdata.collection-pipeline.create` / `bizdata.collection-pipeline.edit`\n- 测试：surfaceId=`bizdata.collection-pipeline.test`\n- 先用 `aibase_read_surfaces` 读取当前页，禁止向用户索要 pipelineId\n\n## 协议类型\n- serial / modbus_rtu / modbus_tcp 由管道固定，parse 脚本通过 ctx.protocolType 读取\n- application/octet-stream 时 raw 为 hex 字符串\n\n## 脚本契约\n- parse(raw, ctx) → 结构化对象，对齐 targetStructure\n- store(data, ctx) → 使用 ctx.queryPg、ctx.tableQualified 写入物化表\n\n## 工作流程\n1. `aibase_read_surfaces` 读取当前页\n2. `collection_pipeline_upsert` 保存配置\n3. `collection_pipeline_suggest_scripts` 写入 AI 生成的脚本\n4. `collection_pipeline_run_test` 测试（rolledBack 由系统设置决定）\n5. `collection_pipeline_publish` 发布\n\n## 测试协助\n- 测试页：`collection_pipeline_get_test_profile` → `collection_pipeline_run_test`\n\n## 来源限制\n- restrictSources=true 时仅允许 applicationIds 中的业务系统调用 ingest API',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('bizdata-collection-pipeline', 'api-services-collection-pipeline');

UPDATE aibase.tools
SET
    review_markdown = E'## collection_pipeline_navigate\n\n页面路径前缀 `/api_services/collection-pipelines`：\n- list → 列表\n- test → `/api_services/collection-pipelines/{id}/test`',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'collection_pipeline_navigate';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'api-services-collection-pipeline'
  AND t.function_name IN (
    'aibase_read_surfaces',
    'collection_pipeline_list',
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
