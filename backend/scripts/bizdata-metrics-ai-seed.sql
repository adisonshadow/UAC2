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
        '列出【指标定义】metrics（怎么算）。不是看板卡片；卡片用 bizdata_metric_card_list / get_dashboard',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_metric_list\n\n返回【指标定义】items/total。\n\n**不是**看板卡片列表。列出指标 ≠ 看板有内容。创建看板展示须 `bizdata_metric_card_upsert`。',
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
        '创建或更新【指标定义】SQL/公式。不会出现在看板。看板卡片请用 bizdata_metric_card_upsert',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"},"label":{"type":"string"},"description":{"type":"string"},"metricType":{"type":"string","enum":["sql","formula"]},"connectionId":{"type":"string"},"queryScript":{"type":"string"},"formulaConfig":{"type":"object"},"computeMode":{"type":"string","enum":["scheduled","on_demand","both"]},"scheduleType":{"type":"string","enum":["manual","hourly","daily","cron"]},"scheduleConfig":{"type":"object"},"unit":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]}}}'::jsonb,
        E'## bizdata_metric_upsert\n\n**只写指标定义（metrics）**，看板不会自动出现。\n\n- 有 metricId 则更新，否则创建\n- SQL 型须 connectionId + queryScript；公式型须 formulaConfig\n- **成功判定**：信封 `verified===true`（写后 get+list 回读）；否则禁止声称创建成功\n- **禁止**用本 Tool 代替「创建看板卡片」',
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
        '读取看板 domains[].cards。空 cards=尚未建卡片（有指标也不显示）。创建卡片后必须用本 Tool 验收',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"domainCode":{"type":"string"},"refresh":{"type":"boolean"}}}'::jsonb,
        E'## bizdata_metric_get_dashboard\n\n返回 `domains[].cards`（含水合 value/trend/series）。\n\n- **空 cards ≠ 失败列出指标**；表示还没有 metric_cards\n- 声称「卡片已创建」前必须本 Tool 或 `card_list` 看到非空 cards\n- refresh=true 对 on_demand 即时重算',
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
        '在 list / dashboard / create / edit 间跳转',
        'client',
        '{"type":"object","properties":{"target":{"type":"string","enum":["list","dashboard","create","edit"]},"metricId":{"type":"string"}},"required":["target"]}'::jsonb,
        E'## bizdata_metric_navigate\n\n路径前缀 `/business_data/metrics`：\n- list → 指标管理\n- dashboard → 指标看板\n- create / edit',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666672',
        '55555555-5555-4555-8555-555555555501',
        '过滤业务指标',
        'bizdata-metric-filter',
        'bizdata_metric_filter',
        '按页面过滤项检索指标：code 前缀 + 状态，返回全部命中项（size=-1）。与 list 的区别：面向检索而非分页浏览。',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string","description":"code 前缀，如 sales"},"status":{"type":"string","enum":["enabled","disabled"]}}}'::jsonb,
        E'## bizdata_metric_filter\n\n参数全可选；不传则返回全部。返回 { items, total }。code 形如 sales:order:total_count。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666673',
        '55555555-5555-4555-8555-555555555501',
        '列出指标卡片',
        'bizdata-metric-card-list',
        'bizdata_metric_card_list',
        '列出【看板卡片】metric_cards。不是指标定义；查指标用 bizdata_metric_list',
        'client',
        '{"type":"object","properties":{"domainCode":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_metric_card_list\n\n返回 **metric_cards** 配置。\n\n与 `bizdata_metric_list` 完全不同：后者是指标定义。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666674',
        '55555555-5555-4555-8555-555555555501',
        '获取指标卡片',
        'bizdata-metric-card-get',
        'bizdata_metric_card_get',
        '按 cardId 或 code 获取指标卡片',
        'client',
        '{"type":"object","properties":{"cardId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_card_get',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666675',
        '55555555-5555-4555-8555-555555555501',
        '创建或更新指标卡片',
        'bizdata-metric-card-upsert',
        'bizdata_metric_card_upsert',
        '创建或更新【看板卡片】metric_cards。看板要出现内容必须用本 Tool，禁止用 bizdata_metric_upsert 代替',
        'client',
        '{"type":"object","required":["code","title","domainCode","vizType"],"properties":{"cardId":{"type":"string"},"code":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"domainCode":{"type":"string"},"metricId":{"type":"string"},"metricCode":{"type":"string"},"vizType":{"type":"string","enum":["statistic_trend","line","bar","ring"]},"config":{"type":"object"},"sortOrder":{"type":"integer"},"status":{"type":"string","enum":["enabled","disabled"]}}}'::jsonb,
        E'## bizdata_metric_card_upsert\n\n**唯一**写入看板卡片的 Tool。\n\n- 须 metricId 或 metricCode；code 为卡片 code；domainCode 分层\n- vizType：statistic_trend | line | bar | ring\n- **成功判定**：信封 `verified===true`，且 `_verification.onDashboard===true`（写后 get + dashboard 回读）\n- **禁止** verified≠true 仍声称「卡片已创建 / 看板已就绪」\n- **禁止**用 `bizdata_metric_upsert` 冒充',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666676',
        '55555555-5555-4555-8555-555555555501',
        '删除指标卡片',
        'bizdata-metric-card-delete',
        'bizdata_metric_card_delete',
        '删除看板卡片（不删除底层指标）',
        'client',
        '{"type":"object","properties":{"cardId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_card_delete\n\n仅删卡片配置，不影响 metrics 定义。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666677',
        '55555555-5555-4555-8555-555555555501',
        '建议指标卡片',
        'bizdata-metric-card-suggest',
        'bizdata_metric_card_suggest',
        '根据指标历史建议 vizType 并打开看板新建草稿',
        'client',
        '{"type":"object","properties":{"metricId":{"type":"string"},"code":{"type":"string"},"metricCode":{"type":"string"}}}'::jsonb,
        E'## bizdata_metric_card_suggest\n\n根据 metric_values 形状建议 statistic_trend/line/bar/ring；mutation 打开看板表单草稿，用户确认后调用 upsert。',
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
        '严格区分指标定义与看板卡片；写操作须 verified=true 回读验收',
        E'# 业务指标助手\n\n## 硬区分（必读，最高优先级）\n| 概念 | 表/实体 | 作用 | 相关 Tool |\n|------|---------|------|-----------|\n| **指标定义** | metrics | 怎么算（SQL/公式） | `bizdata_metric_list/get/upsert/execute` |\n| **指标卡片** | metric_cards | 怎么展示（看板 StatisticCard） | `bizdata_metric_card_*` |\n\n- 看板页 **只渲染已创建的 metric_cards**，按 `domainCode` 分层\n- **有 N 个指标 ≠ 有 N 张卡片**；未 `card_upsert` 则看板为空\n- 用户说「创建指标卡片 / 看板卡片」→ **只用** `bizdata_metric_card_*`\n- **禁止**用 `bizdata_metric_upsert` 冒充创建卡片；**禁止**仅 `metric_list` 后声称卡片已创建\n\n## 成功判定（写操作必遵）\n- `bizdata_metric_upsert` / `bizdata_metric_card_upsert` 带 `requiresVerification`\n- Tool 信封必须 `verified === true` 且 `kind === success` 才可向用户说「已创建/已保存」\n- `_verification` 含写后回读：`rereadOk` +（指标）`listedOk` /（卡片）`onDashboard`\n- `verified: false` 或 `business_error` → 向用户报 error.message，**禁止**脑补成功\n- 批量创建：每一张都必须各自 upsert 且各自 verified；禁止汇总时凭记忆编造数量\n\n## 意图路由\n- 「新建/改 SQL 指标、公式、调度」→ `bizdata_metric_upsert`（看 verified）\n- 「看板、卡片、可视化」→ `bizdata_metric_card_upsert`（看 verified + onDashboard）\n- 「刷新看板」→ `get_dashboard`；可选先 execute\n\n## 页面与 Surface\n- 列表 / 新建编辑 / 看板：`bizdata.metrics.*`；先 `aibase_read_surfaces`\n\n## 指标类型\n- SQL：connectionId + queryScript，须 value；可选 dimension_key\n- 公式：ratio|sum|diff\n\n## 看板卡片\n- 1 卡 = 1 metric + vizType（statistic_trend|line|bar|ring）\n- 流程：list 找 metricCode → upsert 卡片 → 确认 verified / onDashboard\n\n## 禁止\n- 未调写 Tool 或 verified≠true 就声称成功\n- 编造 id/code/卡片张数/lastValue\n- 混淆 list 指标与 list 卡片',
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
    'bizdata_metric_filter',
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
    'bizdata_metric_card_list',
    'bizdata_metric_card_get',
    'bizdata_metric_card_upsert',
    'bizdata_metric_card_delete',
    'bizdata_metric_card_suggest',
    'bizdata_list_entity_summaries',
    'bizdata_get_entity',
    'bizdata_browse_materialized_schema'
  )
ON CONFLICT DO NOTHING;
