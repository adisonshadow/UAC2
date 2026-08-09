-- 增量：主实体驱动连接/Schema 推断；SQL 须使用 resolve 返回的 targetSchema
-- 用法：psql "$DATABASE_URL" -f scripts/migrate-apiservice-primary-entity-schema-skill.sql

UPDATE aibase.tools
SET
    name = '推断数据库连接与 Schema',
    description = '按主实体/Scope 物化记录推断 connectionId 与 targetSchema；禁止向用户索要 connectionId。写 SQL 必须使用返回的 targetSchema',
    review_markdown = E'## apiservice_resolve_connection\n\n**禁止**向用户询问 connectionId。\n\n### 推断规则\n1. 仅一个连接 → 直接使用\n2. 有 **主实体**（entityId / entityCodes）→ 按该实体物化记录选连接，并返回物化 `targetSchema`\n3. 仅有 Scope → 选 Scope 下已物化实体最多的连接\n4. 仍无法区分 → 默认连接或 PostgreSQL 连接\n\n### 返回（重要）\n- `connectionId` / `connectionName` / `dbType`\n- **`targetSchema`**：写 `definitionScript`（SQL）时 **必须** 使用 `"<targetSchema>"."<table>"`\n- **禁止**默认写死 `bizdata_mat`；以本 Tool 或 Surface 的 `targetSchema` 为准\n\n### 入参优先级\n- 推荐传 entityId / entityCodes（表单「主实体」）\n- Chat 引用：type=entity → entityCodes；type=scope → scopeCode',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_resolve_connection';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_create_service\n\n- 一个服务 = 一个主 operation；禁止索要 connectionId\n- **推荐**传 entityId（主实体）；省略 connectionId 时按主实体物化推断\n- typescript：函数体 + params + db(实体code)；禁止 queryPg/SQL\n- **sql**：definitionScript 的表名须带 `apiservice_resolve_connection` / Surface 返回的 `targetSchema`，如 `"myschema"."equipment"`\n\n### Handler SDK（必遵）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })` → `{ items, total }`，**禁止** where 写两遍再 getMany+getCount\n- 别名：`count()`=`getCount()`，`find()`=`getMany()`\n- JOIN：`db(''A'',''o'').leftJoin(''B'',''b'',''o.id'',''b.a_id'')`（仅等值 ON）\n- where 操作符：`$gte/$in/$ilike/$isNull` 等\n- params：网关已校验只读；经 SDK 参数化；禁止拼字符串\n- 保存前 `apiservice_check_handler`\n\n### 成功判定\n- `_verification.verified=true`；禁止未调用本 Tool 声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

-- Skills：替换「仅按 Scope 推断」表述，并追加 SQL Schema 规则
UPDATE aibase.skills
SET
    content_markdown = replace(
      content_markdown,
      E'## 数据库连接（重要）\n- **禁止**向用户询问「数据库连接」「connectionId」「选哪个库」\n- 表单已移除连接下拉；系统按 Scope 物化记录自动推断\n- 从 Chat 引用提取：type=scope → scopeCode（单选）；type=entity → entityCodes',
      E'## 数据库连接与 Schema（重要）\n- **禁止**向用户询问「数据库连接」「connectionId」「选哪个库」\n- 表单以 **主实体** 驱动推断：选主实体后自动带出 Scope，并按该实体物化记录推断连接与 **targetSchema**\n- 读 Surface（api-services.create / edit）的 `entityId`、`targetSchema` / `resolvedConnection.targetSchema`\n- 或调用 `apiservice_resolve_connection`（优先传 entityId/entityCodes）\n- **写 SQL（definitionScript）必须**使用推断得到的 schema：`FROM "<targetSchema>"."<table>"`；**禁止**默认写死 `bizdata_mat`\n- TypeScript Handler 用 `db(实体code)`，无需手写 schema\n- 从 Chat 引用提取：type=entity → entityId/entityCodes（推荐）；type=scope → scopeCode'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown LIKE '%系统按 Scope 物化记录自动推断%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## SQL 与 targetSchema（必遵）\n- 写/改 definitionScript 前确认 `targetSchema`（Surface 或 `apiservice_resolve_connection`）\n- 表引用格式：`"schema"."table"`，schema = 推断结果，**禁止**臆造或写死 `bizdata_mat`\n- 主实体优先：有 entityId 时按主实体物化推断，比仅 Scope 更准确',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  )
  AND content_markdown NOT LIKE '%SQL 与 targetSchema（必遵）%';
