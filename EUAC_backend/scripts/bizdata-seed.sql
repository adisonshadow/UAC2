-- 业务数据示例种子（单应用 catalog 演示数据）

INSERT INTO bizdata.entities (id, code, label, entity_kind, table_name, status, version, entity_info)
VALUES
    (
        'a1000001-0001-4001-8001-000000000001',
        'sales:customer:Customer',
        '客户',
        'er_table',
        'customers',
        'enabled',
        1,
        '{"label":"客户","description":"销售客户主数据","tags":["sales","master"]}'::jsonb
    ),
    (
        'a1000001-0001-4001-8001-000000000002',
        'sales:order:Order',
        '订单',
        'er_table',
        'orders',
        'enabled',
        1,
        '{"label":"订单","description":"销售订单","tags":["sales","transaction"]}'::jsonb
    ),
    (
        'a1000001-0001-4001-8001-000000000003',
        'sales:order:OrderItem',
        '订单明细',
        'er_table',
        'order_items',
        'enabled',
        1,
        '{"label":"订单明细","description":"订单行项目","tags":["sales","transaction"]}'::jsonb
    ),
    (
        'a1000001-0001-4001-8001-000000000004',
        'sales:config:SalesSettings',
        '销售配置',
        'json_schema',
        NULL,
        'enabled',
        1,
        '{"label":"销售配置","description":"JSON 结构业务配置"}'::jsonb
    )
ON CONFLICT (code) DO NOTHING;

UPDATE bizdata.entities SET json_schema = '{
  "type": "object",
  "properties": {
    "defaultCurrency": { "type": "string", "default": "CNY" },
    "taxRate": { "type": "number", "default": 0.13 }
  }
}'::jsonb
WHERE code = 'sales:config:SalesSettings';

INSERT INTO bizdata.entity_fields (entity_id, field_key, column_info, typeorm_config, sort_order)
VALUES
    (
        'a1000001-0001-4001-8001-000000000001',
        'id',
        '{"id":"f1","label":"主键","extendType":"adb-guid-id"}'::jsonb,
        '{"type":"uuid","primary":true,"nullable":false}'::jsonb,
        0
    ),
    (
        'a1000001-0001-4001-8001-000000000001',
        'name',
        '{"id":"f2","label":"客户名称"}'::jsonb,
        '{"type":"varchar","length":200,"nullable":false}'::jsonb,
        1
    ),
    (
        'a1000001-0001-4001-8001-000000000001',
        'phone',
        '{"id":"f3","label":"联系电话"}'::jsonb,
        '{"type":"varchar","length":32,"nullable":true}'::jsonb,
        2
    ),
    (
        'a1000001-0001-4001-8001-000000000002',
        'id',
        '{"id":"f4","label":"主键","extendType":"adb-guid-id"}'::jsonb,
        '{"type":"uuid","primary":true,"nullable":false}'::jsonb,
        0
    ),
    (
        'a1000001-0001-4001-8001-000000000002',
        'order_no',
        '{"id":"f5","label":"订单号"}'::jsonb,
        '{"type":"varchar","length":64,"nullable":false,"unique":true}'::jsonb,
        1
    ),
    (
        'a1000001-0001-4001-8001-000000000002',
        'customer_id',
        '{"id":"f6","label":"客户ID"}'::jsonb,
        '{"type":"uuid","nullable":false}'::jsonb,
        2
    ),
    (
        'a1000001-0001-4001-8001-000000000002',
        'amount',
        '{"id":"f7","label":"订单金额"}'::jsonb,
        '{"type":"decimal","precision":12,"scale":2,"nullable":false}'::jsonb,
        3
    ),
    (
        'a1000001-0001-4001-8001-000000000003',
        'id',
        '{"id":"f8","label":"主键"}'::jsonb,
        '{"type":"uuid","primary":true,"nullable":false}'::jsonb,
        0
    ),
    (
        'a1000001-0001-4001-8001-000000000003',
        'order_id',
        '{"id":"f9","label":"订单ID"}'::jsonb,
        '{"type":"uuid","nullable":false}'::jsonb,
        1
    ),
    (
        'a1000001-0001-4001-8001-000000000003',
        'product_name',
        '{"id":"f10","label":"商品名称"}'::jsonb,
        '{"type":"varchar","length":200,"nullable":false}'::jsonb,
        2
    ),
    (
        'a1000001-0001-4001-8001-000000000003',
        'quantity',
        '{"id":"f11","label":"数量"}'::jsonb,
        '{"type":"int","nullable":false}'::jsonb,
        3
    )
ON CONFLICT (entity_id, field_key) DO NOTHING;

INSERT INTO bizdata.enums (id, code, enum_info, values, items)
VALUES (
    'b1000001-0001-4001-8001-000000000001',
    'sales:order:OrderStatus',
    '{"id":"enum1","code":"sales:order:OrderStatus","label":"订单状态"}'::jsonb,
    '{"PENDING":"pending","PAID":"paid","SHIPPED":"shipped","COMPLETED":"completed","CANCELLED":"cancelled"}'::jsonb,
    '{"PENDING":{"label":"待支付","sort":1},"PAID":{"label":"已支付","sort":2},"SHIPPED":{"label":"已发货","sort":3},"COMPLETED":{"label":"已完成","sort":4},"CANCELLED":{"label":"已取消","sort":5}}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO bizdata.relations (id, type, name, from_entity_id, to_entity_id, config)
VALUES
    (
        'c1000001-0001-4001-8001-000000000001',
        'manyToOne',
        'customer',
        'a1000001-0001-4001-8001-000000000002',
        'a1000001-0001-4001-8001-000000000001',
        '{"nullable":false}'::jsonb
    ),
    (
        'c1000001-0001-4001-8001-000000000002',
        'oneToMany',
        'items',
        'a1000001-0001-4001-8001-000000000002',
        'a1000001-0001-4001-8001-000000000003',
        '{}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;
