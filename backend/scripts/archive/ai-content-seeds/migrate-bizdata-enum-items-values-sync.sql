-- 回填枚举 values ↔ items 不一致；注册 bizdata_update_enum；更新 create/list 说明

-- 1) items 为空、values 有键：按 values 生成 items（label=value 文本，sort 按键序）
UPDATE bizdata.enums e
SET
    items = sub.next_items,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT
        id,
        (
            SELECT jsonb_object_agg(
                kv.key,
                jsonb_build_object(
                    'label', CASE
                        WHEN jsonb_typeof(kv.value) = 'string' AND NULLIF(kv.value #>> '{}', '') IS NOT NULL
                            THEN kv.value #>> '{}'
                        ELSE kv.key
                    END,
                    'sort', kv.ord
                )
            )
            FROM (
                SELECT
                    key,
                    value,
                    row_number() OVER (ORDER BY key)::int AS ord
                FROM jsonb_each(e2.values)
            ) kv
        ) AS next_items
    FROM bizdata.enums e2
    WHERE COALESCE(e2.items, '{}'::jsonb) = '{}'::jsonb
      AND COALESCE(e2.values, '{}'::jsonb) <> '{}'::jsonb
) sub
WHERE e.id = sub.id
  AND sub.next_items IS NOT NULL;

-- 2) values 为空、items 有键：按 items 键生成 values（value=key）
UPDATE bizdata.enums e
SET
    values = sub.next_values,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT
        id,
        (
            SELECT jsonb_object_agg(kv.key, to_jsonb(kv.key))
            FROM jsonb_object_keys(e2.items) AS kv(key)
        ) AS next_values
    FROM bizdata.enums e2
    WHERE COALESCE(e2.values, '{}'::jsonb) = '{}'::jsonb
      AND COALESCE(e2.items, '{}'::jsonb) <> '{}'::jsonb
) sub
WHERE e.id = sub.id
  AND sub.next_values IS NOT NULL;

-- 3) 注册 / 更新 AI Tool
INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES (
    '66666666-6666-4666-8666-666666666642',
    '55555555-5555-4555-8555-555555555501',
    '更新枚举',
    'bizdata-update-enum',
    'bizdata_update_enum',
    '更新已有 ADB 枚举（label/values/items）；items 为空但 values 有值时须用本 Tool 补齐',
    'client',
    '{"type":"object","properties":{"id":{"type":"string"},"code":{"type":"string"},"label":{"type":"string"},"description":{"type":"string"},"values":{"type":"object"},"items":{"type":"object"}}}'::jsonb,
    E'## bizdata_update_enum\n\n按 **id** 或 **code** 定位已有枚举。\n\n### 修复「UI 选项数为 0」\nlist 若 `itemsEmpty=true`（items 空、values 有键）：传 `code` + 完整 `items`（或只重传 `values`，服务端会补 items）。\n\n### 字段\n- **items**：UI 选项列表来源 `{ "KEY": { "label": "中文", "sort": 1 } }`\n- **values**：键值映射；可与 items 同时更新',
    '{}'::jsonb,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    function_name = EXCLUDED.function_name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

UPDATE aibase.tools SET
    description = '创建 ADB 枚举；推荐同时传 values 与 items；仅传 values 时服务端自动补齐 items',
    parameters_schema = '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"values":{"type":"object"},"items":{"type":"object"}},"required":["code","values"]}'::jsonb,
    review_markdown = E'## bizdata_create_enum\n\n### code\n`Scope:EnumName`，如 `production:WorkOrderStatus`\n\n### values 与 items（重要）\n- **items** 是枚举管理 UI 的选项来源；**禁止**只写 values 导致 UI 选项数为 0\n- 推荐同时传：\n```json\n{\n  "code": "fmms:CallType",\n  "label": "呼叫类型",\n  "values": { "PROCESS": "工艺疑问", "QUALITY": "质量" },\n  "items": {\n    "PROCESS": { "label": "工艺疑问", "sort": 1 },\n    "QUALITY": { "label": "质量", "sort": 2 }\n  }\n}\n```\n- 仅传 values 时服务端会自动生成 items\n\n### 引用到实体字段\n```json\n{ "fieldKey": "status", "type": "adb-enum", "enumCode": "production:WorkOrderStatus", "label": "状态" }\n```',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_enum';

UPDATE aibase.tools SET
    description = '列出 ADB 枚举；检查选项时看 items，items 空而 values 有值须用 bizdata_update_enum 补齐',
    review_markdown = E'## bizdata_list_enums\n\n创建 status 等字段前先查可复用枚举。\n\n返回每项含 `optionCount`、`itemsEmpty`：\n- **itemsEmpty=true**：values 有选项但 items 空 → UI 显示 0，须 **`bizdata_update_enum`** 补齐 items\n- 判断「是否有选项」优先看 items，不要只看 values',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_list_enums';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 12
FROM aibase.skills s
JOIN aibase.tools t ON t.function_name = 'bizdata_update_enum'
WHERE s.slug = 'bizdata-model-design'
ON CONFLICT DO NOTHING;

UPDATE aibase.skills
SET
    content_markdown = content_markdown || E'\n\n## 枚举 values / items\n- UI 选项数以 **items** 为准；AI 创建时常只写 **values** 会导致「AI 看到有选项、UI 显示 0」\n- 创建时推荐同时传 values + items；仅 values 时服务端会补 items\n- 发现 `itemsEmpty`：用 **`bizdata_update_enum`** 补齐，禁止声称「已有完整选项」却不修 items',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%bizdata_update_enum%';
