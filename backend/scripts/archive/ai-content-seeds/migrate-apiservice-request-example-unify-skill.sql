-- 请求参数 Example 统一：编辑页 / 测试页 / mock 同源（requestOverrides[operation].requestExample）
-- 对齐前端 Tool 与表单 v3（GET 可编辑参数面板、AI 生成参数 mutation 同步）

-- Tool: create_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        parameters_schema,
        '{properties,requestOverrides}',
        '{"type":"object","description":"按 operation 保存请求参数 Example（与测试页 mock 同源）；未传时创建后自动生成带示例值的默认 Example"}'::jsonb
    ),
    review_markdown = E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId；使用 **scopeCode + serviceSlug** 或 code\n- enabledOperations **只传一项**，如 `["create"]`\n- scriptMode=typescript 时写 handlerScript，否则写 definitionScript（SQL）\n- tags 为 **string[]**（标签输入组件，非逗号字符串）\n\n### 请求 / 响应文档（v3 表单）\n- `requestParameterInterface`：设计期 TS interface\n- `requestOverrides`：按 operation 保存**请求参数 Example**（与测试页 mock **同一数据**）\n- Example **须有具体示例值**（如 `limit:10`、`id` UUID、`body` 含实体字段），禁止仅空字符串/空对象占位\n- 未传 `requestOverrides` 时，创建成功后会自动 suggest 并持久化默认 Example\n- `responseOverrides`：按 operation 保存 Responses Schema + Response Example\n- **禁止** Response Example 中 `data.item: null` 或空占位；须根据 `bizdata_get_entity` 字段生成具体示例\n\n### 成功判定（必须）\n- Tool 返回 `id` 且 `_verification.verified=true`\n- **禁止**未调用本 Tool 就声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

-- Tool: update_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        parameters_schema,
        '{properties,requestOverrides}',
        '{"type":"object","description":"按 operation 保存请求参数 Example（与测试 mock 同源），须含具体示例值"}'::jsonb
    ),
    review_markdown = E'## apiservice_update_service\n\nserviceId 或 code 定位服务；可更新 scopeCode、serviceSlug、scriptMode、handlerScript、requestParameterInterface、accessRestriction、transportProtocols、responseOverrides、requestOverrides；仅传需修改字段。\n\n### 请求参数 Example（重要）\n- `requestOverrides[operation].requestExample` 与测试页「请求参数 Example」**同源**\n- 完善/编辑时**必须**写入含具体字段值的 Example，禁止仅空结构\n- GET 类：query 字段示例值；写操作：含 `body` / `set` 等合理示例\n\n### SQL 脚本（重要）\n- **禁止**占位 SQL：`SELECT 1`、`SELECT 1 AS result`\n- **create** 类：物化表 `WHERE 1=0` 结构参考或合理 handler\n- **find** 类：完整 `FROM` 物化表查询，含 `:limit`、`:skip` 等命名参数\n\n### 响应文档（重要）\n- 完善时**必须**同步 `responseOverrides` 与 `requestOverrides`\n- **禁止** `responseExample` 中 `"item": null`\n\n### 更新后校验（必须）\n1. `apiservice_get_service` 回读脚本与 overrides\n2. 用户要求可测试时：**必须** `apiservice_run_test` 且 `success=true`\n3. **禁止**仅 update 成功就声称「完善成功」',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

-- Tool: get_test_profile
UPDATE aibase.tools
SET
    description = '获取 API 服务测试上下文：参数结构、请求参数 Example、请求预览',
    review_markdown = E'## apiservice_get_test_profile\n\n返回 enabledOperations 列表，每项含：\n- `parameterSchema`：运行时 JSON Schema\n- `mockParameters`：**请求参数 Example**（来自 `security_config.requestOverrides[operation].requestExample`，兼容历史 testMockParameters）\n- `mockParametersSource`：`saved` 表示已持久化 Example，`generated` 为系统生成默认\n- `requestPreview`：HTTP 方法与 URL 预览\n\n测试页可用 `aibase_read_surfaces`（surfaceId=api-services.test）读取当前 `parametersText`。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_get_test_profile';

