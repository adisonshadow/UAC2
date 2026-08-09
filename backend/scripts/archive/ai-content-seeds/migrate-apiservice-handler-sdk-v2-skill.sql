-- 增量：Handler SDK paginate/join/count + 测试成功后收束（禁止循环 get_service）
-- 用法：psql -f scripts/migrate-apiservice-handler-sdk-v2-skill.sql

UPDATE aibase.tools
SET
    description = '创建 API 服务；typescript 用 params+db（paginate/count/leftJoin），须先 check_handler',
    review_markdown = E'## apiservice_create_service\n\n- 一个服务 = 一个主 operation；禁止索要 connectionId\n- typescript：函数体 + params + db(实体code)；禁止 queryPg/SQL\n\n### Handler SDK（必遵）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })` → `{ items, total }`，**禁止** where 写两遍再 getMany+getCount\n- 别名：`count()`=`getCount()`，`find()`=`getMany()`\n- JOIN：`db(''A'',''o'').leftJoin(''B'',''b'',''o.id'',''b.a_id'')`（仅等值 ON）\n- where 操作符：`$gte/$in/$ilike/$isNull` 等\n- params：网关已校验只读；经 SDK 参数化；禁止拼字符串\n- 保存前 `apiservice_check_handler`\n\n### 成功判定\n- `_verification.verified=true`；禁止未调用本 Tool 声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

UPDATE aibase.tools
SET
    description = '更新 API 服务；typescript 用 paginate/count/join；测前可 get_service，测过后禁止循环回读',
    review_markdown = E'## apiservice_update_service\n\n定位：serviceId / code / scopeCode+serviceSlug。\n\n### TypeScript Handler\n- 用 `paginate` / `count` / `leftJoin`；禁止双重 where；禁止 queryPg\n- 保存前 `apiservice_check_handler`\n\n### 更新后校验顺序（必遵）\n1. （可选）测前 `apiservice_get_service` 确认非占位\n2. `apiservice_run_test`\n3. **一旦 success=true（及 verified）→ 立即汇报并 STOP**\n4. **禁止**测试成功后再 `get_service` / `read_surfaces`「查看完整 handler」\n5. **禁止**仅 update 成功就声称完善/测试通过',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

UPDATE aibase.tools
SET
    description = '执行 API 测试；success+verified 后立即收束，禁止再 get_service 看 handler',
    review_markdown = E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true`（或等价成功信封）才可声称测试通过\n- `executable: false` / 仅校验 **不算** 测试通过\n\n### 收束（必遵，防循环）\n- 测试**成功后立即向用户汇报并结束本轮**，可附带 preview 摘要\n- **禁止**成功后再调用 `apiservice_get_service` / `aibase_read_surfaces` / `apiservice_check_handler`「确认完整 handler」\n- **禁止**成功后再改 handler 除非用户明确要求继续修改\n- `get_service` 只允许在**测试前**（update 之后）用于确认非占位脚本',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_run_test';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_check_handler\n\n返回 `{ ok, diagnostics }`。\n\n- 修改 handler 后、create/update **之前**调用\n- run_test **之前**（typescript）\n- **禁止**在 run_test 已成功后再调用本 Tool「再确认一遍」\n\n### SDK\n- `paginate` / `count` / `leftJoin` / where `$gte|$in|$ilike`\n- 禁止 queryPg',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_check_handler';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_get_service\n\n定位：serviceId / code / scopeCode+serviceSlug。\n\n### 调用时机\n- **允许**：完善流程中、`run_test` **之前**，确认脚本非占位、interface 完整\n- **禁止**：`run_test` 已 success 后再调用「查看完整 handler」——会导致无意义循环',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_get_service';

-- Skills：追加收束 + SDK 段落（若不存在）
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## Handler SDK（paginate / join / count）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })`，禁止 where 写两遍\n- `count()` 别名可用；`leftJoin(entity, alias, leftCol, rightCol)` 仅等值 ON\n- where：`$gte/$in/$ilike/$isNull`；params 经 SDK 参数化，禁止拼字符串 / queryPg\n\n## 测试成功后收束（必遵）\n- `apiservice_run_test` 一旦 success=true（及 verified）→ **立即汇报并结束**\n- **禁止**测试成功后再 `apiservice_get_service` / `aibase_read_surfaces`「查看完整 handler」\n- `get_service` 仅测前用于确认非占位',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  )
  AND content_markdown NOT LIKE '%测试成功后收束（必遵）%';
