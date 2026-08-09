-- find 分页响应契约：items + pagination{ total, page, pageSize, totalPages, hasNext }
-- 更新 API Service AI Skill / Tool 说明

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_create_service\n\n- 一个服务 = 一个主 operation；禁止索要 connectionId\n- typescript：函数体 + params + db(实体code)；禁止 queryPg/SQL\n- **推荐**传 entityId；省略 connectionId 时按主实体物化推断\n\n### Handler SDK（必遵）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })` → `{ items, pagination }`\n- `pagination` 必含：`total, page, pageSize, totalPages, hasNext`\n- **禁止**仅返回 `{ items, total }` / `{ items, count }`\n- 别名：`count()`=`getCount()`，`find()`=`getMany()`\n- JOIN：`db(''A'',''o'').leftJoin(''B'',''b'',''o.id'',''b.a_id'')`（仅等值 ON）\n- 保存前 `apiservice_check_handler`\n\n### 响应文档（find 必遵）\n- `responseOverrides`：`data.items` + `data.pagination{ total, page, pageSize, totalPages, hasNext }`\n- Tool 未传时会自动补全默认 Schema/Example；仍须回读确认\n\n### 成功判定\n- `_verification.verified=true`；find 时 `hasPaginationDocs=true`',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_update_service\n\n定位：serviceId / code / scopeCode+serviceSlug。\n\n### TypeScript Handler\n- 用 `paginate` → `{ items, pagination }`；禁止双重 where；禁止 queryPg\n- 保存前 `apiservice_check_handler`\n\n### 响应文档（完善时必遵）\n- find：**必须**写入 `responseOverrides`，形状为 `data.items` + `data.pagination`\n- pagination 字段：`total, page, pageSize, totalPages, hasNext`（全部必须）\n- **禁止**仅平铺 `total`/`count`；**禁止** `"item": null`\n- 未传或文档不完整时 Tool 会自动补全默认 pagination Schema/Example\n\n### 更新后校验顺序（必遵）\n1. （可选）测前 `apiservice_get_service` 确认非占位\n2. `apiservice_run_test`\n3. **一旦 success=true（及 verified）→ 立即汇报并 STOP**\n4. **禁止**测试成功后再 `get_service` / `read_surfaces`「查看完整 handler」\n5. **禁止**仅 update 成功就声称完善/测试通过',
    description = '更新 API 服务；find 须补全 items+pagination 响应文档；测前可 get_service，测过后禁止循环回读',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 分页响应契约（find，全链路必遵）\n所有列表分页 API 的 `data` 必须为：\n```json\n{\n  "items": [],\n  "pagination": {\n    "total": 53,\n    "page": 1,\n    "pageSize": 10,\n    "totalPages": 6,\n    "hasNext": true\n  }\n}\n```\n- Handler：`return await db(...).paginate({ limit, skip })`（SDK 已返回 pagination）\n- 请求参数仍为 `limit`/`skip`\n- 完善时须写入 `responseOverrides`；禁止仅 `items+total`\n- 详见 docs/eadaf-api-skill/SKILL.md 与 external-app-integration-guide.md',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
)
  AND content_markdown NOT LIKE '%分页响应契约（find，全链路必遵）%';
