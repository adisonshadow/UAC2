-- 提交外部API（Outbound Webhook）AI Skill / Tools 种子（挂载 business-data Scope）
-- 前端 client handler 已存在于 registerOutboundWebhookTools.ts，本 seed 补全 DB 层注册，
-- 让 AI 能看到并调用这些 tool。可重复执行（ON CONFLICT 幂等）。
-- 用法：psql -f scripts/migrate-outbound-webhook-ai-seed.sql

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666680',
        '55555555-5555-4555-8555-555555555501',
        '列出提交外部API',
        'outbound-webhook-list',
        'outbound_webhook_list',
        '列出提交外部API配置，可按 code 前缀与状态过滤',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"status":{"type":"string","enum":["draft","published","disabled","ALL"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## outbound_webhook_list\n\n返回 { items, total }。size=-1 拉取全部。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666681',
        '55555555-5555-4555-8555-555555555501',
        '过滤提交外部API',
        'outbound-webhook-filter',
        'outbound_webhook_filter',
        '按页面过滤项检索提交外部API：code 前缀 + 状态，返回全部命中项（size=-1）。与 list 区别：面向检索而非分页浏览。',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string","description":"code 前缀"},"status":{"type":"string","enum":["draft","published","disabled"]}}}'::jsonb,
        E'## outbound_webhook_filter\n\n参数全可选；不传则返回全部。返回 { items, total }。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666682',
        '55555555-5555-4555-8555-555555555501',
        '获取提交外部API详情',
        'outbound-webhook-get',
        'outbound_webhook_get',
        '按 webhookId 获取提交外部API详情',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_get\n\n含 requestStructure、transformScript、mockData 等。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666683',
        '55555555-5555-4555-8555-555555555501',
        '创建提交外部API',
        'outbound-webhook-create',
        'outbound_webhook_create',
        '创建提交外部API配置（新建，不传 webhookId）',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"targetUrl":{"type":"string"},"triggerApiServiceId":{"type":"string"},"triggerApiServiceCode":{"type":"string"},"requestStructure":{"type":"string"},"transformScript":{"type":"string"},"mockData":{"type":"string"}},"required":["name","targetUrl"]}'::jsonb,
        E'## outbound_webhook_create\n\n- 须传 name、targetUrl\n- code 格式 `域:slug`（如 equipment:notify）\n- 创建后状态为 draft，须 outbound_webhook_publish 发布',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666684',
        '55555555-5555-4555-8555-555555555501',
        '更新提交外部API',
        'outbound-webhook-update',
        'outbound_webhook_update',
        '更新已有提交外部API配置（必传 webhookId）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"},"code":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"targetUrl":{"type":"string"},"triggerApiServiceId":{"type":"string"},"triggerApiServiceCode":{"type":"string"},"requestStructure":{"type":"string"},"transformScript":{"type":"string"},"mockData":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_update\n\n- 必传 webhookId\n- 仅传需改动的字段即可',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666685',
        '55555555-5555-4555-8555-555555555501',
        '创建或更新提交外部API',
        'outbound-webhook-upsert',
        'outbound_webhook_upsert',
        '创建或更新提交外部API配置（有 webhookId 更新，无则创建；向后兼容）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string","description":"更新时传入；创建时省略"},"code":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"targetUrl":{"type":"string"},"triggerApiServiceId":{"type":"string"},"triggerApiServiceCode":{"type":"string"},"requestStructure":{"type":"string"},"transformScript":{"type":"string"},"mockData":{"type":"string"}},"required":["name","targetUrl"]}'::jsonb,
        E'## outbound_webhook_upsert\n\n- 有 webhookId 则更新，否则创建（与 create/update 等价，保留向后兼容）',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666686',
        '55555555-5555-4555-8555-555555555501',
        '删除提交外部API',
        'outbound-webhook-delete',
        'outbound_webhook_delete',
        '删除提交外部API配置',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_delete',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666687',
        '55555555-5555-4555-8555-555555555501',
        '发布提交外部API',
        'outbound-webhook-publish',
        'outbound_webhook_publish',
        '发布提交外部API（draft → published）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_publish\n\n发布前置：须已配置 targetUrl、triggerApiServiceId、transformScript',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666688',
        '55555555-5555-4555-8555-555555555501',
        '禁用提交外部API',
        'outbound-webhook-disable',
        'outbound_webhook_disable',
        '禁用提交外部API（published → disabled）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_disable',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666689',
        '55555555-5555-4555-8555-555555555501',
        '获取提交外部API测试配置',
        'outbound-webhook-get-test-profile',
        'outbound_webhook_get_test_profile',
        '获取测试配置（含 mockData、请求结构、触发 API 信息）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_get_test_profile',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666668a',
        '55555555-5555-4555-8555-555555555501',
        '运行提交外部API测试',
        'outbound-webhook-run-test',
        'outbound_webhook_run_test',
        '用 Mock Data 运行处置脚本并真实 POST 外部 API',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"},"mockData":{"type":"string"}},"required":["webhookId"]}'::jsonb,
        E'## outbound_webhook_run_test\n\n- 用 mockData（可选覆盖）运行 transform 脚本并真实 POST targetUrl\n- 返回 responseStatus、responseBody、transformedBody、status',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666668b',
        '55555555-5555-4555-8555-555555555501',
        '设置提交外部API Mock Data',
        'outbound-webhook-set-mock-data',
        'outbound_webhook_set_mock_data',
        '将 Mock Data 写入当前编辑/测试页（通过 mutation 同步，不持久化）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"},"mockData":{"type":"string"}},"required":["mockData"]}'::jsonb,
        E'## outbound_webhook_set_mock_data\n\n通过 mutation 同步到编辑器；用户仍须保存表单或调用 create/update 持久化。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666668c',
        '55555555-5555-4555-8555-555555555501',
        '建议提交外部API脚本',
        'outbound-webhook-suggest-scripts',
        'outbound_webhook_suggest_scripts',
        '将请求结构、处置脚本和 Mock Data 草稿写入当前编辑页（通过 mutation 同步，不持久化）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"},"requestStructure":{"type":"string"},"transformScript":{"type":"string"},"mockData":{"type":"string"}},"required":["transformScript"]}'::jsonb,
        E'## outbound_webhook_suggest_scripts\n\n通过 mutation 同步到编辑器；用户仍须保存表单或调用 create/update 持久化。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666668d',
        '55555555-5555-4555-8555-555555555501',
        '提交外部API页面跳转',
        'outbound-webhook-navigate',
        'outbound_webhook_navigate',
        '导航到提交外部API页面（列表/编辑/测试/创建）',
        'client',
        '{"type":"object","properties":{"webhookId":{"type":"string"},"target":{"type":"string","enum":["list","edit","test","create"]}}}'::jsonb,
        E'## outbound_webhook_navigate\n\n页面路径前缀 `/api_services/outbound-webhooks`：\n- list → 列表\n- create → 新建\n- edit → /{id}/edit\n- test → /{id}/test',
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

