-- 增量：逻辑元数据 & 数据标准 AI Tool / Skill
-- 用法：psql -f scripts/bizdata-metadata-ai-seed.sql

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666613',
        '55555555-5555-4555-8555-555555555501',
        '列出数据标准',
        'bizdata-list-data-standards',
        'bizdata_list_data_standards',
        '分页列出数据标准（标准名、编码、版本、状态）',
        'client',
        '{"type":"object","properties":{"keyword":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_list_data_standards\n\n返回 total 与 items。默认 size=50。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666614',
        '55555555-5555-4555-8555-555555555501',
        '创建数据标准',
        'bizdata-create-data-standard',
        'bizdata_create_data_standard',
        '创建数据标准记录（name/code/version 必填）',
        'client',
        '{"type":"object","properties":{"name":{"type":"string"},"code":{"type":"string"},"version":{"type":"string"},"description":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]}},"required":["name","code","version"]}'::jsonb,
        E'## bizdata_create_data_standard\n\n同一 code+version 不可重复。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666615',
        '55555555-5555-4555-8555-555555555501',
        '更新数据标准',
        'bizdata-update-data-standard',
        'bizdata_update_data_standard',
        '更新数据标准',
        'client',
        '{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"code":{"type":"string"},"version":{"type":"string"},"description":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]}},"required":["id"]}'::jsonb,
        '## bizdata_update_data_standard',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666616',
        '55555555-5555-4555-8555-555555555501',
        '删除数据标准',
        'bizdata-delete-data-standard',
        'bizdata_delete_data_standard',
        '删除数据标准（被元数据引用时失败）',
        'client',
        '{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}'::jsonb,
        '## bizdata_delete_data_standard',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666617',
        '55555555-5555-4555-8555-555555555501',
        '列出元数据逻辑表',
        'bizdata-list-metadata-tables',
        'bizdata_list_metadata_tables',
        '列出逻辑元数据表（entity/metric/enum）',
        'client',
        '{"type":"object","properties":{"keyword":{"type":"string"},"targetType":{"type":"string","enum":["entity","metric","enum"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_list_metadata_tables\n\n逻辑元数据对应数据模型/指标/枚举，非物理表。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666618',
        '55555555-5555-4555-8555-555555555501',
        '获取元数据表详情',
        'bizdata-get-metadata-table',
        'bizdata_get_metadata_table',
        '获取元数据逻辑表详情（含字段列表）',
        'client',
        '{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}'::jsonb,
        '## bizdata_get_metadata_table',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666619',
        '55555555-5555-4555-8555-555555555501',
        '按 target 获取元数据',
        'bizdata-get-metadata-by-target',
        'bizdata_get_metadata_by_target',
        '按 entity/metric/enum 目标获取元数据（可选 fieldKey 取字段级）',
        'client',
        '{"type":"object","properties":{"targetType":{"type":"string","enum":["entity","metric","enum"]},"targetId":{"type":"string"},"fieldKey":{"type":"string"}},"required":["targetType","targetId"]}'::jsonb,
        E'## bizdata_get_metadata_by_target\n\ntargetType + targetId 定位逻辑对象；fieldKey 可选，返回单字段元数据。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666661a',
        '55555555-5555-4555-8555-555555555501',
        '保存元数据表',
        'bizdata-upsert-metadata-table',
        'bizdata_upsert_metadata_table',
        '按 target 创建或更新逻辑元数据表',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"targetType":{"type":"string","enum":["entity","metric","enum"]},"targetId":{"type":"string"},"metadataCode":{"type":"string"},"standardId":{"type":"string","description":"数据标准 UUID"},"businessMeaning":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]}},"required":["targetType","targetId","code"]}'::jsonb,
        E'## bizdata_upsert_metadata_table\n\nstandardId 关联 bizdata.data_standards.id，勿填纯文本编码。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666661b',
        '55555555-5555-4555-8555-555555555501',
        '更新元数据表',
        'bizdata-update-metadata-table',
        'bizdata_update_metadata_table',
        '更新元数据逻辑表（表级）',
        'client',
        '{"type":"object","properties":{"id":{"type":"string"},"metadataCode":{"type":"string"},"standardId":{"type":"string"},"businessMeaning":{"type":"string"},"status":{"type":"string","enum":["enabled","disabled"]}},"required":["id"]}'::jsonb,
        '## bizdata_update_metadata_table',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666661c',
        '55555555-5555-4555-8555-555555555501',
        '保存元数据字段',
        'bizdata-upsert-metadata-field',
        'bizdata_upsert_metadata_field',
        '保存单条字段级元数据',
        'client',
        '{"type":"object","properties":{"metadataTableId":{"type":"string"},"fieldKey":{"type":"string"},"metadataCode":{"type":"string"},"standardId":{"type":"string"},"businessMeaning":{"type":"string"},"sensitivityLevel":{"type":"string"},"alias":{"type":"string"},"dataType":{"type":"string"},"enumCode":{"type":"string"}},"required":["metadataTableId","fieldKey"]}'::jsonb,
        E'## bizdata_upsert_metadata_field\n\n先 `bizdata_get_metadata_by_target` 或 `bizdata_list_metadata_tables` 取得 metadataTableId。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666661d',
        '55555555-5555-4555-8555-555555555501',
        '批量更新元数据字段',
        'bizdata-update-metadata-fields',
        'bizdata_update_metadata_fields',
        '批量更新某逻辑表下字段元数据',
        'client',
        '{"type":"object","properties":{"metadataTableId":{"type":"string"},"fields":{"type":"array","items":{"type":"object","properties":{"fieldKey":{"type":"string"},"metadataCode":{"type":"string"},"standardId":{"type":"string"},"businessMeaning":{"type":"string"},"sensitivityLevel":{"type":"string"},"alias":{"type":"string"},"dataType":{"type":"string"},"enumCode":{"type":"string"}}}}},"required":["metadataTableId","fields"]}'::jsonb,
        '## bizdata_update_metadata_fields',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-66666666661e',
        '55555555-5555-4555-8555-555555555501',
        '同步元数据骨架',
        'bizdata-sync-metadata-from-schema',
        'bizdata_sync_metadata_from_schema',
        '从实体/指标/枚举结构同步元数据目录骨架',
        'client',
        '{"type":"object","properties":{}}'::jsonb,
        E'## bizdata_sync_metadata_from_schema\n\n为所有 entity/metric/enum 创建缺失的 metadata_tables 与 fields 骨架，不覆盖已有 standardId。',
        '{}'::jsonb,
        true
    )
