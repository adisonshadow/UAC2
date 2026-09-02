-- 修复 AI 建模→物化三类空转（幂等）
-- 1) execute Tool schema 暴露 connectionId / createTargetIfMissing
-- 2) 建模 Skill：索引示例 + 禁止用残缺 layout 覆盖 indexes + 校验失败须先 upsert
-- 3) 物化 Skill：409 TARGET_NOT_FOUND → ask_user → createTargetIfMissing=true；连接 Tool 不建物理库
-- 4) 框架 Skill：run_code 中 tools 不是数组的正确写法
-- 5) create_database_connection review：明确不 CREATE DATABASE

-- ---------------------------------------------------------------------------
-- 1. bizdata_execute_materialization：参数 + review
-- ---------------------------------------------------------------------------
UPDATE aibase.tools SET
    parameters_schema = '{
      "type": "object",
      "properties": {
        "dryRun": { "type": "boolean", "description": "true=仅预览；正式执行须 false" },
        "entityIds": { "type": "array", "items": { "type": "string" } },
        "targetSchema": { "type": "string", "description": "目标 Schema；MySQL 下即库名，缺省用连接上的 targetSchema" },
        "connectionId": { "type": "string", "description": "数据库连接 UUID；多连接时必传" },
        "expectedVersions": { "type": "object", "additionalProperties": { "type": "integer" } },
        "createTargetIfMissing": {
          "type": "boolean",
          "description": "目标 Schema/库不存在时是否自动创建。默认 false；仅在用户确认后传 true"
        }
      }
    }'::jsonb,
    review_markdown = E'## bizdata_execute_materialization

执行前确认 `dryRun=false`。多连接时传 `connectionId`。

### 目标 Schema/库不存在（409 / TARGET_NOT_FOUND）
1. **不要**同参重试、重载 Skill、或用 `http_request`/`run_code` 探路
2. 用 `ask_user` 询问：是否创建目标 Schema/库（MySQL 下 Schema 即库）并继续物化
3. 用户同意后：**相同参数** + `createTargetIfMissing=true` 再调本 Tool
4. `bizdata_create_database_connection` **只登记 EADAF 连接元数据**，不会在 MySQL/PG 上 CREATE DATABASE/SCHEMA

### 成功标准
返回成功后本阶段结束，停止继续堆 Tool。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_execute_materialization';

-- ---------------------------------------------------------------------------
-- 2. bizdata_upsert_entity_indexes：补 payload 示例
-- ---------------------------------------------------------------------------
UPDATE aibase.tools SET
    review_markdown = E'## bizdata_upsert_entity_indexes

**每个实体建完字段后必做**。主键/唯一/外键/status 等查询字段均需索引。

### 示例
```json
{
  "entityCode": "FPV:Drone",
  "indexes": [
    { "name": "pk_id", "fields": ["id"], "unique": true },
    { "name": "uk_serial_no", "fields": ["serial_no"], "unique": true },
    { "name": "idx_status", "fields": ["status"] },
    { "name": "idx_squad_id", "fields": ["squad_id"] }
  ]
}
```

- 默认按 `name` 合并；`replaceIndexes=true` 全量替换
- **禁止**用 `bizdata_update_entity` 传残缺 `layout` 代替本 Tool（会误清空 indexes）
- 校验报缺索引时：先调本 Tool，再 `bizdata_validate_model`；禁止同参重复 validate',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_upsert_entity_indexes'
  AND (review_markdown IS NULL OR review_markdown NOT LIKE '%pk_id%');

-- ---------------------------------------------------------------------------
-- 3. bizdata_create_database_connection：强调不建物理库
-- ---------------------------------------------------------------------------
UPDATE aibase.tools SET
    review_markdown = CASE
      WHEN review_markdown LIKE '%不建物理库%' OR review_markdown LIKE '%不会 CREATE DATABASE%' THEN review_markdown
      ELSE review_markdown || E'\n\n### 重要\n本 Tool **只写入 EADAF 连接元数据**，**不会**在目标服务器上 `CREATE DATABASE` / `CREATE SCHEMA`。物理库由物化执行在用户确认后通过 `createTargetIfMissing=true` 创建。'
    END,
    description = CASE
      WHEN description LIKE '%不建物理库%' THEN description
      ELSE description || '（只登记连接，不建物理库）'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_database_connection';

-- ---------------------------------------------------------------------------
-- 4. 建模 Skill：索引纪律（追加段落，幂等）
-- ---------------------------------------------------------------------------
UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 索引纪律（必遵，空转修复）\n'
      || E'- 每个实体建完字段后必须 `bizdata_upsert_entity_indexes`（或 create 时传 indexes）\n'
      || E'- 示例：`bizdata_upsert_entity_indexes({ entityCode: "FPV:Drone", indexes: [{ name: "pk_id", fields: ["id"], unique: true }, { name: "idx_status", fields: ["status"] }] })`\n'
      || E'- **禁止**用 `bizdata_update_entity` 传残缺 `layout` 代替 upsert（会清空已有 indexes）\n'
      || E'- `bizdata_validate_model` 报缺索引时：先 upsert 再 validate，**禁止同参重复 validate**\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%索引纪律（必遵，空转修复）%';

-- ---------------------------------------------------------------------------
-- 5. 物化 Skill：409 处理 + 连接不建库 + 禁止探路
-- ---------------------------------------------------------------------------
UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 目标 Schema/库不存在（必遵）\n'
      || E'- MySQL：`targetSchema` 即目标库（Schema=Database），缺省常为 `bizdata_mat`\n'
      || E'- `bizdata_execute_materialization` 返回 409 / `TARGET_NOT_FOUND`（或提示库不存在）时：\n'
      || E'  1. **立即停止**同参重试；禁止重载 Skill、禁止 `http_request` OPTIONS/GET 探物化接口、禁止 `run_code` 探 Tool\n'
      || E'  2. 用 `ask_user` 问用户：是否创建该目标库/Schema 并继续物化\n'
      || E'  3. 用户同意后，**相同参数**加 `createTargetIfMissing=true` 再执行\n'
      || E'- `bizdata_create_database_connection` **只登记连接**，不会在 MySQL/PG 上建库；建库只能走上面的 `createTargetIfMissing`\n'
      || E'- 加载本 Skill 后直接 native 调用 `bizdata_list_database_connections` / `bizdata_execute_materialization` 等，禁止用 `run_code` 发现能力\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown NOT LIKE '%createTargetIfMissing=true%';

-- ---------------------------------------------------------------------------
-- 6. 框架 Skill：run_code tools API 形态
-- ---------------------------------------------------------------------------
UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## run_code 脚本 API（若使用）\n'
      || E'- `tools` **不是数组**：禁止 `tools.filter` / `tools.map` / `tools.find`\n'
      || E'- 正确：\n'
      || E'```javascript\n'
      || E'const names = tools.list(); // 同步 string[]\n'
      || E'const hits = names.filter(n => n.includes("bizdata_"));\n'
      || E'const row = await tools[hits[0]]({ /* args */ });\n'
      || E'```\n'
      || E'- 有专用业务 Tool 时必须直接 native 调用，禁止用 `run_code` 探路或 `tools.list()`「发现」能力\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'aibase-chat-framework'
  AND content_markdown NOT LIKE '%tools.list(); // 同步 string[]%';
