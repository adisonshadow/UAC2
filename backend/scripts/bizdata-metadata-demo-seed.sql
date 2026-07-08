-- 设备管理域测试用数据标准 + 元数据（entity 存在时生效）
-- 用法：psql -f scripts/bizdata-metadata-demo-seed.sql

INSERT INTO bizdata.data_standards (id, name, code, version, description, status)
VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
    '测试数据标准',
    'TEST_STANDARD_001',
    'v1.0',
    '设备管理域测试用数据标准',
    'enabled'
)
ON CONFLICT (code, version) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;

-- equipment:Device 元数据表
INSERT INTO bizdata.metadata_tables (id, code, target_type, target_id, metadata_code, standard_id, business_meaning, status)
SELECT
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001',
    e.code,
    'entity',
    e.id,
    'META_EQUIPMENT_DEVICE',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
    '设备主数据实体',
    'enabled'
FROM bizdata.entities e
WHERE e.code = 'equipment:Device'
ON CONFLICT (target_type, target_id) DO UPDATE SET
    code = EXCLUDED.code,
    metadata_code = EXCLUDED.metadata_code,
    standard_id = EXCLUDED.standard_id,
    business_meaning = EXCLUDED.business_meaning,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO bizdata.metadata_fields (metadata_table_id, field_key, business_meaning, sensitivity_level, standard_id, data_type)
SELECT mt.id, v.field_key, v.business_meaning, v.sensitivity_level, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001', v.data_type
FROM bizdata.metadata_tables mt
CROSS JOIN (VALUES
    ('id', '设备唯一标识', 'L2', 'uuid'),
    ('code', '设备编码', 'L1', 'varchar'),
    ('name', '设备名称', 'L1', 'varchar'),
    ('device_type', '设备类型', 'L1', 'varchar'),
    ('status', '设备状态', 'L1', 'varchar'),
    ('department', '所属部门', 'L2', 'varchar'),
    ('manufacturer', '制造商', 'L1', 'varchar'),
    ('description', '设备描述', 'L1', 'text')
) AS v(field_key, business_meaning, sensitivity_level, data_type)
WHERE mt.code = 'equipment:Device'
ON CONFLICT (metadata_table_id, field_key) DO UPDATE SET
    business_meaning = EXCLUDED.business_meaning,
    sensitivity_level = EXCLUDED.sensitivity_level,
    standard_id = EXCLUDED.standard_id,
    data_type = EXCLUDED.data_type,
    updated_at = CURRENT_TIMESTAMP;

-- equipment:Specification
INSERT INTO bizdata.metadata_tables (id, code, target_type, target_id, metadata_code, standard_id, business_meaning, status)
SELECT
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002',
    e.code,
    'entity',
    e.id,
    'META_EQUIPMENT_SPEC',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
    '设备规格实体',
    'enabled'
FROM bizdata.entities e
WHERE e.code = 'equipment:Specification'
ON CONFLICT (target_type, target_id) DO UPDATE SET
    code = EXCLUDED.code,
    metadata_code = EXCLUDED.metadata_code,
    standard_id = EXCLUDED.standard_id,
    business_meaning = EXCLUDED.business_meaning,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO bizdata.metadata_fields (metadata_table_id, field_key, business_meaning, sensitivity_level, standard_id, data_type)
SELECT mt.id, v.field_key, v.business_meaning, v.sensitivity_level, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001', v.data_type
FROM bizdata.metadata_tables mt
CROSS JOIN (VALUES
    ('id', '规格唯一标识', 'L2', 'uuid'),
    ('code', '规格编码', 'L1', 'varchar'),
    ('name', '规格名称', 'L1', 'varchar'),
    ('spec_version', '规格版本', 'L1', 'varchar'),
    ('description', '规格描述', 'L1', 'text')
) AS v(field_key, business_meaning, sensitivity_level, data_type)
WHERE mt.code = 'equipment:Specification'
ON CONFLICT (metadata_table_id, field_key) DO UPDATE SET
    business_meaning = EXCLUDED.business_meaning,
    sensitivity_level = EXCLUDED.sensitivity_level,
    standard_id = EXCLUDED.standard_id,
    data_type = EXCLUDED.data_type,
    updated_at = CURRENT_TIMESTAMP;

-- equipment:DeviceConfig
INSERT INTO bizdata.metadata_tables (id, code, target_type, target_id, metadata_code, standard_id, business_meaning, status)
SELECT
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003',
    e.code,
    'entity',
    e.id,
    'META_EQUIPMENT_CONFIG',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001',
    '设备配置实体',
    'enabled'
FROM bizdata.entities e
WHERE e.code = 'equipment:DeviceConfig'
ON CONFLICT (target_type, target_id) DO UPDATE SET
    code = EXCLUDED.code,
    metadata_code = EXCLUDED.metadata_code,
    standard_id = EXCLUDED.standard_id,
    business_meaning = EXCLUDED.business_meaning,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO bizdata.metadata_fields (metadata_table_id, field_key, business_meaning, sensitivity_level, standard_id, data_type)
SELECT mt.id, v.field_key, v.business_meaning, v.sensitivity_level, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001', v.data_type
FROM bizdata.metadata_tables mt
CROSS JOIN (VALUES
    ('id', '配置唯一标识', 'L2', 'uuid'),
    ('device_code', '关联设备编码', 'L1', 'varchar'),
    ('config_key', '配置键', 'L1', 'varchar'),
    ('config_value', '配置值', 'L2', 'text'),
    ('description', '配置说明', 'L1', 'text')
) AS v(field_key, business_meaning, sensitivity_level, data_type)
WHERE mt.code = 'equipment:DeviceConfig'
ON CONFLICT (metadata_table_id, field_key) DO UPDATE SET
    business_meaning = EXCLUDED.business_meaning,
    sensitivity_level = EXCLUDED.sensitivity_level,
    standard_id = EXCLUDED.standard_id,
    data_type = EXCLUDED.data_type,
    updated_at = CURRENT_TIMESTAMP;