ON CONFLICT (function_name) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
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
        '77777777-7777-4777-8777-777777777705',
        '55555555-5555-4555-8555-555555555501',
        '数据标准管理',
        'bizdata-data-standards',
        '维护数据标准主数据（标准名、编码、版本）',
        E'# 数据标准管理助手\n\n你是 EADAF 数据标准治理助手，帮助管理员维护 `bizdata.data_standards` 主数据。\n\n## 前提\n- 需在系统设置中开启「应用元数据」\n- 元数据表/字段通过 **standardId**（UUID）关联数据标准；也可传 **standardCode** + standardVersion，Tool 会自动解析\n\n## 字段\n- 标准名 name、标准编码 code、版本 version（code+version 唯一）\n- 描述 description、状态 enabled/disabled\n\n## 流程\n1. `bizdata_list_data_standards` 查看现有标准\n2. `bizdata_create_data_standard` / `bizdata_update_data_standard` 维护\n3. **写操作后必须再次 list 验证**，响应中必须看到 `id` 字段才算成功\n4. 删除前确认无元数据引用\n\n## 禁止\n- **禁止**在未调用 Tool 或 Tool 返回 error 时声称创建成功\n- **禁止**把物理表名（如 bizdata_mat.xxx）当作元数据 code；逻辑 code 应为 entity code（如 equipment:Device）\n\n## UI 同步\n- 写操作成功后列表页会自动刷新，**不要**提示用户手动刷新',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777706',
        '55555555-5555-4555-8555-555555555501',
        '逻辑元数据目录',
        'bizdata-metadata-catalog',
        '维护 entity/metric/enum 逻辑元数据与字段释义',
        E'# 逻辑元数据助手\n\n你是 EADAF 逻辑元数据治理助手。元数据描述**数据模型实体、业务指标、枚举**的逻辑含义，**不包含**物化物理表。\n\n## 结构\n- `metadata_tables`：按 targetType（entity/metric/enum）+ targetId 唯一；**code 为逻辑编码**（如 equipment:Device），不是 bizdata_mat 物理表名\n- `metadata_fields`：字段级元数据\n- 关联标准：传 standardCode（如 TEST_STANDARD_001）或 standardId\n\n## 推荐流程\n1. `bizdata_sync_metadata_from_schema` 同步骨架\n2. `bizdata_list_metadata_tables` 或 `bizdata_get_metadata_by_target`（可传 entityCode）查看\n3. `bizdata_update_metadata_fields` 批量写字段（传 entityCode + fields + standardCode）\n4. **写操作后必须 list/get 验证**，Tool 响应含 id 才算成功\n\n## 与模型设计协作\n- 实体字段：`bizdata_get_metadata_by_target` + `bizdata_upsert_metadata_field`（可只传 entityCode）\n\n## 禁止\n- **禁止**在未调用 Tool 或 Tool 返回 error 时声称完成\n- **禁止**编造 metadataTableId；从 upsert/get 响应中获取真实 id\n\n## UI 同步\n- 写操作成功后页面会自动刷新，**不要**提示用户手动刷新',
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- 数据标准 Skill 关联 Tool
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.slug) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-data-standards'
  AND t.function_name IN (
    'bizdata_list_data_standards',
    'bizdata_create_data_standard',
    'bizdata_update_data_standard',
    'bizdata_delete_data_standard'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-data-standards'
  AND t.function_name = 'aibase_read_surfaces'
ON CONFLICT DO NOTHING;

-- 元数据目录 Skill 关联 Tool
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.slug) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-metadata-catalog'
  AND t.function_name IN (
    'bizdata_list_data_standards',
    'bizdata_list_metadata_tables',
    'bizdata_get_metadata_table',
    'bizdata_get_metadata_by_target',
    'bizdata_upsert_metadata_table',
    'bizdata_update_metadata_table',
    'bizdata_upsert_metadata_field',
    'bizdata_update_metadata_fields',
    'bizdata_sync_metadata_from_schema'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-metadata-catalog'
  AND t.function_name = 'aibase_read_surfaces'
ON CONFLICT DO NOTHING;

-- 模型设计 Skill 增量：补充字段级元数据 Tool
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 98
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name IN (
    'bizdata_list_data_standards',
    'bizdata_get_metadata_by_target',
    'bizdata_upsert_metadata_field',
    'bizdata_upsert_metadata_table'
  )
ON CONFLICT DO NOTHING;

-- 更新模型设计 Skill 说明（增量）
UPDATE aibase.skills
SET content_markdown = content_markdown || E'\n\n## 逻辑元数据（应用元数据开启后）\n- 实体/字段可维护逻辑元数据：`bizdata_get_metadata_by_target`、`bizdata_upsert_metadata_field`\n- 数据标准用 `bizdata_list_data_standards` 查 standardId，再写入元数据\n- 全量目录维护见 Skill `bizdata-metadata-catalog`',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%逻辑元数据（应用元数据开启后）%';
