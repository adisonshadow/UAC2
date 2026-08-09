-- 将实体/表列 qty 统一为 quantity（与 BomSchemeNode 等一致，不做运行时别名映射）
-- 影响：IPS:production:BomInstanceNode、IPS:process:ProcessOperationMaterial

BEGIN;

-- 1) 物化表列
ALTER TABLE IF EXISTS public.ips_bom_instance_node
  RENAME COLUMN qty TO quantity;

ALTER TABLE IF EXISTS public.ips_process_operation_material
  RENAME COLUMN qty TO quantity;

-- 2) 实体字段 field_key
UPDATE bizdata.entity_fields f
SET field_key = 'quantity',
    updated_at = NOW()
FROM bizdata.entities e
WHERE f.entity_id = e.id
  AND e.code IN (
    'IPS:production:BomInstanceNode',
    'IPS:process:ProcessOperationMaterial'
  )
  AND f.field_key = 'qty';

-- 3) API 请求接口声明
UPDATE bizdata.api_services
SET request_parameter_interface = replace(request_parameter_interface, 'qty:', 'quantity:'),
    updated_at = NOW()
WHERE code IN (
  'IPS:production:BomInstanceNodeCreate',
  'IPS:production:BomInstanceNodeUpdate',
  'IPS:process:ProcessOperationMaterialCreate',
  'IPS:process:ProcessOperationMaterialUpdate'
)
AND request_parameter_interface ILIKE '%qty:%';

-- 4) 自定义 SQL（列名与绑定参数）
UPDATE bizdata.api_services
SET definition_script = replace(replace(definition_script, '"qty"', '"quantity"'), ':qty', ':quantity'),
    updated_at = NOW()
WHERE code IN (
  'IPS:process:ProcessOperationMaterialCreate',
  'IPS:process:ProcessOperationMaterialUpdate'
)
AND definition_script ILIKE '%qty%';

COMMIT;
