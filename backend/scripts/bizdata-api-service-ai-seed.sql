-- API 服务 AI Skills / Tools 种子（挂载 business-data Scope）

-- aibase_read_surfaces（若尚未存在则创建，供页面上下文读取）
INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description, execution_type,
    parameters_schema, review_markdown, server_config, is_active
)
VALUES (
    '77777777-7777-4777-8777-777777777701',
    '88888888-8888-4888-8888-888888888801',
    '读取页面 Surface',
    'aibase-read-surfaces',
    'aibase_read_surfaces',
    '读取当前页面已注册的 AI Surface 快照',
    'client',
    '{"type":"object","properties":{"domain":{"type":"string"},"surfaceId":{"type":"string"}}}'::jsonb,
    E'## aibase_read_surfaces\n\n返回当前页面注册的 Surface 列表（表单值、SQL 等）。\n\n可选过滤：\n- domain：如 bizdata\n- surfaceId：如 api-services.create',
    '{}'::jsonb,
    true
)
ON CONFLICT (function_name) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '66666666-6666-4666-8666-666666666620',
        '55555555-5555-4555-8555-555555555501',
        '列出 API 服务',
        'apiservice-list-services',
        'apiservice_list_services',
        '列出 API 服务，可按域前缀、状态、连接过滤',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"},"status":{"type":"string","enum":["draft","published","disabled"]},"connectionId":{"type":"string"},"tag":{"type":"string"},"page":{"type":"integer"},"size":{"type":"integer"}}}'::jsonb,
        E'## apiservice_list_services\n\n返回 items 与 total。size=-1 可拉取全部。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666621',
        '55555555-5555-4555-8555-555555555501',
        '获取 API 服务详情',
        'apiservice-get-service',
        'apiservice_get_service',
        '按 ID 或 code 获取 API 服务详情（含 operations）',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## apiservice_get_service\n\nserviceId 或 code 二选一。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666629',
        '55555555-5555-4555-8555-555555555501',
        '推断数据库连接',
        'apiservice-resolve-connection',
        'apiservice_resolve_connection',
        '根据 Scope/Entity 物化记录或默认连接自动推断 API 服务目标库，无需用户手动指定',
        'client',
        '{"type":"object","properties":{"connectionId":{"type":"string","description":"通常无需传入"},"scopeCode":{"type":"string","description":"Scope 引用 code"},"entityCodes":{"type":"array","items":{"type":"string"}},"entityIds":{"type":"array","items":{"type":"string"}}}}'::jsonb,
        E'## apiservice_resolve_connection\n\n**禁止**向用户询问 connectionId。\n\n推断规则：\n1. 仅一个连接 → 直接使用\n2. 多个连接 → 查物化状态，选 Scope/Entity 已物化实体最多的连接\n3. 仍无法区分 → 默认连接或 PostgreSQL 连接\n\n从 Chat 引用提取：\n- type=scope → scopeCode\n- type=entity → entityCodes 或 entityIds',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666630',
        '55555555-5555-4555-8555-555555555501',
        '批量创建 API 服务',
        'apiservice-create-services-batch',
        'apiservice_create_services_batch',
        '按实体批量创建 CRUD 等多个 API 服务（每个服务一个 operation）',
        'client',
        '{"type":"object","properties":{"entityCode":{"type":"string","description":"实体 code"},"entityId":{"type":"string"},"entityCodes":{"type":"array","items":{"type":"string"}},"scopeCode":{"type":"string"},"connectionId":{"type":"string"},"operations":{"type":"array","items":{"type":"string"},"description":"默认 find,create,updateOne,deleteOne"},"namePrefix":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"publish":{"type":"boolean"},"services":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string"},"name":{"type":"string"},"operation":{"type":"string"},"definitionScript":{"type":"string"}}}}}}'::jsonb,
        E'## apiservice_create_services_batch\n\n用户要「CRUD / 全套 API」时使用此工具，**不要**对 create_service 传多个 operation。\n\n### 创建前\n先 `apiservice_list_services`（codePrefix 如 equipment）查看是否已有服务，避免重复创建。\n\n### 自动生成（推荐）\n```json\n{ "entityCodes": ["equipment:Equipment","equipment:Maintenance","equipment:RunLog"], "namePrefix": "设备" }\n```\n或单实体：`{ "entityCode": "equipment:Equipment", "namePrefix": "设备资料" }`\n- code 自动生成：`equipment:EquipmentFind`、`equipment:EquipmentCreate` …\n- connectionId 省略，按物化记录推断\n\n### 返回解读\n- `created`：新创建成功\n- `skipped`：code 已存在（**不是失败**，说明之前已创建）\n- `failed`：展示 `error` 原文，**禁止**默认归咎「未物化」\n\n### 显式列表\n传 `services` 数组，每项一个 operation。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666622',
        '55555555-5555-4555-8555-555555555501',
        '创建 API 服务',
        'apiservice-create-service',
        'apiservice_create_service',
        '创建 draft 状态的 API 服务；禁止向用户索要 connectionId，使用 scopeCode+serviceSlug 或 code',
        'client',
        '{"type":"object","properties":{"code":{"type":"string","description":"可省略，优先 scopeCode+serviceSlug"},"scopeCode":{"type":"string"},"serviceSlug":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"connectionId":{"type":"string","description":"禁止索要，省略时自动推断"},"entityCodes":{"type":"array","items":{"type":"string"}},"entityIds":{"type":"array","items":{"type":"string"}},"entityId":{"type":"string"},"definitionScript":{"type":"string"},"handlerScript":{"type":"string"},"scriptMode":{"type":"string","enum":["sql","typescript"]},"requestParameterInterface":{"type":"string"},"accessRestriction":{"type":"object","properties":{"mode":{"type":"string","enum":["none","role","department"]},"roleIds":{"type":"array","items":{"type":"string"}},"departmentIds":{"type":"array","items":{"type":"string"}}}},"enabledOperations":{"type":"array","items":{"type":"string"},"description":"只传一个主 operation"},"publish":{"type":"boolean","description":"创建后立即发布"}}}'::jsonb,
        E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId；使用 **scopeCode + serviceSlug** 或 code\n- enabledOperations **只传一项**，如 `["create"]`\n- scriptMode=typescript 时写 handlerScript，否则写 definitionScript（SQL）\n\n### 成功判定（必须）\n- Tool 返回 `id` 且 `_verification.verified=true`\n- `_verification.listedInApiList=true` 表示列表可见\n- **禁止**未调用本 Tool 就声称创建成功\n- 创建后须 `apiservice_list_services` 按 code 二次确认',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666623',
        '55555555-5555-4555-8555-555555555501',
        '更新 API 服务',
        'apiservice-update-service',
        'apiservice_update_service',
        '更新 API 服务元信息、SQL/Handler、访问限制或 operations',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"scopeCode":{"type":"string"},"serviceSlug":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"connectionId":{"type":"string"},"definitionScript":{"type":"string"},"handlerScript":{"type":"string"},"scriptMode":{"type":"string","enum":["sql","typescript"]},"requestParameterInterface":{"type":"string"},"accessRestriction":{"type":"object","properties":{"mode":{"type":"string","enum":["none","role","department"]},"roleIds":{"type":"array","items":{"type":"string"}},"departmentIds":{"type":"array","items":{"type":"string"}}}},"enabledOperations":{"type":"array","items":{"type":"string"}}}}'::jsonb,
        E'## apiservice_update_service\n\nserviceId 或 code 定位服务；可更新 scopeCode、serviceSlug、scriptMode、handlerScript、requestParameterInterface、accessRestriction；仅传需修改字段。\n\n### SQL 脚本（重要）\n- **禁止**写入占位 SQL：`SELECT 1`、`SELECT 1 AS result`、与业务无关的常量查询\n- **create** 类（operation=create）：definitionScript 应为绑定实体物化表的结构参考，例如：\n  ```sql\n  SELECT *\n  FROM "bizdata_mat"."equipment"\n  WHERE 1 = 0\n  ```\n  运行时由 Gateway 根据 body 执行 INSERT，不是靠 SELECT 写入\n- **find** 类：须 `FROM` 物化表或合理子查询，含 `:limit`、`:skip` 等命名参数\n- **typescript**：handler 须 export async function handler(ctx)，写操作使用 ctx 提供的 queryPg\n\n### 更新后校验（必须）\n1. 本 Tool 成功后 **必须** `apiservice_get_service` 回读 definitionScript/handlerScript\n2. 确认脚本非占位、operation 与 enabledOperations 一致\n3. 用户要求完善/可测试时：**必须** `apiservice_run_test` 且 `success=true` 才可声称测试通过\n4. **禁止**仅 update 成功就声称「完善成功」或「测试通过」',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666624',
        '55555555-5555-4555-8555-555555555501',
        '发布 API 服务',
        'apiservice-publish-service',
        'apiservice_publish_service',
        '将 draft 服务发布为 published',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        '## apiservice_publish_service',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666625',
        '55555555-5555-4555-8555-555555555501',
        '禁用 API 服务',
        'apiservice-disable-service',
        'apiservice_disable_service',
        '禁用已发布的 API 服务',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        '## apiservice_disable_service',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666626',
        '55555555-5555-4555-8555-555555555501',
        '删除 API 服务',
        'apiservice-delete-service',
        'apiservice_delete_service',
        '永久删除 API 服务（物理删除，不可恢复）',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        '## apiservice_delete_service',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666627',
        '55555555-5555-4555-8555-555555555501',
        'Operation 目录',
        'apiservice-list-operations',
        'apiservice_list_operations',
        '获取 API 服务可用 operation 元数据目录',
        'client',
        '{"type":"object","properties":{}}'::jsonb,
        '## apiservice_list_operations',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666628',
        '55555555-5555-4555-8555-555555555501',
        'API 服务域树',
        'apiservice-get-tree',
        'apiservice_get_tree',
        '按 code 域层级获取 API 服务树',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string"}}}'::jsonb,
        '## apiservice_get_tree',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666631',
        '55555555-5555-4555-8555-555555555501',
        '获取 API 测试上下文',
        'apiservice-get-test-profile',
        'apiservice_get_test_profile',
        '获取 API 服务测试 profile：参数结构、mock 参数、请求预览',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## apiservice_get_test_profile\n\n返回 enabledOperations 列表，每项含 parameterSchema、mockParameters、requestPreview。\n\n测试弹窗打开时可用 aibase_read_surfaces（surfaceId=api-services.test）读取当前选中 operation。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666632',
        '55555555-5555-4555-8555-555555555501',
        '生成 API 测试 mock 参数',
        'apiservice-suggest-test-params',
        'apiservice_suggest_test_params',
        '按 operation 生成 mock 测试参数并同步到测试弹窗',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"operation":{"type":"string"}}}'::jsonb,
        E'## apiservice_suggest_test_params\n\n调用后会通过 mutation 将 mockParameters 写入测试弹窗。\n\n优先根据实体字段与 SQL 命名参数生成示例值。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666633',
        '55555555-5555-4555-8555-555555555501',
        '执行 API 服务测试',
        'apiservice-run-test',
        'apiservice_run_test',
        '使用 operation + parameters 执行测试（写操作事务回滚）',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"operation":{"type":"string"},"parameters":{"type":"object"}},"required":["operation"]}'::jsonb,
        E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true` 才可声称测试通过\n- `success: false` 须展示 `error` / `validationErrors`，并进入修复流程\n- `executable: false` / 仅校验 **不算** 测试通过\n- create 类：`preview` 应含 `item` 或有效写入结果；rolledBack=true 为正常\n- **禁止**未调用本 Tool 就声称测试通过\n\n### 禁止接受的脚本结果\n- 若 get_service 显示 definitionScript 为 `SELECT 1` 等占位 SQL，须先 update_service 修正再测\n\n执行测试并将结果同步到测试页（mutation: test_completed）。\n\n- 成功：返回 preview / rolledBack\n- 失败：返回 success=false 与 error / validationErrors，**不要**抛异常中断\n\n自动修复流程中，参数类问题：`run_test` 成功后**必须** `apiservice_set_test_params` 保存 mock。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666634',
        '55555555-5555-4555-8555-555555555501',
        'API 服务页面跳转',
        'apiservice-navigate',
        'apiservice_navigate',
        '在 list / edit / test 页面间跳转，支持返回测试页后 autoRunTest',
        'client',
        '{"type":"object","properties":{"target":{"type":"string","enum":["list","edit","test"]},"serviceId":{"type":"string"},"code":{"type":"string"},"autoRunTest":{"type":"boolean"},"fixContext":{"type":"object"}},"required":["target"]}'::jsonb,
        E'## apiservice_navigate\n\n- target=edit：跳转 `/api_services/{id}/edit`，可传 fixContext.errorMessage\n- target=test：跳转测试页；autoRunTest=true 时落地后自动执行测试\n- target=list：服务列表\n\n配置/SQL 修复流程：edit → update_service → test(autoRunTest=true)',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666635',
        '55555555-5555-4555-8555-555555555501',
        '设置 API 测试 mock 参数',
        'apiservice-set-test-params',
        'apiservice_set_test_params',
        '将 AI 修正后的 mock 参数写入测试页（不调用 suggest 接口）',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"operation":{"type":"string"},"parameters":{"type":"object"},"mockParameters":{"type":"object"}}}'::jsonb,
        E'## apiservice_set_test_params\n\n传 operation（必填）+ parameters 或 mockParameters（完整 JSON 对象）。\n\n### 作用\n- **持久化**到服务 security_config.testMockParameters（按 operation 存储）\n- mutation 同步到 surfaceId=api-services.test 的表单\n\n### 调用时机（重要）\n- 参数类问题：`run_test` **执行成功后**必须调用本 Tool 保存已通过测试的 mock\n- 生成/完善 mock 后测试通过，同样必须保存\n- 禁止仅 run_test 成功就结束而不保存 mock',
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
        '77777777-7777-4777-8777-777777777703',
        '55555555-5555-4555-8555-555555555501',
        'API 服务创建',
        'bizdata-api-service-create',
        '辅助新建 API 服务：SQL 脚本、主操作类型与域编码',
        E'# API 服务创建助手\n\n你是 EADAF API 服务设计助手，帮助用户在「新建 API 服务」页完成配置。\n\n## 数据库连接（重要）\n- **禁止**向用户询问「数据库连接」「connectionId」「选哪个库」\n- 表单已移除连接下拉；系统按 Scope 物化记录自动推断\n- 从 Chat 引用提取：type=scope → scopeCode（单选）；type=entity → entityCodes\n\n## 编码规范（重要）\n- 优先使用 **scopeCode + serviceSlug** 生成 code，如 scopeCode=sales、serviceSlug=OrderSummary → sales:OrderSummary\n- code **至少两段**；**禁止**把单段 Scope code 当作 API code\n- create 类服务建议：`equipment:EquipmentCreate`（operation=create）\n\n## 脚本模式\n- scriptMode=sql：编写 definitionScript（SQL）\n- scriptMode=typescript：编写 handlerScript（export async function handler(ctx)）\n\n## 成功判定（重要）\n- **禁止**未调用 Tool 就声称创建/发布/测试成功\n- 创建：`apiservice_create_service` 返回 `_verification.verified=true` 且 `listedInApiList=true`\n- 发布：`apiservice_publish_service` 返回 `_verification.status=published`\n- 测试：`apiservice_run_test` 返回 `success=true`\n- 汇报前推荐 `apiservice_list_services` 或 `apiservice_get_service` 二次确认\n\n## CRUD / 批量创建\n- 用户要 CRUD → `apiservice_create_services_batch`；创建前先 `apiservice_list_services`\n\n## 单条创建\n- `apiservice_create_service`（enabledOperations 只传一项）\n\n## 工作流程\n1. 解析引用，**不要**追问连接\n2. `bizdata_get_entity` 了解表结构\n3. `apiservice_list_services`（codePrefix）检查已有服务\n4. `apiservice_create_service` 创建\n5. 检查 Tool 返回 `_verification`，必要时 `apiservice_list_services` 确认列表可见\n6. 需要则 `apiservice_publish_service` + `apiservice_run_test`',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777704',
        '55555555-5555-4555-8555-555555555501',
        'API 服务管理',
        'bizdata-api-service-manage',
        '查看、发布、禁用与维护 API 服务',
        E'# API 服务管理助手\n\n你是 EADAF API 服务管理助手，帮助用户维护已创建的 API 服务。\n\n## 常用操作\n1. `apiservice_list_services` / `apiservice_get_tree` 浏览服务\n2. `apiservice_get_service` 查看详情与 SQL\n3. `apiservice_update_service` 修改配置\n4. `apiservice_publish_service` 发布 draft\n5. `apiservice_disable_service` 禁用已发布服务\n6. `apiservice_delete_service` 删除服务\n\n## API 测试协助\n- 用户打开测试页或要求测试 API 时：\n  1. `aibase_read_surfaces`（surfaceId=api-services.test）读取当前 operation 与参数\n  2. `apiservice_get_test_profile` 获取参数结构与 mock\n  3. `apiservice_suggest_test_params` 或 `apiservice_set_test_params` 写入 mock\n  4. `apiservice_run_test` 执行测试并解读 preview / rolledBack / error\n\n## 测试失败自动修复（重要）\n用户点击「自动修复」或粘贴测试错误时：\n- **mock/参数错误** → `apiservice_set_test_params` + `apiservice_run_test`\n- **SQL/配置错误** → `apiservice_navigate`(edit) → `apiservice_update_service` → `apiservice_navigate`(test, autoRunTest=true)\n\n必须调用 Tool 完成修复，禁止只输出文字方案。\n\n## 状态\n- draft：草稿，未对外暴露\n- published：已发布\n- disabled：已禁用\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取列表/测试/编辑页状态\n\n## UI 同步\n- 写操作成功后列表会自动刷新，**不要**提示用户手动刷新\n\n## AI 完善 / 编辑页（重要）\n用户点击「AI 完善」或要求优化 SQL/配置时，须按下列 **Todo 逐项执行**，禁止跳过：\n\n### 完善前\n1. `aibase_read_surfaces`（api-services.edit）+ `apiservice_get_service` 读取当前脚本与 operation\n2. `bizdata_get_entity`（若有 entityCode）了解表结构与字段\n\n### 脚本要求\n- **禁止** `SELECT 1`、`SELECT 1 AS result` 等占位 SQL\n- create 类：物化表结构参考 SQL（`WHERE 1=0`）或合理业务 SQL；须绑定实体表\n- find 类：完整查询 SQL + 命名参数\n\n### 完善后校验 Todo（全部完成才可汇报成功）\n- [ ] `apiservice_update_service` 保存后，`apiservice_get_service` 回读脚本，确认非占位\n- [ ] `apiservice_get_test_profile`：目标 operation 的 `executable=true`（若 false 检查系统设置「API 操作允许写操作」与实体物化）\n- [ ] `apiservice_suggest_test_params` 或 `apiservice_set_test_params`：create 须有合理 `body`\n- [ ] `apiservice_run_test`：`success=true`；create 的 preview 含 `item` 或有效结果\n- [ ] **仅当以上通过**才可向用户声称「完善成功」「测试通过」\n\n### 禁止\n- 禁止仅 update 成功就声称测试通过\n- 禁止编造 preview / rolledBack',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777708',
        '55555555-5555-4555-8555-555555555501',
        'API 测试自动修复',
        'bizdata-api-service-test-fix',
        '分析 API 测试失败原因，自动修正 mock 或 SQL 并重测',
        E'# API 测试自动修复助手\n\n你在 **API 测试页 / 编辑页** 协助用户修复测试失败。这是系统核心能力，必须 **全自动调用 Tool** 完成修复。\n\n## 1. 读取上下文\n- `aibase_read_surfaces`：surfaceId=`api-services.test` 或 `api-services.edit`\n- `apiservice_get_test_profile` + `apiservice_get_service`\n\n## 2. 错误分类\n| 类型 | 典型错误 | 修复路径 |\n|------|----------|----------|\n| mock/参数 | 参数校验失败、SQL 命名参数未填、类型错误、测试 id 不存在 | set_test_params → run_test |\n| 配置/SQL | 语法错误、表/列不存在、未物化、operation 配置错误 | navigate(edit) → update_service → navigate(test, autoRunTest) |\n\n## 3. mock 修复\n1. `apiservice_set_test_params` 写入完整 parameters\n2. `apiservice_run_test` 立即重测\n3. 仍失败则重新分类\n\n## 4. SQL/配置修复\n1. `apiservice_navigate` target=edit，fixContext 带上 errorMessage\n2. `aibase_read_surfaces` surfaceId=api-services.edit\n3. `apiservice_update_service` 修改 definitionScript 等（**即保存**）\n4. `apiservice_navigate` target=test autoRunTest=true\n5. 根据自动重测结果向用户汇报\n\n## 约束\n- 禁止询问 serviceId（从 Surface 获取）\n- 禁止只描述方案不调用 Tool\n- 写操作测试 rolledBack=true 为正常行为\n\n## 脚本质量（编辑/修复共用）\n- 修复后 `apiservice_get_service` 回读，**拒绝** `SELECT 1 AS result` 类占位脚本\n- create 服务须使用物化表 `"schema"."table"` 结构参考或正确 handler\n- 汇报测试通过前必须 `apiservice_run_test` 且 success=true',
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- bizdata-api-service-create
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-create'
  AND t.function_name IN (
    'apiservice_create_service',
    'apiservice_create_services_batch',
    'apiservice_resolve_connection',
    'apiservice_list_operations',
    'apiservice_list_services',
    'bizdata_list_entities',
    'bizdata_get_entity',
    'bizdata_get_materialization_status'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-create'
  AND t.function_name = 'aibase_read_surfaces'
ON CONFLICT DO NOTHING;

-- bizdata-api-service-manage
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-manage'
  AND t.function_name IN (
    'apiservice_list_services',
    'apiservice_get_service',
    'apiservice_update_service',
    'apiservice_publish_service',
    'apiservice_disable_service',
    'apiservice_delete_service',
    'apiservice_get_tree',
    'apiservice_list_operations',
    'apiservice_get_test_profile',
    'apiservice_suggest_test_params',
    'apiservice_set_test_params',
    'apiservice_run_test',
    'apiservice_navigate'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 99
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-manage'
  AND t.function_name = 'aibase_read_surfaces'
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 100
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-manage'
  AND t.function_name = 'bizdata_get_entity'
ON CONFLICT DO NOTHING;

-- bizdata-api-service-test-fix
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-test-fix'
  AND t.function_name IN (
    'aibase_read_surfaces',
    'apiservice_get_service',
    'apiservice_get_test_profile',
    'apiservice_set_test_params',
    'apiservice_suggest_test_params',
    'apiservice_run_test',
    'apiservice_navigate',
    'apiservice_update_service',
    'bizdata_get_entity',
    'bizdata_get_materialization_status'
  )
ON CONFLICT DO NOTHING;
