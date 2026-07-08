-- 销售域示例指标（依赖 bizdata-seed 实体与默认连接）
-- 可重复执行

INSERT INTO bizdata.metrics (
    id, code, label, description, metric_type, connection_id, query_script,
    formula_config, compute_mode, schedule_type, schedule_config,
    unit, category, scope_code, status
) VALUES
    (
        'b2000001-0001-4001-8001-000000000001',
        'sales:order:total_count',
        '订单总数',
        '物化表 orders 全量计数',
        'sql',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'SELECT COUNT(*)::numeric AS value FROM bizdata_mat.orders',
        '{}'::jsonb,
        'both',
        'daily',
        '{"hour":2,"minute":0}'::jsonb,
        '单',
        '订单',
        'sales',
        'enabled'
    ),
    (
        'b2000001-0001-4001-8001-000000000002',
        'sales:customer:total_count',
        '客户总数',
        '物化表 customers 全量计数',
        'sql',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'SELECT COUNT(*)::numeric AS value FROM bizdata_mat.customers',
        '{}'::jsonb,
        'scheduled',
        'daily',
        '{"hour":2,"minute":5}'::jsonb,
        '人',
        '客户',
        'sales',
        'enabled'
    ),
    (
        'b2000001-0001-4001-8001-000000000003',
        'sales:order:total_amount',
        '订单总金额',
        'orders 表 amount 求和',
        'sql',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'SELECT COALESCE(SUM(amount), 0)::numeric AS value FROM bizdata_mat.orders',
        '{}'::jsonb,
        'both',
        'hourly',
        '{}'::jsonb,
        '元',
        '订单',
        'sales',
        'enabled'
    ),
    (
        'b2000001-0001-4001-8001-000000000004',
        'sales:order:orders_per_customer',
        '客均订单数',
        '订单总数 / 客户总数',
        'formula',
        NULL,
        NULL,
        '{"op":"ratio","numerator_code":"sales:order:total_count","denominator_code":"sales:customer:total_count"}'::jsonb,
        'scheduled',
        'daily',
        '{"hour":2,"minute":10}'::jsonb,
        '单/人',
        '订单',
        'sales',
        'enabled'
    )
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    query_script = EXCLUDED.query_script,
    formula_config = EXCLUDED.formula_config,
    compute_mode = EXCLUDED.compute_mode,
    schedule_type = EXCLUDED.schedule_type,
    schedule_config = EXCLUDED.schedule_config,
    unit = EXCLUDED.unit,
    category = EXCLUDED.category,
    scope_code = EXCLUDED.scope_code,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;
