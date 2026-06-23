-- 增量迁移：为 skills 增加 scope_id（已有库无需全量 initdb 时使用）

ALTER TABLE aibase.skills
    ADD COLUMN IF NOT EXISTS scope_id UUID REFERENCES aibase.scopes(id);

CREATE INDEX IF NOT EXISTS idx_skills_scope_id ON aibase.skills(scope_id);

-- 确保 sales-demo Scope 存在
INSERT INTO aibase.scopes (id, name, slug, description, is_active)
VALUES (
    '33333333-3333-4333-8333-333333333302',
    '销售管理系统 Demo',
    'sales-demo',
    'EUAC_AIBase 销售管理系统 Demo Scope，Tool 查询 SQLite 业务库',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_active)
VALUES
    (
        '55555555-5555-4555-8555-555555555511',
        '33333333-3333-4333-8333-333333333302',
        '订单分析',
        'order-analysis',
        '销售 Demo 订单查询与统计分析',
        E'# 订单分析 Skill\n\n你是销售管理系统的订单分析助手，数据来自 SQLite 业务库。\n\n## 能力\n\n- 查询单笔订单：使用 `sales_get_order`\n- 搜索订单：使用 `sales_search_orders`\n- 状态汇总：使用 `sales_order_stats_by_status`\n- 趋势分析：使用 `sales_order_stats_by_period`\n\n## 回答要求\n\n- 必须使用上述 Tool 获取真实数据，禁止编造\n- 使用中文，结论清晰\n- 涉及金额保留两位小数\n\n## 报告与可视化\n\n当用户要求**报告**、**统计分析**、**趋势**或**分布**时，除文字与表格外，必须根据 Tool 返回数据插入 1～2 个 GPT-Vis 图表，禁止编造数值。\n\n### 图表语法（标签与 JSON 同一行，标签内不要空行）\n\n**折线/趋势**（`sales_order_stats_by_period`，time=period，value=order_count 或 total_amount）：\n\n<custom-line data-axis-x-title="周期" data-axis-y-title="订单数">[{"time":"2025-01","value":5}]</custom-line>\n\n**柱状对比**（`sales_order_stats_by_status`，category=status，value=order_count）：\n\n<custom-column data-axis-x-title="状态" data-axis-y-title="订单数">[{"category":"paid","value":12}]</custom-column>\n\n**饼图占比**（如按状态金额占比，category=status，value=total_amount）：\n\n<custom-pie title="订单状态分布">[{"category":"paid","value":1200.5}]</custom-pie>\n\n也可使用 language 为 `vis-chart` 的代码块，内容为单行 JSON，例如 {"type":"line","data":[{"time":"2025-01","value":5}],"axisXTitle":"周期","axisYTitle":"订单数"}。',
        true
    ),
    (
        '55555555-5555-4555-8555-555555555512',
        '33333333-3333-4333-8333-333333333302',
        '售后分析',
        'after-sales-analysis',
        '销售 Demo 投诉查询与统计分析',
        E'# 售后分析 Skill\n\n你是销售管理系统的售后分析助手，处理订单投诉相关咨询。\n\n## 能力\n\n- 投诉列表：使用 `sales_list_complaints`\n- 投诉详情：使用 `sales_get_complaint`\n- 类型分布：使用 `sales_complaint_stats_by_type`\n- 状态分布：使用 `sales_complaint_stats_by_status`\n\n## 回答要求\n\n- 必须使用上述 Tool 获取真实数据，禁止编造\n- 使用中文\n\n## 报告与可视化\n\n当用户要求**报告**、**统计分析**或**分布**时，除文字与表格外，必须根据 Tool 返回数据插入 1～2 个 GPT-Vis 图表，禁止编造数值。\n\n### 图表语法（标签与 JSON 同一行，标签内不要空行）\n\n**饼图**（`sales_complaint_stats_by_type`，category=type，value=complaint_count）：\n\n<custom-pie title="投诉类型分布">[{"category":"quality","value":3}]</custom-pie>\n\n**柱状图**（`sales_complaint_stats_by_status`，category=status，value=complaint_count）：\n\n<custom-column data-axis-x-title="处理状态" data-axis-y-title="投诉数">[{"category":"open","value":2}]</custom-column>\n\n也可使用 language 为 `vis-chart` 的代码块，内容为单行 JSON，例如 {"type":"pie","data":[{"category":"quality","value":3}],"title":"投诉类型分布"}。',
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    scope_id = EXCLUDED.scope_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

DELETE FROM aibase.skill_tools
WHERE skill_id IN (
    SELECT id FROM aibase.skills WHERE slug IN ('order-analysis', 'after-sales-analysis')
);

INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT v.id, v.skill_id, v.tool_id, v.sort_order
FROM (VALUES
    ('66666666-6666-4666-8666-666666666611'::uuid, '55555555-5555-4555-8555-555555555511'::uuid, '44444444-4444-4444-8444-444444444411'::uuid, 0),
    ('66666666-6666-4666-8666-666666666612'::uuid, '55555555-5555-4555-8555-555555555511'::uuid, '44444444-4444-4444-8444-444444444412'::uuid, 1),
    ('66666666-6666-4666-8666-666666666613'::uuid, '55555555-5555-4555-8555-555555555511'::uuid, '44444444-4444-4444-8444-444444444413'::uuid, 2),
    ('66666666-6666-4666-8666-666666666614'::uuid, '55555555-5555-4555-8555-555555555511'::uuid, '44444444-4444-4444-8444-444444444414'::uuid, 3),
    ('66666666-6666-4666-8666-666666666621'::uuid, '55555555-5555-4555-8555-555555555512'::uuid, '44444444-4444-4444-8444-444444444415'::uuid, 0),
    ('66666666-6666-4666-8666-666666666622'::uuid, '55555555-5555-4555-8555-555555555512'::uuid, '44444444-4444-4444-8444-444444444416'::uuid, 1),
    ('66666666-6666-4666-8666-666666666623'::uuid, '55555555-5555-4555-8555-555555555512'::uuid, '44444444-4444-4444-8444-444444444417'::uuid, 2),
    ('66666666-6666-4666-8666-666666666624'::uuid, '55555555-5555-4555-8555-555555555512'::uuid, '44444444-4444-4444-8444-444444444418'::uuid, 3)
) AS v(id, skill_id, tool_id, sort_order)
ON CONFLICT (skill_id, tool_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
