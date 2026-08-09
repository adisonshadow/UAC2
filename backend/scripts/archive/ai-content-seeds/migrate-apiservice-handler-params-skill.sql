-- 增量：TypeScript Handler 参数契约（interface SSOT + queryPg :name 绑定）
-- 用法：psql -f scripts/migrate-apiservice-handler-params-skill.sql

UPDATE aibase.tools
SET
    description = '创建 API 服务；typescript 时须同步 requestParameterInterface 与 handlerScript（:param / ctx.params）',
    review_markdown = E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId；使用 **scopeCode + serviceSlug** 或 code\n- enabledOperations **只传一项**，如 `["create"]`\n- scriptMode=typescript 时写 handlerScript，否则写 definitionScript（SQL）\n- tags 为 **string[]**\n\n### TypeScript Handler 契约（必遵）\n1. **requestParameterInterface** 声明全部请求字段（唯一真相源），如 `nearest_only?: boolean`\n2. Handler：`export async function handler(ctx)`，用 `ctx.params.xxx` 读参\n3. `queryPg(sql)` 可用 `:xxx`（框架从 params 参数化绑定）或 `$n` + 数组；可选参数推荐 `(:foo IS NULL OR col = :foo)`\n4. **禁止**只在 Handler 写 `:foo` / `params.foo` 却不写 interface\n5. 同步 `requestOverrides[].requestExample`\n6. find 建议 interface 含 `limit?`/`skip?`，SQL 使用 `:limit`/`:skip`\n\n### 请求 / 响应文档\n- `requestParameterInterface` + `requestOverrides` + `responseOverrides`\n- **禁止** Response Example 中 `data.item: null`\n\n### 成功判定（必须）\n- Tool 返回 `id` 且 `_verification.verified=true`\n- `_verification.listedInApiList=true`\n- **禁止**未调用本 Tool 就声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

UPDATE aibase.tools
SET
    description = '更新 API 服务；typescript 须保持 interface 与 Handler :param/ctx.params 一致',
    review_markdown = E'## apiservice_update_service\n\nserviceId 或 code 定位；可更新 scriptMode、handlerScript、requestParameterInterface、responseOverrides、requestOverrides 等。\n\n### SQL 脚本\n- **禁止**占位 SQL：`SELECT 1` 等\n- **create**：definitionScript 为物化表结构参考（`WHERE 1=0`）\n- **find**：含 `:limit`、`:skip` 等命名参数\n\n### TypeScript Handler 契约（必遵）\n1. `requestParameterInterface` 为参数唯一真相源（含自定义如 `nearest_only?: boolean`）\n2. `export async function handler(ctx)`；`ctx.params` 读参\n3. `queryPg`：`:name` 由框架绑定 params，或 `$n`+数组；**禁止**只写 `:foo` 不写 interface\n4. 同步 `requestOverrides` 请求 Example\n5. 可选布尔过滤推荐：`WHERE (:nearest_only IS NULL OR flag = :nearest_only)`\n\n### 响应文档\n- 须同步 `responseOverrides` / `requestOverrides`\n- **禁止** `"item": null`\n\n### 更新后校验\n1. `apiservice_get_service` 回读\n2. `apiservice_run_test` success=true 才可声称测试通过\n3. **禁止**仅 update 成功就声称完善成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

UPDATE aibase.tools
SET
    description = '按实体字段、SQL/Handler 命名参数与 requestParameterInterface 生成测试 mock',
    review_markdown = E'## apiservice_suggest_test_params\n\n调用后通过 mutation 将 mockParameters 写入测试弹窗。\n\n优先根据：实体字段、SQL `:param`、**TypeScript Handler 发现的命名参数**、以及 `requestParameterInterface` 生成示例值。typescript 模式务必覆盖 interface 中的自定义字段（如 nearest_only）。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_suggest_test_params';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## TypeScript Handler 参数契约（必遵）\n- `requestParameterInterface` 为唯一真相源；Handler 内 `:param` / `ctx.params.xxx` 必须已声明\n- `queryPg(sql)` 支持 `:name` 自动绑定 params；可选参数写 `(:foo IS NULL OR col = :foo)`\n- **禁止**只改 handlerScript 不改 interface / requestExample\n- 完善时三者一起 `apiservice_update_service`：interface + handlerScript + requestOverrides',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown NOT LIKE '%TypeScript Handler 参数契约（必遵）%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## TypeScript Handler 参数契约（必遵）\n- interface 声明全部请求字段（含 `nearest_only` 等自定义参数）\n- Handler 用 `ctx.params`；`queryPg` 可用 `:xxx`（框架绑定）或 `$n`\n- **禁止** Handler 使用未在 interface 声明的命名参数\n- 编辑完善须同步 interface + Example + Handler，再 `apiservice_run_test`',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%TypeScript Handler 参数契约（必遵）%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## TypeScript Handler / 命名参数\n- 报「命名参数未填」或参数面板缺字段：先补 `requestParameterInterface` 与 `requestOverrides.requestExample`，再 `set_test_params`\n- Handler 内 `:foo` 须与 interface 一致；可用 `suggest_test_params` 生成含自定义字段的 mock',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-test-fix'
  AND content_markdown NOT LIKE '%TypeScript Handler / 命名参数%';
