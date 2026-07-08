-- 增量：强化元数据/实体 Tool 说明，避免 AI 编造 id
-- 用法：psql -f scripts/migrate-metadata-ai-tool-hints.sql

UPDATE aibase.tools
SET
  description = '按 ID 或 code 获取实体详情（含字段）；优先 entityCode',
  parameters_schema = '{"type":"object","properties":{"entityId":{"type":"string","description":"实体 UUID，须来自 list，禁止编造 entity-xxx"},"entityCode":{"type":"string","description":"实体 code，如 equipment:Device"}}}'::jsonb,
  review_markdown = E'## bizdata_get_entity\n\n**优先传 entityCode**（如 `equipment:Device`）。\n\n- entityId 必须是 `bizdata_list_entities` 返回的 UUID\n- **禁止**编造 `entity-equipment-device`、`md-xxx` 等假 id\n- 完善字段元数据时，更推荐 `bizdata_get_metadata_by_target` + `bizdata_update_metadata_fields`',
  updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_get_entity';

UPDATE aibase.tools
SET
  description = '获取元数据表详情（含字段）；可传 code 如 equipment:Device',
  parameters_schema = '{"type":"object","properties":{"id":{"type":"string","description":"元数据表 UUID，须来自 list"},"code":{"type":"string","description":"逻辑编码 equipment:Device"},"entityCode":{"type":"string"}}}'::jsonb,
  review_markdown = E'## bizdata_get_metadata_table\n\n**优先传 code / entityCode**，不要编造 `md-equipment-device`。\n\n批量补字段请用 `bizdata_update_metadata_fields`（传 entityCode + fields）。',
  updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_get_metadata_table';

UPDATE aibase.skills
SET
  content_markdown = E'# 逻辑元数据助手\n\n你是 EADAF 逻辑元数据治理助手。元数据描述**数据模型实体、业务指标、枚举**的逻辑含义，**不包含**物化物理表。\n\n## ID 规则（重要）\n- **禁止编造** entityId、metadataTableId（如 entity-equipment-device、md-equipment-device）\n- 查询实体：用 **entityCode**（`equipment:Device`）或 list 返回的 **UUID**\n- 查询/更新元数据字段：**推荐** `bizdata_update_metadata_fields`，参数 `entityCode` + `fields` + `standardCode`\n- 备选：`bizdata_get_metadata_by_target`（entityCode + targetType=entity）\n\n## 结构\n- metadata_tables.code = 逻辑编码（equipment:Device），不是 bizdata_mat 物理表名\n- standardCode 关联数据标准（如 TEST_STANDARD_001）\n\n## 推荐流程\n1. `bizdata_sync_metadata_from_schema`\n2. `bizdata_list_metadata_tables`（keyword=equipment）\n3. `bizdata_update_metadata_fields` 批量补全 businessMeaning、sensitivityLevel\n4. 写后 `bizdata_get_metadata_by_target` 验证\n\n## UI 同步\n- 写操作成功后页面自动刷新，勿提示用户手动刷新',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-metadata-catalog';
