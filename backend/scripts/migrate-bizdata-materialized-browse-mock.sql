-- 物化表浏览 + MOCK 数据 AI Tools + Skill 扩展

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
) VALUES
    (
        '66666666-6666-4666-8666-666666666638',
        '55555555-5555-4555-8555-555555555501',
        '浏览物化表结构',
        'bizdata-browse-materialized-schema',
        'bizdata_browse_materialized_schema',
        '读取已物化物理表/集合/Redis 结构的字段定义',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"}},"required":["connectionId"]}'::jsonb,
        E'## bizdata_browse_materialized_schema\n\n传 connectionId + entityCode（或 entityId）。返回 columns 数组。',
        '{"handler":"bizdata_browse_materialized_schema"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666639',
        '55555555-5555-4555-8555-555555555501',
        '浏览物化表数据',
        'bizdata-browse-materialized-rows',
        'bizdata_browse_materialized_rows',
        '分页读取已物化物理表数据（开发预览）',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"},"page":{"type":"integer"},"pageSize":{"type":"integer"}},"required":["connectionId"]}'::jsonb,
        E'## bizdata_browse_materialized_rows\n\n传 connectionId + entityCode，可选 page/pageSize。插入 MOCK 前可先查看现有数据。',
        '{"handler":"bizdata_browse_materialized_rows"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666640',
        '55555555-5555-4555-8555-555555555501',
        '插入MOCK数据',
        'bizdata-insert-mock-data',
        'bizdata_insert_mock_data',
        '向已物化物理表插入 MOCK 测试数据（开发/测试用途）',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"},"rows":{"type":"array","items":{"type":"object"},"description":"行对象数组，字段名对应 fieldKey"},"rowCount":{"type":"integer"}},"required":["connectionId","rows"]}'::jsonb,
        E'## bizdata_insert_mock_data\n\n**仅开发测试**。须先 bizdata_get_entity 了解字段类型。\n\n- 传 connectionId + entityCode + rows（对象数组）\n- 枚举字段用 enum items 中的 value\n- 外键可留空或引用已有 id\n- 主键 id 可省略（自动生成 UUID）\n- 单次最多 100 条',
        '{"handler":"bizdata_insert_mock_data"}'::jsonb,
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

UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## MOCK 测试数据（开发用途）\n- **仅用于开发/测试**，会向物化物理表写入真实数据\n- 批量实体须逐个处理\n- 流程：`bizdata_get_entity` 读字段 → 生成合理 MOCK 值 → `bizdata_insert_mock_data`（connectionId + entityCode + rows）\n- 可选先 `bizdata_browse_materialized_rows` 查看现有数据\n- 枚举字段使用 enumCode 对应 items 的 value；外键可 null 或引用已有记录\n- 每个实体建议 5–10 条',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown NOT LIKE '%MOCK 测试数据%';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) + 50
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-materialization'
  AND t.function_name IN (
    'bizdata_browse_materialized_schema',
    'bizdata_browse_materialized_rows',
    'bizdata_insert_mock_data'
  )
ON CONFLICT DO NOTHING;
