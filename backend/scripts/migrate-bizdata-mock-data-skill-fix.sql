-- 强化 MOCK 数据 Skill：禁止虚假成功、必须先 browse schema

UPDATE aibase.tools SET
    review_markdown = E'## bizdata_insert_mock_data\n\n**仅开发测试**。\n\n1. 必须先 `bizdata_browse_materialized_schema` 获取 columns.name\n2. rows 的 key 必须与物理表列名完全一致\n3. 传 connectionId + entityCode + rows\n4. 枚举用 enum items 的 value；外键引用已插入 id\n5. 禁止未调用本 Tool 就声称插入成功；汇总须用返回的 inserted 字段',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_insert_mock_data';

UPDATE aibase.tools SET
    review_markdown = E'## bizdata_browse_materialized_schema\n\n**插入 MOCK 前必调**。传 connectionId + entityCode。\n\n返回 columns 数组，rows 的 key 须与 columns.name 一致（通常等于 fieldKey）。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_browse_materialized_schema';

UPDATE aibase.skills SET
    content_markdown = regexp_replace(
        content_markdown,
        E'## MOCK 测试数据（开发用途）[\\s\\S]*?(?=\\n## |$)',
        E'## MOCK 测试数据（开发用途）\n- **仅用于开发/测试**，会向物化物理表写入真实数据\n- **禁止**未调用 bizdata_insert_mock_data 就声称插入成功\n- 批量实体须逐个处理，有外键时先插父表（如 Product → Plan → WorkOrder）\n- 流程：`bizdata_browse_materialized_schema` 取列名 → `bizdata_get_entity` 取枚举 → `bizdata_insert_mock_data`\n- rows 的 key 必须与 schema.columns.name 一致\n- 汇总时只使用 Tool 返回的 inserted 数字\n- 每个实体建议 5–10 条',
        'g'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown LIKE '%MOCK 测试数据%';