-- Tool: suggest_test_params
UPDATE aibase.tools
SET
    description = '生成并保存请求参数 Example（与编辑页同源），mutation 同步测试页表单',
    review_markdown = E'## apiservice_suggest_test_params\n\n### 作用\n1. 按实体字段 / SQL 命名参数生成**带具体示例值**的 Example\n2. **持久化**到 `security_config.requestOverrides[operation].requestExample`（同步 testMockParameters）\n3. 通过 mutation `apiservice.test_params.suggested` 将 `mockParameters` 写入测试页 `parametersText`\n\n### 调用时机\n- 用户点击「AI 生成参数」或需要合理测试入参时\n- 完善/创建后校验前（create 须有合理 `body`）\n\n### 禁止\n- **禁止**未调用本 Tool（或 set_test_params）就声称已更新测试页参数\n- 生成后须让用户在表单中看到更新后的 JSON / Query 面板值',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_suggest_test_params';

-- Tool: set_test_params
UPDATE aibase.tools
SET
    description = '保存请求参数 Example（与编辑页一致）并 mutation 同步测试页表单',
    review_markdown = E'## apiservice_set_test_params\n\n传 operation（必填）+ parameters 或 mockParameters（完整 JSON 对象）。\n\n### 作用\n- **持久化**到 `security_config.requestOverrides[operation].requestExample`（同步 testMockParameters）\n- mutation `apiservice.test_params.set` 同步到 surfaceId=api-services.test 的 `parametersText`\n\n### 调用时机（重要）\n- `apiservice_suggest_test_params` 之后、`apiservice_run_test` 使用相同 parameters 之前或之后\n- 参数类修复：`run_test` **执行成功后**必须调用（传与 run_test 相同的 operation + parameters）\n- **禁止**仅 run_test 成功就结束而不保存\n\n### 禁止\n- **禁止**未调用本 Tool 就声称 mock / 请求参数 Example 已保存',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_set_test_params';

-- Tool: run_test
UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true` 才可声称测试通过\n- `success: false` 须展示 `error` / `validationErrors`\n- `executable: false` **不算** 测试通过\n- create 类：`preview` 应含 `item` 或有效写入结果\n- **禁止**未调用本 Tool 就声称测试通过\n\n### 参数同步（重要）\n- 成功时返回 `savedMockParameters`；mutation `test_completed` 会同步到测试页 `parametersText`\n- **仍须**接着 `apiservice_set_test_params` 显式保存（传相同 operation + parameters），与 suggest 持久化规则一致\n\n执行测试并将结果同步到测试页（mutation: test_completed）。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_run_test';

-- Skill: create
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 请求参数 Example（与测试页统一）\n- 编辑/创建页「请求参数 Example」= 测试页表单 = `requestOverrides[operation].requestExample`\n- **必须含具体示例值**（非空结构）；有实体时参考 `bizdata_get_entity` 字段\n- 未传 `requestOverrides` 时，`apiservice_create_service` 成功后会自动 suggest 并保存默认 Example\n- GET：右侧可编辑 Query 面板；POST/写操作：JSON Example 编辑器',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown NOT LIKE '%请求参数 Example（与测试页统一）%';

-- Skill: manage
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 请求参数 Example（与测试页统一）\n- `requestOverrides` 与测试页 mock **同源**；完善时须写入带示例值的 Example\n- 测试协助：`suggest_test_params` → `run_test` → 成功后 `set_test_params`（相同 parameters）\n- **禁止**未调用 suggest/set/run_test 就声称已更新测试页参数或 mock 已保存\n- GET 操作测试页使用 Query 参数面板；写操作使用 JSON Example',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%请求参数 Example（与测试页统一）%';

-- Skill: test-fix
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 请求参数 Example 修复流程\n1. `apiservice_set_test_params` 或 `apiservice_suggest_test_params` 写入完整 parameters（mutation 同步表单）\n2. `apiservice_run_test` 使用**相同** parameters 重测\n3. 成功后再次 `set_test_params` 确保持久化\n4. 向用户汇报前确认 Surface 中 `parametersText` 已更新（禁止只口头声称已更新）',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-test-fix'
  AND content_markdown NOT LIKE '%请求参数 Example 修复流程%';
