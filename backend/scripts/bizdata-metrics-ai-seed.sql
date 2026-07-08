-- 业务指标 AI Skills / Tools 种子（business-data Scope）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666660',
        '55555555-5555-4555-8555-555555555501',
        '列出业务指标',
        'bizdata-metric-list',
        'bizdata_metric_list',
        '列出指标，可按 code 前缀与状态过滤',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_metric_list\n\n返回 items 与 total；code 形如 sales:order:total_count。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666661',
        '55555555-5555-4555-8555-555555555501',
        '获取指标详情',
        'bizdata-metric-get',
        'bizdata_metric_get',
        '按 metricId 或 code 获取指标详情',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_get\n\n优先从 Surface 读取 metricId；含 queryScript、formulaConfig、调度信息。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666662',
        '55555555-5555-4555-8555-555555555501',
        '创建或更新指标',
        'bizdata-metric-upsert',
        'bizdata_metric_upsert',
        '创建或更新 SQL / 公式指标',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"},"label":{"type":"string"},"description":{"type":"string"},"metricType":{"type":"string","enum":["sql","formula"]},"connectionId":{"type":"string"},"queryScript":{"type":"string"},"formulaConfig":{"type":"object"},"computeMode":{"type":"string","enum":["scheduled","on_demand","both"]},"scheduleType":{"type":"string","enum":["manual","hourly","daily","cron"]},"scheduleConfig":{"type":"object"},"unit":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]}}}'::jsonb,
        E'## bizdata_metric_upsert\n\n- 有 metricId 则更新，否则创建\n- SQL 型须 connectionId + queryScript\n- 公式型须 formulaConfig（op=ratio|sum|diff）\n- SQL 须返回 numeric 列 **value**（可选 dimension_key）\n- 创建公式指标前，依赖的基础 SQL 指标须已存在',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666663',
        '55555555-5555-4555-8555-555555555501',
        '删除指标',
        'bizdata-metric-delete',
        'bizdata_metric_delete',
        '删除业务指标',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_delete',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666664',
        '55555555-5555-4555-8555-555555555501',
        '执行指标',
        'bizdata-metric-execute',
        'bizdata_metric_execute',
        '手动执行单个指标计算',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_execute\n\n- 成功返回 success=true 与 value\n- 公式指标依赖项须已有 lastValue\n- **禁止**未调用本 Tool 就声称执行成功',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666665',
        '55555555-5555-4555-8555-555555555501',
        '批量执行指标',
        'bizdata-metric-execute-batch',
        'bizdata_metric_execute_batch',
        '按 code 前缀批量执行（先 SQL 后 formula）',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_execute_batch\n\n传 codePrefix 如 sales；系统按依赖顺序执行。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666666',
        '55555555-5555-4555-8555-555555555501',
        '指标执行记录',
        'bizdata-metric-list-runs',
        'bizdata_metric_list_runs',
        '分页获取指标 run 记录',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_metric_list_runs',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666667',
        '55555555-5555-4555-8555-555555555501',
        '指标历史值',
        'bizdata-metric-list-values',
        'bizdata_metric_list_values',
        '分页获取指标历史计算值',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"},"from":{"type":"string"},"to":{"type":"string"},"dimensionKey":{"type":"string"},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_metric_list_values',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666668',
        '55555555-5555-4555-8555-555555555501',
        '指标最新值',
        'bizdata-metric-get-value',
        'bizdata_metric_get_value',
        '获取指标最新值，可选 refresh 先执行',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"},"refresh":{"type":"boolean"}}}'::jsonb,
        E'## bizdata_metric_get_value\n\nrefresh=true 时先执行再返回值。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666669',
        '55555555-5555-4555-8555-555555555501',
        '指标看板',
        'bizdata-metric-get-dashboard',
        'bizdata_metric_get_dashboard',
        '获取按 category 分组的看板数据',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"refresh":{"type":"boolean"}}}'::jsonb,
        E'## bizdata_metric_get_dashboard\n\n看板页可用 refresh=true 刷新全部指标。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666670',
        '55555555-5555-4555-8555-555555555501',
        '写入指标定义草稿',
        'bizdata-metric-suggest-definition',
        'bizdata_metric_suggest_definition',
        '将 SQL / 公式同步到编辑页表单',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"queryScript":{"type":"string"},"formulaConfig":{"type":"object"},"description":{"type":"string"},"unit":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_suggest_definition\n\n通过 mutation 同步 queryScript / formulaConfig 到 edit/create Surface；用户仍须保存表单或调用 upsert。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666671',
        '55555555-5555-4555-8555-555555555501',
        '指标页面跳转',
        'bizdata-metric-navigate',
        'bizdata_metric_navigate',
        '在 list / create / edit / dashboard 间跳转',
        'client',
        '{"type":"object","properties":{"target":{"type":"string","enum":["list","create","edit","dashboard"]},"metricId":{"type":"string"}},"required":["target"]}'::jsonb,
        E'## bizdata_metric_navigate\n\n路径前缀 `/business_data/metrics`：\n- list → 指标管理\n- create → 新建\n- edit → `/business_data/metrics/{id}/edit`\n- dashboard → 指标看板',
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
        '77777777-7777-4777-8777-777777777709',
        '55555555-5555-4555-8555-555555555501',
        '业务指标',
        'bizdata-metrics',
        '创建与管理 SQL / 公式指标、调度与看板',
        E'# 业务指标助手\n\n你是 EADAF 业务指标助手，帮助用户在 **业务数据 → 指标管理 / 指标看板**（路径 `/business_data/metrics`）配置与执行指标。\n\n## 页面与 Surface\n- 列表：surfaceId=`bizdata.metrics.list`\n- 新建/编辑：surfaceId=`bizdata.metrics.create` / `bizdata.metrics.edit`\n- 看板：surfaceId=`bizdata.metrics.dashboard`\n- 先用 `aibase_read_surfaces` 读取当前页，禁止向用户索要 metricId\n\n## 指标类型\n### SQL 聚合（metricType=sql）\n- 须绑定 PostgreSQL connectionId\n- queryScript 须返回 **value** 列（numeric）；可选 dimension_key 列做多维指标\n- 示例：`SELECT COUNT(*)::numeric AS value FROM bizdata_mat.orders`\n- 写 SQL 前可用 `bizdata_get_entity` / `bizdata_browse_materialized_schema` 了解物化表结构\n\n### 复合公式（metricType=formula）\n- op=ratio：numerator_code + denominator_code\n- op=sum：codes 数组\n- op=diff：left_code + right_code\n- 依赖指标须先存在且已执行（有 lastValue）\n\n## 编码规范\n- code 多级：`scope:category:name`，如 sales:order:total_count\n- category / scopeCode 由 code 前缀自动推导\n\n## 调度\n- scheduleType=manual：仅手动 / 按需\n- scheduleType=cron + scheduleConfig.expression\n\n## 工作流程\n1. `aibase_read_surfaces` 读当前页\n2. `bizdata_metric_list` / `bizdata_metric_get` 了解现状\n3. `bizdata_metric_upsert` 或 `bizdata_metric_suggest_definition` 写入定义\n4. `bizdata_metric_execute` 验证；公式域可用 `bizdata_metric_execute_batch`\n5. 看板：`bizdata_metric_get_dashboard`（refresh=true 刷新）\n\n## 禁止\n- **禁止**未调用 Tool 就声称创建/执行/看板刷新成功\n- **禁止**编造 lastValue；须从 execute / get_value 响应读取',
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
WHERE s.slug = 'bizdata-metrics'
  AND t.function_name IN (
    'aibase_read_surfaces',
    'bizdata_metric_list',
    'bizdata_metric_get',
    'bizdata_metric_upsert',
    'bizdata_metric_delete',
    'bizdata_metric_execute',
    'bizdata_metric_execute_batch',
    'bizdata_metric_list_runs',
    'bizdata_metric_list_values',
    'bizdata_metric_get_value',
    'bizdata_metric_get_dashboard',
    'bizdata_metric_suggest_definition',
    'bizdata_metric_navigate',
    'bizdata_list_entities',
    'bizdata_get_entity',
    'bizdata_browse_materialized_schema'
  )
ON CONFLICT DO NOTHING;
