-- 业务数据 AI Scope / Skills / Tools 种子数据

INSERT INTO aibase.scopes (id, name, slug, description, is_active)
VALUES (
    '55555555-5555-4555-8555-555555555501',
    '业务数据',
    'business-data',
    'EADAF 业务数据模型设计与物化',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666601',
        '55555555-5555-4555-8555-555555555501',
        '列出实体(全量字段,已停用)',
        'bizdata-list-entities',
        'bizdata_list_entities',
        '【已停用】含完整 fields；浏览/列举实体请用 bizdata_list_entity_summaries',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]}}}'::jsonb,
        E'## bizdata_list_entities（已停用）\n\n已对 AI 停用。请用 **bizdata_list_entity_summaries** 或 **bizdata_get_entity**。',
        '{}'::jsonb,
        false
    ),
    (
        '66666666-6666-4666-8666-666666666641',
        '55555555-5555-4555-8555-555555555501',
        '列出实体摘要',
        'bizdata-list-entity-summaries',
        'bizdata_list_entity_summaries',
        '列出业务数据实体摘要（不含 fields，含 fieldCount）；浏览 Scope、对照 API 覆盖率时的默认 Tool',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## bizdata_list_entity_summaries\n\n列出/浏览实体默认 Tool。返回 id/code/label/entityKind/tableName/status/version/fieldCount/modelValidated。字段详情用 bizdata_get_entity。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666602',
        '55555555-5555-4555-8555-555555555501',
        '获取实体详情',
        'bizdata-get-entity',
        'bizdata_get_entity',
        '按 ID 或 code 获取实体详情含字段',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"}}}'::jsonb,
        '## bizdata_get_entity\n\nentityId 或 entityCode 二选一。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666603',
        '55555555-5555-4555-8555-555555555501',
        '创建实体',
        'bizdata-create-entity',
        'bizdata_create_entity',
        '创建 ER/JSON 实体；status/state/*_type 须先 create_enum，字段 type=adb-enum + enumCode',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"entityKind":{"type":"string","enum":["er_table","json_schema"]},"tableName":{"type":"string"},"fields":{"type":"array","description":"字段列表；status/state/*_type 等须 type=adb-enum 并指定 enumCode（先 bizdata_create_enum）","items":{"type":"object","properties":{"fieldKey":{"type":"string"},"name":{"type":"string","description":"同 fieldKey"},"label":{"type":"string"},"type":{"type":"string","description":"varchar/int/uuid/decimal 等；有限取值须用 adb-enum（配合 enumCode）"},"enumCode":{"type":"string","description":"枚举 code（如 production:WorkOrderStatus）；type=adb-enum 时必填"},"extendType":{"type":"string","description":"扩展类型；枚举可写 adb-enum（与 type=adb-enum 等价）"},"enumConfig":{"type":"object","properties":{"enumCode":{"type":"string"},"isMultiple":{"type":"boolean"}}},"length":{"type":"integer"},"nullable":{"type":"boolean"},"unique":{"type":"boolean"},"primary":{"type":"boolean"},"columnInfo":{"type":"object"},"typeormConfig":{"type":"object"}}}},"indexes":{"type":"array","items":{"type":"object"}},"relations":{"type":"array","items":{"type":"object"}}},"required":["code","label"]}'::jsonb,
        E'## bizdata_create_entity\n\ncode 格式 `Scope1[:Scope2...]:EntityName`。**仅用于 code 不存在的新实体**；若已存在请用 `bizdata_rename_entity_code`。推荐同时传 fields、indexes、relations；分步则须 upsert_entity_indexes 与 add_relation。**禁止** delete + create 改 Scope。\n\n### 枚举字段（status/state/*_type 等）\n**禁止**用 varchar。流程：\n1. `bizdata_list_enums`\n2. 无则 `bizdata_create_enum`（code + values）\n3. 字段**同时**传 `type` 与 `enumCode`：\n```json\n{ "fieldKey": "station_type", "type": "adb-enum", "enumCode": "fmms:StationType", "label": "站点类型" }\n```\n禁止只改 `typeormConfig.type`，或只传 `type=adb-enum` 不传 `enumCode`。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666604',
        '55555555-5555-4555-8555-555555555501',
        '更新实体',
        'bizdata-update-entity',
        'bizdata_update_entity',
        '更新实体信息与字段；有限取值字段须 type=adb-enum + enumCode（先 create_enum）',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string","description":"定位用：当前/旧 code"},"code":{"type":"string","description":"新 code，如 fmms:production:WorkCard"},"label":{"type":"string"},"tableName":{"type":"string","description":"ER 物理表名；默认推导时随 code 变"},"status":{"type":"string","enum":["enabled","disabled","archived"]},"replaceFields":{"type":"boolean"},"layout":{"type":"object","description":"实体 layout，含 indexes 等"},"jsonSchema":{"type":"object","description":"JSON Schema 结构"},"fields":{"type":"array","description":"字段列表；status/state/*_type 等须 type=adb-enum 并指定 enumCode（先 bizdata_create_enum）","items":{"type":"object","properties":{"fieldKey":{"type":"string"},"name":{"type":"string","description":"同 fieldKey"},"label":{"type":"string"},"type":{"type":"string","description":"varchar/int/uuid/decimal 等；有限取值须用 adb-enum（配合 enumCode）"},"enumCode":{"type":"string","description":"枚举 code（如 production:WorkOrderStatus）；type=adb-enum 时必填"},"extendType":{"type":"string","description":"扩展类型；枚举可写 adb-enum（与 type=adb-enum 等价）"},"enumConfig":{"type":"object","properties":{"enumCode":{"type":"string"},"isMultiple":{"type":"boolean"}}},"length":{"type":"integer"},"nullable":{"type":"boolean"},"unique":{"type":"boolean"},"primary":{"type":"boolean"},"columnInfo":{"type":"object"},"typeormConfig":{"type":"object"}}}}}}'::jsonb,
        E'## bizdata_update_entity\n\n保存后 version 自增，**页面 UI 会自动同步**，无需用户手动刷新。\n\n### 定位实体\n- entityId 或 **entityCode**（当前/旧 code，如 `fmms:WorkCard`）二选一\n\n### 修改 Code（重要）\n- 传 `code` 为新 code，格式 `Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`）\n- 可选 `tableName`（ER）；不填且原表名为默认推导值时随 code 同步\n- 后端**同一事务**级联更新：元数据、绑定 API 服务、采集管道、物化记录、关系 config、字段/脚本引用\n- **任一步失败则全部回滚**；须向用户展示 Tool 错误原文，禁止声称成功\n- 成功后用**新 code** 调 `bizdata_get_entity` / `bizdata_list_entity_summaries` 验证，并重跑 `bizdata_validate_model`\n- **禁止**为改 Scope 而 delete + create\n\n### 字段格式\n普通字段：\n```json\n{ "fieldKey": "company_name", "label": "公司名称", "type": "varchar", "length": 255, "nullable": false }\n```\n\n### 枚举字段（status/state/*_type 等，必遵）\n**禁止**用 varchar。修复/新增流程：\n1. `bizdata_list_enums` → 无则 `bizdata_create_enum`（code + values）\n2. `bizdata_update_entity` **同时**传 `type` 与 `enumCode`：\n```json\n{ "fieldKey": "station_type", "type": "adb-enum", "enumCode": "fmms:StationType", "label": "站点类型" }\n```\n3. 再 `bizdata_validate_model`\n\n**禁止**：只改 `typeormConfig.type`；只传 `type=adb-enum` 不传 `enumCode`；用 varchar 建 status/*_type。\n\n### 索引与关系\n- 索引请用 **bizdata_upsert_entity_indexes**\n- 关系请按「关系添加五步法」：`bizdata_add_relation`（code）+ `_verification` + `bizdata_list_relations({ entityCode })`\n\n### 合并策略\n- 默认 merge：只传新增/修改字段，保留已有字段\n- replaceFields=true：全量替换\n\n### 页面上下文\n- 可用 `aibase_read_surfaces` 读取当前选中实体等页面状态',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666637',
        '55555555-5555-4555-8555-555555555501',
        '重命名实体 Code',
        'bizdata-rename-entity-code',
        'bizdata_rename_entity_code',
        '调整实体 Scope 层级或重命名 code（保留字段/索引/关系/物化/MOCK）；禁止 delete + create',
        'client',
        '{"type":"object","properties":{"entityCode":{"type":"string","description":"当前/旧 code"},"code":{"type":"string","description":"新 code"},"tableName":{"type":"string"}},"required":["entityCode","code"]}'::jsonb,
        E'## bizdata_rename_entity_code\n\nScope 调整/code 重命名**唯一推荐路径**。仅传 entityCode + code（可选 tableName）。禁止 delete + create。成功后须 `_verification.verified=true` 且 list/get 验证新 code。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666605',
        '55555555-5555-4555-8555-555555555501',
        '删除实体',
        'bizdata-delete-entity',
        'bizdata_delete_entity',
        '永久删除实体；支持 deleteEntityIds 级联清理 API/采集/指标/元数据；禁止用于 Scope 调整，请用 bizdata_rename_entity_code',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"deleteEntityIds":{"type":"array","items":{"type":"string"}},"dropPhysicalTables":{"type":"boolean"}}}'::jsonb,
        E'## bizdata_delete_entity\n\n**禁止**用于 Scope 调整/code 重命名。仅用户明确要求删除时使用。\n支持 `deleteEntityIds` 批量级联删除（含 API 服务/采集管道/指标/元数据目录；可选 `dropPhysicalTables`）。须 `_verification.verified=true` 才算成功。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666606',
        '55555555-5555-4555-8555-555555555501',
        '创建枚举',
        'bizdata-create-enum',
        'bizdata_create_enum',
        '创建 ADB 枚举；有限取值字段须先建枚举，再在实体字段用 type=adb-enum + enumCode 引用',
        'client',
        '{"type":"object","properties":{"code":{"type":"string"},"label":{"type":"string"},"values":{"type":"object"},"items":{"type":"object"}},"required":["code","values"]}'::jsonb,
        E'## bizdata_create_enum\n\ncode 如 `production:WorkOrderStatus` / `fmms:StationType`。推荐同时传 values + items；仅 values 时服务端补 items。\n\n### 引用到实体字段（create/update_entity 时必传 enumCode）\n```json\n{ "fieldKey": "station_type", "type": "adb-enum", "enumCode": "fmms:StationType", "label": "站点类型" }\n```\n禁止只传 `type=adb-enum` 而不传 `enumCode`。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666642',
        '55555555-5555-4555-8555-555555555501',
        '更新枚举',
        'bizdata-update-enum',
        'bizdata_update_enum',
        '更新已有 ADB 枚举（label/values/items）；items 为空但 values 有值时须用本 Tool 补齐',
        'client',
        '{"type":"object","properties":{"id":{"type":"string"},"code":{"type":"string"},"label":{"type":"string"},"description":{"type":"string"},"values":{"type":"object"},"items":{"type":"object"}}}'::jsonb,
        E'## bizdata_update_enum\n\n按 id 或 code 定位。list 若 itemsEmpty=true，须补齐 items。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666636',
        '55555555-5555-4555-8555-555555555501',
        '列出枚举',
        'bizdata-list-enums',
        'bizdata_list_enums',
        '列出已定义的 ADB 枚举；检查选项时看 items，items 空而 values 有值须用 update 补齐',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"}}}'::jsonb,
        E'## bizdata_list_enums\n\n创建 status 等字段前先查可复用枚举。返回 optionCount、itemsEmpty；itemsEmpty 时用 bizdata_update_enum。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666607',
        '55555555-5555-4555-8555-555555555501',
        '添加关系',
        'bizdata-add-relation',
        'bizdata_add_relation',
        '添加实体关系；必须传 fromEntityCode/toEntityCode；manyToOne/oneToOne 前源实体须有外键字段；成功以 _verification.verified 为准',
        'client',
        '{"type":"object","properties":{"type":{"type":"string","enum":["oneToMany","manyToOne","oneToOne","manyToMany"]},"name":{"type":"string","description":"同一 from 实体内唯一；推荐目标短名 camelCase 或外键去 Id"},"inverseName":{"type":"string"},"fromEntityCode":{"type":"string","description":"源实体 code（必填）"},"toEntityCode":{"type":"string","description":"目标实体 code（必填）"},"fromEntityId":{"type":"string"},"toEntityId":{"type":"string"},"joinTable":{"type":"string"},"config":{"type":"object","description":"可选 foreignKey=源实体外键 fieldKey"}},"required":["type","name","fromEntityCode","toEntityCode"]}'::jsonb,
        E'## bizdata_add_relation\n\n**必须**传 `fromEntityCode` / `toEntityCode`（禁止编造 UUID）。\n\n### 添加前（必遵）\n1. `bizdata_get_entity(fromEntityCode)` 确认外键字段\n2. **manyToOne / oneToOne**：from 侧须有 `name` / `nameId` / `name_id` 或 `config.foreignKey`；没有则先 `bizdata_update_entity`\n3. name：同一 from 内唯一；推荐目标短名 camelCase（`Customer`→`customer`）或外键去 Id（`materialId`→`material`）；禁止 `bomSchemeNode_material` 拼接\n\n### type（from → to）\n- **manyToOne**：多方 → 一方（Order → Customer）\n- **oneToMany** / **oneToOne** / **manyToMany**\n\n### 添加后\n- 以 `_verification.verified=true` 为准；再用 `bizdata_list_relations({ entityCode })` 核对\n- **禁止**口头声称「已生效」\n- 重名错误会带上已有边的 from/to code；重名 ≠ 要加的边已存在',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666608',
        '55555555-5555-4555-8555-555555555501',
        '校验模型',
        'bizdata-validate-model',
        'bizdata_validate_model',
        '校验实体模型完整性；status/*_type 须为 adb-enum+enumCode；失败时按 errors 先 create_enum 再 update',
        'client',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string","description":"如 production:WorkOrder"},"markValidated":{"type":"boolean","description":"为 true 时根据校验结果更新是否验证通过，默认 true"}}}'::jsonb,
        E'## bizdata_validate_model\n\n**每个实体创建/修改后必须调用**（传 entityCode）。\n\n- 默认 markValidated=true：isValid 为 true 时自动标记「验证通过」\n- 若报「疑似状态/类型字段」或「缺少 enumCode」：先 `bizdata_list_enums` / `bizdata_create_enum`，再 `bizdata_update_entity` **同时**传 `type=adb-enum` + `enumCode`，然后重跑本 Tool\n- 批量创建后须对每个实体各调用一次',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666609',
        '55555555-5555-4555-8555-555555555501',
        '物化预览',
        'bizdata-preview-materialization',
        'bizdata_preview_materialization',
        '预览 SQL 与 TypeScript 代码',
        'server_builtin',
        '{"type":"object","properties":{"entityIds":{"type":"array","items":{"type":"string"}},"targetSchema":{"type":"string"}}}'::jsonb,
        '## bizdata_preview_materialization',
        '{"handler":"bizdata_preview_materialization"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666610',
        '55555555-5555-4555-8555-555555555501',
        '执行物化',
        'bizdata-execute-materialization',
        'bizdata_execute_materialization',
        '执行 DDL 物化并记录 entity_version',
        'server_builtin',
        '{"type":"object","properties":{"entityIds":{"type":"array","items":{"type":"string"}},"targetSchema":{"type":"string"},"dryRun":{"type":"boolean"},"expectedVersions":{"type":"object"}}}'::jsonb,
        '## bizdata_execute_materialization\n\n执行前确认 dryRun=false。',
        '{"handler":"bizdata_execute_materialization"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666611',
        '55555555-5555-4555-8555-555555555501',
        '物化历史',
        'bizdata-list-materialization-runs',
        'bizdata_list_materialization_runs',
        '查询物化批次历史',
        'server_builtin',
        '{"type":"object","properties":{"page":{"type":"integer"},"pageSize":{"type":"integer"}}}'::jsonb,
        '## bizdata_list_materialization_runs',
        '{"handler":"bizdata_list_materialization_runs"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666612',
        '55555555-5555-4555-8555-555555555501',
        '物化状态',
        'bizdata-get-materialization-status',
        'bizdata_get_materialization_status',
        '获取各实体当前版本与物化版本对比',
        'server_builtin',
        '{"type":"object","properties":{"connectionId":{"type":"string"}}}'::jsonb,
        '## bizdata_get_materialization_status',
        '{"handler":"bizdata_get_materialization_status"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666638',
        '55555555-5555-4555-8555-555555555501',
        '浏览物化表结构',
        'bizdata-browse-materialized-schema',
        'bizdata_browse_materialized_schema',
        '读取已物化物理表/集合/Redis 结构的字段定义',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"}},"required":["connectionId"]}'::jsonb,
        E'## bizdata_browse_materialized_schema\n\n传 connectionId + entityCode（或 entityId）。',
        '{"handler":"bizdata_browse_materialized_schema"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666639',
        '55555555-5555-4555-8555-555555555501',
        '浏览物化表数据',
        'bizdata-browse-materialized-rows',
        'bizdata_browse_materialized_rows',
        '分页读取已物化物理表数据',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"},"page":{"type":"integer"},"pageSize":{"type":"integer"}},"required":["connectionId"]}'::jsonb,
        E'## bizdata_browse_materialized_rows',
        '{"handler":"bizdata_browse_materialized_rows"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666640',
        '55555555-5555-4555-8555-555555555501',
        '插入MOCK数据',
        'bizdata-insert-mock-data',
        'bizdata_insert_mock_data',
        '向已物化物理表插入 MOCK 测试数据',
        'server_builtin',
        '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string"},"connectionId":{"type":"string"},"rows":{"type":"array","items":{"type":"object"}}},"required":["connectionId","rows"]}'::jsonb,
        E'## bizdata_insert_mock_data\n\n开发测试用途，传 rows 数组。',
        '{"handler":"bizdata_insert_mock_data"}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666637',
        '55555555-5555-4555-8555-555555555501',
        '列出关系',
        'bizdata-list-relations',
        'bizdata_list_relations',
        '列出实体关系（含 fromEntityCode/toEntityCode/directionSummary）；可传 entityCode 过滤',
        'client',
        '{"type":"object","properties":{"entityCode":{"type":"string","description":"按实体 code 过滤（from 或 to 命中）"},"entityId":{"type":"string"}}}'::jsonb,
        E'## bizdata_list_relations\n\n- 不传参：全部关系\n- 传 `entityCode`：只返回该实体作为 from 或 to 的边\n- 每条含 `fromEntityCode`、`toEntityCode`、`directionSummary`（如 `sale:Order --manyToOne--> sale:Customer (name=customer)`）\n- 添加关系后应用本 Tool（带 entityCode）做回读验证',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666638',
        '55555555-5555-4555-8555-555555555501',
        '删除关系',
        'bizdata-delete-relation',
        'bizdata_delete_relation',
        '删除实体关系',
        'client',
        '{"type":"object","properties":{"relationId":{"type":"string"}},"required":["relationId"]}'::jsonb,
        '## bizdata_delete_relation',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666639',
        '55555555-5555-4555-8555-555555555501',
        '更新实体索引',
        'bizdata-upsert-entity-indexes',
        'bizdata_upsert_entity_indexes',
        '创建或合并实体 layout.indexes',
        'client',
        '{"type":"object","properties":{"entityCode":{"type":"string"},"indexes":{"type":"array","items":{"type":"object"}}},"required":["indexes"]}'::jsonb,
        E'## bizdata_upsert_entity_indexes\n\n创建实体后为主键/外键/唯一/查询字段建索引。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666643',
        '55555555-5555-4555-8555-555555555501',
        '查询关系图谱',
        'bizdata-query-relation-graph',
        'bizdata_query_relation_graph',
        '查询实体关系图谱（节点+边）；可传 scope（一级 Scope）或 codePrefix；含 orphan 实体',
        'client',
        '{"type":"object","properties":{"scope":{"type":"string","description":"一级 Scope（code 第一段），如 IPS、fmms；不传则全库"},"codePrefix":{"type":"string","description":"更细 code 前缀，如 IPS:bom；可与 scope 同时用"}}}'::jsonb,
        E'## bizdata_query_relation_graph\n\n总览某 Scope 下实体关系（与「关系图谱」页过滤一致）。\n\n### 参数\n- **scope**：一级 Scope（code 第一段），如 `IPS`、`fmms`\n- **codePrefix**：可选更细前缀，如 `IPS:bom`（与 scope 同时传时取交集）\n\n### 返回\n- `nodes` / `edges`（含 cardinality、directionSummary）\n- `orphanNodes`：无关系边的实体（建模缺口）\n- `availableScopes`：当前库已有一级 Scope\n\n### 何时用\n- 添加关系前先摸清现有边与缺口\n- 用户问「某 Scope 关系是否完整」时优先本 Tool（比全量 list_relations 更适合总览）',
        '{}'::jsonb,
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

INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_active)
VALUES
    (
        '77777777-7777-4777-8777-777777777701',
        '55555555-5555-4555-8555-555555555501',
        '业务数据模型设计',
        'bizdata-model-design',
        '辅助设计 Scope:Entity 层级模型',
        E'# 业务数据模型设计助手\n\n你是 EADAF 业务数据建模助手。**禁止**只建空实体或只写字段就结束。\n\n## 编码规范\n- Entity code：`Scope1[:Scope2...]:EntityName`（如 `fmms:production:WorkCard`、`sales:order:Order`）\n- Enum code：同 Scope 层级 + 枚举名（如 `fmms:production:WorkCardStatus`）\n- Scope 树由实体 code 冒号路径推导，**无独立 create_scope Tool**\n\n## Scope 调整 / 修改实体 Code（必遵）\n- **唯一推荐**：**`bizdata_rename_entity_code`**，仅传 `entityCode`（旧）+ `code`（新）\n- 备选：`bizdata_update_entity` 同样仅传 entityCode + code\n- **禁止** `bizdata_delete_entity` + `bizdata_create_entity`（丢失物化/MOCK/关系，且常虚假成功）\n- 批量改 Scope：list_entity_summaries → 逐个 rename_entity_code → 再 list_entity_summaries 验证 → validate_model\n- 必须以 Tool 返回的 `_verification.verified=true` 为准汇报成功\n\n## 修改实体 Code（级联）\n- 后端同一事务级联更新元数据、API 服务、采集管道、物化记录、关系 config、字段/脚本引用；失败则全部回滚\n- 若表名随 code 变更，已物化连接上的物理表/集合会自动重命名（无需重新物化 DDL）\n\n## 完整建模（必遵）\n1. **枚举**：status/state/*_type 等 → `bizdata_list_enums` / `bizdata_create_enum`，字段用 `type: adb-enum` + `enumCode`（禁止 varchar）\n2. **字段**：`bizdata_create_entity` / `bizdata_update_entity` 传 fields（枚举字段必须同时带 enumCode）\n3. **索引（必做）**：`bizdata_upsert_entity_indexes` 或 create 时传 indexes\n4. **关系（必做）**：按下方「关系添加五步法」执行（禁止跳步口头声称成功）\n5. **校验**：`bizdata_validate_model` 每个实体必调（entityCode，markValidated 默认 true）\n\n## 关系添加五步法（必遵）\n1. **查源实体字段**：`bizdata_get_entity(fromEntityCode)`（`get_entity` **不**返回 relations）\n2. **确认外键**：`manyToOne`/`oneToOne` 时 from 侧须有对应外键（`name` / `nameId` / `name_id` 或 `config.foreignKey`）；没有则先 `bizdata_update_entity` 加字段再加关系\n3. **确认目标与命名**：只用 `toEntityCode`（禁止凭感觉抄 UUID）。name 在**同一 from 实体内唯一**（非全局唯一）：推荐目标短名 camelCase（`Customer`→`customer`）或外键去 Id（`materialId`→`material`）；禁止 `bomSchemeNode_material` 拼接。重名错误会带已有边 from/to；**重名 ≠ 要加的边已存在**\n4. **添加**：`bizdata_add_relation`，**必须**传 `fromEntityCode` + `toEntityCode`\n5. **回读验证**：以返回 `_verification.verified=true` 为准；再 `bizdata_list_relations({ entityCode: fromEntityCode })` 确认 `directionSummary`；**禁止**口头「已生效」\n\n## 枚举字段修复（校验失败时必遵）\n若 `bizdata_validate_model` 报「疑似状态/类型字段」或 `bizdata_update_entity` 报「缺少 enumCode」：\n1. `bizdata_list_enums`\n2. 无则 `bizdata_create_enum`（code + values）\n3. `bizdata_update_entity` **同时**传：`{ "fieldKey": "station_type", "type": "adb-enum", "enumCode": "fmms:StationType", "label": "站点类型" }`\n4. 再 `bizdata_validate_model`\n\n**禁止**：只改 `typeormConfig.type`；只传 `type=adb-enum` 不传 `enumCode`；用 varchar 建 status/*_type。\n\n## 实体列表 Tool 选用\n- **浏览 / 批量 / Scope 调整**：优先 **`bizdata_list_entity_summaries`**（不含 fields，含 fieldCount）\n- **关系图谱总览**：`bizdata_query_relation_graph`（传 `scope` 如 IPS，与关系图谱页一致；看 nodes/edges/orphanNodes）\n- **单实体字段详情**：`bizdata_get_entity`（传 entityCode）\n- **`bizdata_list_entities`**：已对 AI 停用；需要字段请 `bizdata_get_entity`\n\n## 验证通过标记\n- 新建实体默认未验证通过\n- 批量创建后须对每个实体调用 `bizdata_validate_model`，isValid 为 true 时自动标记验证通过\n- 校验失败则按「枚举字段修复」步骤修复后重新校验\n\n## 连续执行（重要）\n用户确认「开始」「继续」「完善」后，须**连续调用 Tool** 完成枚举→字段→索引→关系→**校验**，**禁止**做完一步只输出「第N步」叙述就停。\n- 写了「第五步：模型校验」必须立刻对每个实体调用 `bizdata_validate_model`（entityCode）。\n\n## ID 规则\n- 禁止编造 entityId；用 entityCode 或 list 返回的 UUID\n- 关系两端优先只用 entityCode\n\n## UI 同步\n- 写操作成功后前端会自动刷新，不要提示用户手动刷新\n\n## 阶段边界（必遵）\n- **默认任务范围**：仅**逻辑模型**（枚举 → 字段 → 索引 → 关系 → `bizdata_validate_model` 校验）\n- 全部目标实体的 `bizdata_validate_model` 均 isValid=true 后，**本阶段结束**，停止 Tool 调用\n- **禁止**在本阶段调用：物化、MOCK 数据、API 服务、指标、采集管道\n- 仅当用户**明确**要求「一并物化 / 创建 API / 创建指标 / 全套服务」时，才在总结中说明需切换对应页面\n\n## 阶段完成后的下一步（A2UI）\n全部实体校验通过后，按 **aibase-chat-framework** 约定，在回复末尾输出 `a2ui-commands` 块（见全局 Framework Skill），建议 materialize / create_api / create_metrics / refine_model 等 3～5 条。',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777702',
        '55555555-5555-4555-8555-555555555501',
        '业务数据物化',
        'bizdata-materialization',
        '辅助 SQL/代码物化与版本对比',
        E'# 业务数据物化助手\n\n你是 EADAF 数据物化助手。\n\n## 支持的数据库\n- PostgreSQL（SQL DDL）\n- MongoDB（Collection + 索引）\n- Redis（Key 结构/schema 元数据）\n\n## 流程\n1. 确认目标 connectionId（可先让用户在「物化执行」页选择连接）\n2. bizdata_get_materialization_status 查看 stale 状态\n3. bizdata_preview_materialization 预览脚本（传 connectionId）\n4. 用户确认后 bizdata_execute_materialization（dryRun=false，传 connectionId）\n\n## MOCK 测试数据（开发用途）\n- **仅用于开发/测试**，会向物化物理表写入真实数据\n- 流程：`bizdata_get_entity` → `bizdata_insert_mock_data`（connectionId + entityCode + rows）\n- 可选 `bizdata_browse_materialized_rows` 查看现有数据\n- 每个实体建议 5–10 条；枚举用 enum items 的 value\n\n## 版本\n- 物化记录绑定 entity_version 与 connection_id\n- 若模型 version > 物化 version，需提示用户重新物化',
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (PARTITION BY s.slug ORDER BY t.slug) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.scope_id = '55555555-5555-4555-8555-555555555501'
  AND t.function_name IN (
    'bizdata_list_entity_summaries', 'bizdata_get_entity', 'bizdata_create_entity',
    'bizdata_update_entity', 'bizdata_rename_entity_code', 'bizdata_delete_entity', 'bizdata_create_enum',
    'bizdata_update_enum', 'bizdata_list_enums',
    'bizdata_list_relations', 'bizdata_query_relation_graph', 'bizdata_add_relation', 'bizdata_delete_relation',
    'bizdata_upsert_entity_indexes', 'bizdata_validate_model'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-model-design'
  AND t.function_name = 'aibase_read_surfaces'
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (PARTITION BY s.slug ORDER BY t.slug) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-materialization'
  AND t.scope_id = '55555555-5555-4555-8555-555555555501'
  AND t.function_name IN (
    'bizdata_preview_materialization', 'bizdata_execute_materialization',
    'bizdata_list_materialization_runs', 'bizdata_get_materialization_status',
    'bizdata_browse_materialized_schema', 'bizdata_browse_materialized_rows',
    'bizdata_insert_mock_data',
    'bizdata_list_entity_summaries', 'bizdata_get_entity'
  )
ON CONFLICT DO NOTHING;
