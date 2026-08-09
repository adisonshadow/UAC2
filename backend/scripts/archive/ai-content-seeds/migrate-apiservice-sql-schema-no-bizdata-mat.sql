-- 清理 Tool/Skill 中仍以 bizdata_mat 作 SQL 示例的教学文案
-- （连接默认 schema 常为 bizdata_mat，但实体物化可能是 public；AI 不得写死系统默认名）

UPDATE aibase.tools
SET
  review_markdown = replace(
    review_markdown,
    E'FROM "bizdata_mat"."equipment"',
    E'FROM "<targetSchema>"."<table>"'
  )
WHERE review_markdown LIKE '%FROM "bizdata_mat"."equipment"%';

UPDATE aibase.tools
SET
  review_markdown = replace(
    review_markdown,
    E'FROM "bizdata_mat".',
    E'FROM "<targetSchema>".'
  )
WHERE review_markdown LIKE '%FROM "bizdata_mat".%';

UPDATE aibase.skills
SET
  content_markdown = replace(
    content_markdown,
    E'FROM "bizdata_mat".',
    E'FROM "<targetSchema>".'
  )
WHERE content_markdown LIKE '%FROM "bizdata_mat".%';

-- update_service：create 类 SQL 示例改为占位 schema
UPDATE aibase.tools
SET
  review_markdown = E'## apiservice_update_service\n\nserviceId 或 code 定位服务；可更新 scopeCode、serviceSlug、scriptMode、handlerScript、requestParameterInterface、accessRestriction、transportProtocols、responseOverrides、requestOverrides；仅传需修改字段。\n\n### SQL 脚本（重要）\n- **禁止**写入占位 SQL：`SELECT 1`、`SELECT 1 AS result`、与业务无关的常量查询\n- **create** 类（operation=create）：definitionScript 应为绑定实体物化表的结构参考，例如：\n  ```sql\n  SELECT *\n  FROM "<targetSchema>"."<table>"\n  WHERE 1 = 0\n  ```\n  schema 必须来自 `apiservice_resolve_connection` / Surface / 物化记录的 `targetSchema`，**禁止**写死 `bizdata_mat`\n  运行时由 Gateway 根据 body 执行 INSERT，不是靠 SELECT 写入\n- **find** 类：须 `FROM` 物化表或合理子查询；**禁止** SQL 内 `LIMIT`/`OFFSET`（分页由网关按 limit/skip 施加）\n- **typescript**：handler 须用 params + db(实体code)；禁止 queryPg / 手写物化表名\n\n### 响应文档（重要）\n- 完善/编辑时**必须**同步 `responseOverrides` 与 `requestOverrides`\n- **禁止** `responseExample` 中 `"item": null`；须写入含实体字段的完整示例对象\n- find 的 `items` 数组至少一条示例记录，且含 `pagination`\n\n### 更新后校验顺序（必遵）\n1. （可选）测前 `apiservice_get_service` 确认非占位\n2. `apiservice_run_test`\n3. **一旦 success=true（及 verified）→ 立即汇报并 STOP**\n4. **禁止**测试成功后再 `get_service` / `read_surfaces`「查看完整 handler」\n5. **禁止**仅 update 成功就声称完善/测试通过'
WHERE function_name = 'apiservice_update_service';

-- batch：显式要求 SQL 使用推断的 targetSchema
UPDATE aibase.tools
SET
  review_markdown = E'## apiservice_create_services_batch\n\n用户要「CRUD / 全套 API」时使用此工具，**不要**对 create_service 传多个 operation。\n\n### 创建前\n先 `apiservice_list_services`（codePrefix）查看是否已有服务，避免重复创建。\n\n### 自动生成（推荐）\n```json\n{ "entityCodes": ["equipment:Equipment","equipment:Maintenance"], "namePrefix": "设备" }\n```\n- code 自动生成：`equipment:EquipmentFind`、`equipment:EquipmentCreate` …\n- connectionId / targetSchema 省略，**按实体物化记录推断**\n- 生成的 definitionScript 使用物化 `targetSchema`（如 `"public"."equipment"`），**禁止**写死 `bizdata_mat`\n\n### 返回解读\n- `created`：新创建成功；关注返回的 `targetSchema`\n- `skipped`：code 已存在（**不是失败**）\n- `failed`：展示 `error` 原文，**禁止**默认归咎「未物化」\n\n### 显式列表\n传 `services` 数组，每项一个 operation；若自带 definitionScript，schema 须与物化一致。'
WHERE function_name = 'apiservice_create_services_batch';