-- Skill：提交外部API管理（专用 dedicated Skill）
INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_global, is_dedicated, is_active)
VALUES
    (
        '77777777-7777-4777-8777-777777777707',
        '55555555-5555-4555-8555-555555555501',
        '提交外部API管理',
        'outbound-webhook-manage',
        '管理提交外部API（Outbound Webhook）：配置触发、处置脚本、测试与发布',
        E'# 提交外部API管理助手\n\n你是 EADAF 提交外部API助手，帮助用户在 **API 服务 → 提交外部API**（路径 `/api_services/outbound-webhooks`）配置 Outbound Webhook。\n\n业务 API 被调用成功后，按绑定关系触发对应 webhook：运行 transform 脚本 → POST 到 targetUrl，并记录 run。\n\n## 页面与 Surface\n- 列表：surfaceId=`api-services.outbound-webhooks.list`\n- 新建/编辑：surfaceId=`api-services.outbound-webhooks.create` / `.edit`\n- 测试：surfaceId=`api-services.outbound-webhooks.test`\n- 先用 `aibase_read_surfaces` 读取当前页，禁止向用户索要 webhookId\n\n## 字段\n- code：`域:slug`（如 equipment:notify），唯一\n- name / description\n- targetUrl：外部 API 地址（POST JSON）\n- triggerApiServiceId：绑定的业务 API（须已发布）\n- requestStructure：触发数据的 TypeScript interface\n- transformScript：`export function transform(data, ctx)` → 转换为 POST body\n- mockData：测试用 JSON\n\n## 工作流程\n1. `aibase_read_surfaces` 读当前页\n2. `outbound_webhook_list` / `outbound_webhook_filter` 了解现状\n3. `outbound_webhook_create`（新建）或 `outbound_webhook_update`（改已有）保存配置\n4. `outbound_webhook_suggest_scripts` 写入 AI 生成的 transform 脚本草稿\n5. `outbound_webhook_run_test` 用 mockData 测试（真实 POST）\n6. `outbound_webhook_publish` 发布（须 targetUrl + triggerApiServiceId + transformScript）\n\n## transform 脚本契约\n- 第一参数 data = 业务 API 调用结果；第二参数 ctx\n- 返回值作为 POST body 发送到 targetUrl\n\n## 成功判定（必须）\n- **禁止**未调用 Tool 就声称创建/发布/测试成功\n- 创建/更新：返回含 webhook id\n- 测试：`status=success`\n- 发布：返回 status=published',
        false,
        true,
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 关联 Skill 与 Tools
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'outbound-webhook-manage'
  AND t.function_name IN (
    'aibase_read_surfaces',
    'outbound_webhook_list',
    'outbound_webhook_filter',
    'outbound_webhook_get',
    'outbound_webhook_create',
    'outbound_webhook_update',
    'outbound_webhook_upsert',
    'outbound_webhook_delete',
    'outbound_webhook_publish',
    'outbound_webhook_disable',
    'outbound_webhook_get_test_profile',
    'outbound_webhook_run_test',
    'outbound_webhook_set_mock_data',
    'outbound_webhook_suggest_scripts',
    'outbound_webhook_navigate',
    'apiservice_list_services'
  )
ON CONFLICT DO NOTHING;
