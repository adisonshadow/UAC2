-- WorkCardTemplate 补齐 is_active（是否启用），与 ProcessTemplate 一致

BEGIN;

-- 1) 物化表列
ALTER TABLE IF EXISTS public."IPS_craft_WorkCardTemplate"
  ADD COLUMN IF NOT EXISTS is_active boolean;

-- 2) 实体字段（description 与 remark 之间）
UPDATE bizdata.entity_fields f
SET sort_order = 11,
    updated_at = NOW()
FROM bizdata.entities e
WHERE f.entity_id = e.id
  AND e.code = 'IPS:craft:WorkCardTemplate'
  AND f.field_key = 'remark'
  AND f.sort_order = 10;

INSERT INTO bizdata.entity_fields (
  entity_id, field_key, column_info, typeorm_config, sort_order
)
SELECT
  e.id,
  'is_active',
  '{"label": "是否启用"}'::jsonb,
  '{"type": "boolean", "nullable": true}'::jsonb,
  10
FROM bizdata.entities e
WHERE e.code = 'IPS:craft:WorkCardTemplate'
  AND NOT EXISTS (
    SELECT 1 FROM bizdata.entity_fields f
    WHERE f.entity_id = e.id AND f.field_key = 'is_active'
  );

-- 3) Create / Update 请求接口补字段
UPDATE bizdata.api_services
SET request_parameter_interface = replace(
  request_parameter_interface,
  E'    /** 工卡内容说明 */\n    description?: string;\n    /** 备注 */\n    remark?: string;',
  E'    /** 工卡内容说明 */\n    description?: string;\n    /** 是否启用 */\n    is_active?: boolean;\n    /** 备注 */\n    remark?: string;'
),
updated_at = NOW()
WHERE code IN (
  'IPS:craft:WorkCardTemplateCreate',
  'IPS:craft:WorkCardTemplateUpdate'
)
AND request_parameter_interface NOT ILIKE '%is_active%';

-- 4) Find 支持按是否启用过滤
UPDATE bizdata.api_services
SET request_parameter_interface = replace(
  request_parameter_interface,
  E'  /** 工卡类型 */\n  card_type?: WorkCardType;\n  /** 查询过滤（字段等值） */\n  filter?: Record<string, unknown>;',
  E'  /** 工卡类型 */\n  card_type?: WorkCardType;\n  /** 是否启用 */\n  is_active?: boolean;\n  /** 查询过滤（字段等值） */\n  filter?: Record<string, unknown>;'
),
updated_at = NOW()
WHERE code = 'IPS:craft:WorkCardTemplateFind'
AND request_parameter_interface NOT ILIKE '%is_active%';

COMMIT;
