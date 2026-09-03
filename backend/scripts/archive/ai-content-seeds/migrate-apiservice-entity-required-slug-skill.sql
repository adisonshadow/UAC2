-- 增量：主实体必选；服务短名=实体末段+操作后缀；隐藏 Scope 选择
-- 用法：psql -h localhost -p 35432 -U my_name -d eadaf_db -f scripts/migrate-apiservice-entity-required-slug-skill.sql

UPDATE aibase.tools
SET
    description = '创建 API 服务；须传 entityId（主实体必选）；短名默认实体末段+Create/Find；sql 用 targetSchema',
    review_markdown = E'## apiservice_create_service\n\n- **主实体必选**：必须传 `entityId`（或可解析的 entityCodes）；禁止无实体创建\n- 一个服务 = 一个主 operation；禁止索要 connectionId\n- **编码（必遵）**\n  - `serviceSlug` 默认 = 实体 code 最后一段 + 主操作后缀（首字母大写驼峰）：Find / FindOne / Create / Update / Delete / Count / Aggregate…\n  - 例：实体 `IPS:analytics:ActualHoursStats` + operation=`create` → slug=`ActualHoursStatsCreate`，code=`IPS:analytics:ActualHoursStatsCreate`\n  - code = 实体去掉最后一段的前缀 + `:` + serviceSlug；用户可改 slug，但须符合字母开头\n  - **不要**再向用户索要独立 Scope；Scope 由实体 code 前缀自动得到\n- typescript：函数体 + params + db(实体code)；禁止 queryPg\n- **sql**：表名须带 `targetSchema`（resolve_connection / Surface）\n\n### 成功判定\n- `_verification.verified=true`；禁止未调用本 Tool 声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_create_services_batch\n\n用户要「CRUD / 全套 API」时使用此工具。\n\n### 创建前\n先 `apiservice_list_services`（codePrefix）避免重复。\n\n### 编码\n- 须有实体：`entityCode` / `entityCodes`\n- 每个 operation 的 code = 实体前缀 + `:` + `末段+后缀`（如 EquipmentFind / EquipmentCreate）\n- 后缀驼峰：Find、Create、Update、Delete…\n\n### 自动生成\n```json\n{ "entityCodes": ["equipment:Equipment"], "namePrefix": "设备" }\n```\n\n### 返回\n- created / skipped（已存在非失败）/ failed',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_services_batch';

UPDATE aibase.skills
SET
    content_markdown = replace(
      content_markdown,
      E'## 编码规范（重要）\n- 优先使用 **scopeCode + serviceSlug** 生成 code，如 scopeCode=sales、serviceSlug=OrderSummary → sales:OrderSummary\n- code **至少两段**；**禁止**把单段 Scope code 当作 API code\n- create 类服务建议：`equipment:EquipmentCreate`（operation=create）',
      E'## 主实体与编码（重要）\n- **主实体必选**（表单 / create Tool 均须 entityId）；禁止无实体创建\n- **不要**再选独立「数据模型 Scope」；Scope 前缀 = 实体 code 去掉最后一段\n- **服务短名**默认 = 实体最后一段 + 主操作后缀（与表单「主操作类型」一致，首字母大写驼峰）：\n  - find→Find，findOne→FindOne，create/insertOne→Create，updateOne→Update，deleteOne→Delete，count→Count，aggregate→Aggregate\n  - 例：`IPS:analytics:ActualHoursStats` + create → slug=`ActualHoursStatsCreate`\n- **code** = `Scope前缀:服务短名`，如 `IPS:analytics:ActualHoursStatsCreate`\n- code **至少两段**；**禁止**把单段 Scope/实体 code 当作 API code；短名可改但须合法'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown LIKE '%优先使用 **scopeCode + serviceSlug** 生成 code%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 主实体必选与短名规则（必遵）\n- 创建/完善 API 必须绑定主实体 `entityId`\n- 服务短名默认：实体 code 最后一段 + 主操作驼峰后缀（Create/Find/Update…），用户可改\n- API code = 实体去掉末段后的前缀 + `:` + 服务短名；勿再单独索要 Scope',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  )
  AND content_markdown NOT LIKE '%主实体必选与短名规则（必遵）%';
