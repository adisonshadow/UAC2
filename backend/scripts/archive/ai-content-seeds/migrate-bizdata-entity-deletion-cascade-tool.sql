-- 实体级联删除 Tool：支持 deleteEntityIds + dropPhysicalTables，走 deletion-execute

UPDATE aibase.tools
SET
    description = '事务化级联删除实体（含 API 服务/采集管道/指标/元数据目录；可选 DROP 物理表）。可传 deleteEntityIds 批量删除。禁止用于 Scope 调整',
    parameters_schema = '{
      "type":"object",
      "properties":{
        "entityId":{"type":"string","description":"根实体 UUID（与 entityCode 二选一）"},
        "entityCode":{"type":"string","description":"实体 code"},
        "deleteEntityIds":{
          "type":"array",
          "items":{"type":"string"},
          "description":"待删除实体 UUID 列表（优先；来自删除确认）"
        },
        "dropPhysicalTables":{
          "type":"boolean",
          "description":"是否 CASCADE DROP 各物化连接物理表/集合，默认 false"
        }
      }
    }'::jsonb,
    review_markdown = E'## bizdata_delete_entity\n\n**禁止**用于 Scope 调整/code 重命名（用 `bizdata_rename_entity_code`）。\n\n### 参数\n- `deleteEntityIds`：待删实体 UUID 列表（删除确认 Modal / 影响分析后优先传）\n- 或 `entityId` / `entityCode`：仅删单个实体时使用\n- `dropPhysicalTables`：是否 DROP 物化物理表（默认 false）\n\n### 行为\n- 事务内删除：API 服务、采集管道绑定、关联指标、逻辑元数据目录（entity/metric）、实体本身（字段/关系/物化明细 CASCADE）\n- 可选：各连接上 CASCADE DROP 物理表/集合（best-effort，不可回滚）\n\n须 `_verification.verified=true` 才算成功。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_delete_entity';
