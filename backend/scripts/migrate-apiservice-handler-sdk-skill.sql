-- 增量：TypeScript Handler SDK（函数体 + db/params）与语法检查 Tool
-- 用法：psql -f scripts/migrate-apiservice-handler-sdk-skill.sql

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
) VALUES (
    '66666666-6666-4666-8666-666666666637',
    '55555555-5555-4555-8555-555555555501',
    '检查 TypeScript Handler',
    'apiservice-check-handler',
    'apiservice_check_handler',
    '对 TypeScript Handler 做语法/类型检查（行级诊断）；保存与测试前必须先通过',
    'client',
    '{"type":"object","properties":{"handlerScript":{"type":"string","description":"Handler 脚本（推荐只写函数体）"},"requestParameterInterface":{"type":"string","description":"请求参数 TS interface，用于 params 类型"}},"required":["handlerScript"]}'::jsonb,
    E'## apiservice_check_handler\n\n对 Handler 做 **tsc 级**语法/类型检查，返回 `{ ok, diagnostics:[{ line, column, message }] }`。\n\n### 何时调用（必遵）\n1. 编写或修改 `handlerScript` 后、调用 `apiservice_create_service` / `apiservice_update_service` **之前**\n2. `apiservice_run_test` **之前**（typescript 模式）\n3. 诊断未通过时：按行号修复后再次检查，**禁止**强行保存/测试\n\n### Handler 新契约\n- 推荐**只写函数体**（无需 `export async function handler`）\n- 用只读 `params` 读参；用 `db(实体code).where(...).getMany()` 等，**禁止** `queryPg` / 手写 SQL / 物化表名\n- `requestParameterInterface` 声明全部 `params.xxx`',
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

UPDATE aibase.tools
SET
    description = '创建 API 服务；typescript 时写函数体 Handler（params+db SDK），须先 apiservice_check_handler 通过',
    review_markdown = E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId；使用 **scopeCode + serviceSlug** 或 code\n- enabledOperations **只传一项**，如 `["create"]`\n- scriptMode=typescript 时写 handlerScript，否则写 definitionScript（SQL）\n- tags 为 **string[]**\n\n### TypeScript Handler 契约（必遵）\n1. **requestParameterInterface** 声明全部请求字段（唯一真相源）\n2. Handler **推荐只写函数体**（框架自动包裹）；用只读 `params` 读参\n3. 用 `db(实体code)`（TypeORM 风格）访问数据：`.where({}).orderBy().take().skip().getMany()/getOne()/getCount()/insert/update/delete`\n4. **禁止** `queryPg`、手写 SQL、物化表名（如 `"bizdata_mat"."xxx"`）\n5. 保存前必须 `apiservice_check_handler` 通过（行级诊断）\n6. 同步 `requestOverrides[].requestExample`\n\n### 成功判定（必须）\n- Tool 返回 `id` 且 `_verification.verified=true`\n- `_verification.listedInApiList=true`\n- **禁止**未调用本 Tool 就声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

UPDATE aibase.tools
SET
    description = '更新 API 服务；typescript 须 params+db SDK，先 apiservice_check_handler 再保存',
    review_markdown = E'## apiservice_update_service\n\nserviceId 或 code 定位；可更新 scriptMode、handlerScript、requestParameterInterface、responseOverrides、requestOverrides 等。\n\n### SQL 脚本\n- **禁止**占位 SQL：`SELECT 1` 等\n- **create**：definitionScript 为物化表结构参考（`WHERE 1=0`）\n- **find**：含 `:limit`、`:skip` 等命名参数\n\n### TypeScript Handler 契约（必遵）\n1. `requestParameterInterface` 为参数唯一真相源\n2. Handler **只写函数体**；`params` 读参；`db(实体code)` 查改删\n3. **禁止** `queryPg` / 原始 SQL / 物化表名\n4. 修改 handler 后必须先 `apiservice_check_handler`，通过后再本 Tool 保存\n5. 同步 `requestOverrides` 请求 Example\n\n### 更新后校验\n1. `apiservice_get_service` 回读\n2. `apiservice_run_test` success=true 才可声称测试通过\n3. **禁止**仅 update 成功就声称完善成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

UPDATE aibase.tools
SET
    description = '按实体字段、Handler params 与 requestParameterInterface 生成测试 mock',
    review_markdown = E'## apiservice_suggest_test_params\n\n调用后通过 mutation 将 mockParameters 写入测试弹窗。\n\n优先根据：实体字段、`requestParameterInterface`、Handler 中 `params.xxx` 生成示例值。typescript 模式务必覆盖 interface 自定义字段。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_suggest_test_params';

-- 关联到 create / manage / test-fix skills
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 50
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  )
  AND t.function_name = 'apiservice_check_handler'
ON CONFLICT DO NOTHING;

UPDATE aibase.skills
SET
    content_markdown = regexp_replace(
        content_markdown,
        E'## TypeScript Handler 参数契约（必遵）[\\s\\S]*?(?=\\n## |$)',
        E'## TypeScript Handler 契约（必遵）\n- 推荐**只写函数体**（无需 export handler）；用只读 `params` + `db(实体code)`\n- 示例：`await db(''fmms:WorkCard'').where({ status: params.status }).take(20).getMany()`\n- **禁止** `queryPg`、手写 SQL、物化表名\n- `requestParameterInterface` 声明全部 `params.xxx`\n- 保存/测试前必须 `apiservice_check_handler` 通过（按行修复）\n- 创建/更新时同步 interface + handlerScript + requestOverrides\n\n',
        'g'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('bizdata-api-service-create', 'bizdata-api-service-manage')
  AND content_markdown LIKE '%TypeScript Handler%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## TypeScript Handler SDK / 语法检查（必遵）\n- Handler **只写函数体**：`params` 读参，`db(实体code).where().getMany()` 等访问数据\n- **禁止** `queryPg` / SQL / 物化表名\n- 修改 Handler 后先 `apiservice_check_handler`，diagnostics 按行修复后再 `apiservice_update_service` / `apiservice_run_test`\n- 语法错误（含 queryPg 残留）会导致保存与测试被拒绝',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-test-fix'
  AND content_markdown NOT LIKE '%apiservice_check_handler%';

UPDATE aibase.skills
SET
    content_markdown = CASE
      WHEN content_markdown LIKE '%apiservice_check_handler%' THEN content_markdown
      ELSE content_markdown || E'\n\n## TypeScript Handler SDK / 语法检查（必遵）\n- Handler 只写函数体：`params` + `db(实体code)`；禁止 queryPg/SQL\n- 保存前必须 `apiservice_check_handler` 通过'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('bizdata-api-service-create', 'bizdata-api-service-manage')
  AND content_markdown NOT LIKE '%apiservice_check_handler%';
