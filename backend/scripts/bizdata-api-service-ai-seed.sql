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
        '列出 API 服务；对照实体覆盖率时与 bizdata_list_entity_summaries 同 codePrefix 配对使用',
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
        '按 ID 或 code 获取 API 服务详情；仅测前确认非占位，测成功后禁止循环回读 handler',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"}}}'::jsonb,
        E'## apiservice_get_service\n\n定位：serviceId / code / scopeCode+serviceSlug。\n\n### 调用时机\n- **允许**：完善流程中、`run_test` **之前**，确认脚本非占位、interface 完整\n- **禁止**：`run_test` 已 success 后再调用「查看完整 handler」——会导致无意义循环',
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
        '创建 API 服务；typescript 用 params+db（paginate/count/leftJoin），须先 check_handler',
        'client',
        '{"type":"object","properties":{"code":{"type":"string","description":"可省略，优先 scopeCode+serviceSlug"},"scopeCode":{"type":"string"},"serviceSlug":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"connectionId":{"type":"string","description":"禁止索要，省略时自动推断"},"entityCodes":{"type":"array","items":{"type":"string"}},"entityIds":{"type":"array","items":{"type":"string"}},"entityId":{"type":"string"},"definitionScript":{"type":"string"},"handlerScript":{"type":"string"},"scriptMode":{"type":"string","enum":["sql","typescript"]},"requestParameterInterface":{"type":"string"},"accessRestriction":{"type":"object","properties":{"mode":{"type":"string","enum":["none","role","department"]},"roleIds":{"type":"array","items":{"type":"string"}},"departmentIds":{"type":"array","items":{"type":"string"}}}},"enabledOperations":{"type":"array","items":{"type":"string"},"description":"只传一个主 operation"},"publish":{"type":"boolean","description":"创建后立即发布"}}}'::jsonb,
        E'## apiservice_create_service\n\n- 一个服务 = 一个主 operation；禁止索要 connectionId\n- typescript：函数体 + params + db(实体code)；禁止 queryPg/SQL\n\n### Handler SDK（必遵）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })` → `{ items, total }`，**禁止** where 写两遍再 getMany+getCount\n- 别名：`count()`=`getCount()`，`find()`=`getMany()`\n- JOIN：`db(''A'',''o'').leftJoin(''B'',''b'',''o.id'',''b.a_id'')`（仅等值 ON）\n- where 操作符：`$gte/$in/$ilike/$isNull` 等\n- params：网关已校验只读；经 SDK 参数化；禁止拼字符串\n- 保存前 `apiservice_check_handler`\n\n### 成功判定\n- `_verification.verified=true`；禁止未调用本 Tool 声称创建成功',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666623',
        '55555555-5555-4555-8555-555555555501',
        '更新 API 服务',
        'apiservice-update-service',
        'apiservice_update_service',
        '更新 API 服务；typescript 用 paginate/count/join；测前可 get_service，测过后禁止循环回读',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"scopeCode":{"type":"string"},"serviceSlug":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"connectionId":{"type":"string"},"definitionScript":{"type":"string"},"handlerScript":{"type":"string"},"scriptMode":{"type":"string","enum":["sql","typescript"]},"requestParameterInterface":{"type":"string"},"accessRestriction":{"type":"object","properties":{"mode":{"type":"string","enum":["none","role","department"]},"roleIds":{"type":"array","items":{"type":"string"}},"departmentIds":{"type":"array","items":{"type":"string"}}}},"enabledOperations":{"type":"array","items":{"type":"string"}}}}'::jsonb,
        E'## apiservice_update_service\n\n定位：serviceId / code / scopeCode+serviceSlug。\n\n### TypeScript Handler\n- 用 `paginate` / `count` / `leftJoin`；禁止双重 where；禁止 queryPg\n- 保存前 `apiservice_check_handler`\n\n### 更新后校验顺序（必遵）\n1. （可选）测前 `apiservice_get_service` 确认非占位\n2. `apiservice_run_test`\n3. **一旦 success=true（及 verified）→ 立即汇报并 STOP**\n4. **禁止**测试成功后再 `get_service` / `read_surfaces`「查看完整 handler」\n5. **禁止**仅 update 成功就声称完善/测试通过',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666637',
        '55555555-5555-4555-8555-555555555501',
        '检查 TypeScript Handler',
        'apiservice-check-handler',
        'apiservice_check_handler',
        '对 TypeScript Handler 做语法/类型检查（行级诊断）；保存与测试前必须先通过',
        'client',
        '{"type":"object","properties":{"handlerScript":{"type":"string","description":"Handler 脚本（推荐只写函数体）"},"requestParameterInterface":{"type":"string","description":"请求参数 TS interface"}},"required":["handlerScript"]}'::jsonb,
        E'## apiservice_check_handler\n\n返回 `{ ok, diagnostics }`。\n\n- 修改 handler 后、create/update **之前**调用\n- run_test **之前**（typescript）\n- **禁止**在 run_test 已成功后再调用本 Tool「再确认一遍」\n\n### SDK\n- `paginate` / `count` / `leftJoin` / where `$gte|$in|$ilike`\n- 禁止 queryPg',
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
        '按实体字段、SQL/Handler 命名参数与 requestParameterInterface 生成测试 mock',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"operation":{"type":"string"}}}'::jsonb,
        E'## apiservice_suggest_test_params\n\n调用后会通过 mutation 将 mockParameters 写入测试弹窗。\n\n优先根据实体字段、SQL `:param`、TypeScript Handler 发现的命名参数、以及 requestParameterInterface 生成示例值。',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666633',
        '55555555-5555-4555-8555-555555555501',
        '执行 API 服务测试',
        'apiservice-run-test',
        'apiservice_run_test',
        '执行 API 测试；success+verified 后立即收束，禁止再 get_service 看 handler',
        'client',
        '{"type":"object","properties":{"serviceId":{"type":"string"},"code":{"type":"string"},"operation":{"type":"string"},"parameters":{"type":"object"}},"required":["operation"]}'::jsonb,
        E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true`（或等价成功信封）才可声称测试通过\n- `executable: false` / 仅校验 **不算** 测试通过\n\n### 收束（必遵，防循环）\n- 测试**成功后立即向用户汇报并结束本轮**，可附带 preview 摘要\n- **禁止**成功后再调用 `apiservice_get_service` / `aibase_read_surfaces` / `apiservice_check_handler`「确认完整 handler」\n- **禁止**成功后再改 handler 除非用户明确要求继续修改\n- `get_service` 只允许在**测试前**（update 之后）用于确认非占位脚本',
        '{}'::jsonb,
        true
    ),
    (
        '66666666-6666-4666-8666-666666666634',
        '55555555-5555-4555-8555-555555555501',
        'API 服务页面跳转',
        'apiservice-navigate',
        'apiservice_navigate',
        '在 list / test 页面间跳转，支持返回测试页后 autoRunTest',
        'client',
        '{"type":"object","properties":{"target":{"type":"string","enum":["list","test"]},"serviceId":{"type":"string"},"code":{"type":"string"},"autoRunTest":{"type":"boolean"},"fixContext":{"type":"object"}},"required":["target"]}'::jsonb,
        E'## apiservice_navigate\n\n- target=test：跳转测试页；autoRunTest=true 时落地后自动执行测试\n- target=list：服务列表\n\n配置/SQL 修复流程：update_service（执行后自动跳转至服务列表） → test(autoRunTest=true)',
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
    ),
    (
        '66666666-6666-4666-8666-666666666636',
        '55555555-5555-4555-8555-555555555501',
        '过滤 API 服务',
        'apiservice-filter-services',
        'apiservice_filter_services',
        '按 status/codePrefix 过滤 API 服务（与 list_services 同源，默认 size=-1）。status=ALL 不过滤；找 draft 须传 status=draft 或改用 apiservice_list_draft_services',
        'client',
        '{"type":"object","properties":{"codePrefix":{"type":"string","description":"code 前缀，如 equipment、IPS:production:BomInstance（软匹配）"},"status":{"type":"string","enum":["draft","published","disabled","ALL"],"description":"ALL 或省略表示不过滤"},"tag":{"type":"string","description":"标签精确匹配"},"connectionId":{"type":"string"},"page":{"type":"integer"},"size":{"type":"integer","description":"默认 -1 全量"}}}'::jsonb,
        E'## apiservice_filter_services\n\n与 **apiservice_list_services 同源**。\n\n- `status=ALL` 或省略 = 不过滤\n- `codePrefix` 支持末段软前缀（BomInstance → BomInstanceCreate）\n- 返回 { items, total }；超预算时含 truncated/hint\n',
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
        E'# API 服务创建助手\n\n你是 EADAF API 服务设计助手，帮助用户在「新建 API 服务」页完成配置。\n\n## 数据库连接（重要）\n- **禁止**向用户询问「数据库连接」「connectionId」「选哪个库」\n- 表单已移除连接下拉；系统按 Scope 物化记录自动推断\n- 从 Chat 引用提取：type=scope → scopeCode（单选）；type=entity → entityCodes\n\n## 编码规范（重要）\n- 优先使用 **scopeCode + serviceSlug** 生成 code，如 scopeCode=sales、serviceSlug=OrderSummary → sales:OrderSummary\n- code **至少两段**；**禁止**把单段 Scope code 当作 API code\n- create 类服务建议：`equipment:EquipmentCreate`（operation=create）\n\n## 脚本模式\n- scriptMode=sql：编写 definitionScript（SQL）\n- scriptMode=typescript：只写 handler **函数体**（编辑器壳层锁定）；用 `params` + `db(实体code)`\n\n## TypeScript Handler 契约（必遵）\n- `requestParameterInterface` 为唯一真相源\n- 枚举：`type StatusType = getADBEnumByCode<"code">;` + `status?: StatusType` / `StatusType[]`\n- 用 `db().paginate/count/leftJoin`；**禁止** queryPg / 原始 SQL / 拼字符串\n- params：网关已校验只读；经 SDK 参数化防注入\n- 创建时一起传：interface + handlerScript + requestOverrides\n- 保存前 `apiservice_check_handler`\n\n## Handler SDK（paginate / join / count）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })`，禁止 where 写两遍\n- `count()` 别名可用；`leftJoin(entity, alias, leftCol, rightCol)` 仅等值 ON\n- where：`$gte/$in/$ilike/$isNull`\n\n## 成功判定（重要）\n- **禁止**未调用 Tool 就声称创建/发布/测试成功\n- 创建：`apiservice_create_service` 返回 `_verification.verified=true`\n- 测试：`apiservice_run_test` 返回 `success=true` 且 `verified=true` 后**立即汇报并结束**\n\n## 测试成功后收束（必遵）\n- `apiservice_run_test` 一旦 success=true（及 verified）→ **立即汇报并结束**\n- **禁止**测试成功后再 `apiservice_get_service` / `aibase_read_surfaces`「查看完整 handler」\n- `get_service` 仅测前用于确认非占位\n\n## CRUD / 批量创建\n- 用户要 CRUD → `apiservice_create_services_batch`；创建前先 `apiservice_list_services`\n\n## 单条创建\n- `apiservice_create_service`（enabledOperations 只传一项）\n\n## 工作流程\n1. 解析引用，**不要**追问连接\n2. 列举子域实体：`bizdata_list_entity_summaries`（codePrefix）；单实体字段：`bizdata_get_entity`\n3. `apiservice_list_services`（codePrefix）检查已有服务\n4. `apiservice_check_handler` → `apiservice_create_service`\n5. 检查 `_verification`；需要则 publish + run_test → STOP',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777704',
        '55555555-5555-4555-8555-555555555501',
        'API 服务管理',
        'bizdata-api-service-manage',
        '查看、发布、禁用与维护 API 服务',
        E'# API 服务管理助手\n\n你是 EADAF API 服务管理助手，帮助用户维护已创建的 API 服务。\n\n## 实体 API 覆盖率（必遵）\n用户问「哪些实体还没建 API」「未创建 API 服务的实体」「域下实体与 API 对比」等：\n1. **必须**先 `bizdata_list_entity_summaries`（codePrefix=域，如 `fmms`）\n2. **必须**再 `apiservice_list_services`（同一 codePrefix；不够则增大 size）\n3. 对比 entity.code 与 API 的 entityCodes / code（如 `fmms:WorkCardFind` 表示 WorkCard 已有 API）\n4. 列出**尚无 API 覆盖**的实体；**禁止**未执行 1+2 就声称已对比\n5. **禁止**用 `apiservice_filter_services` / `apiservice_get_tree` 替代上述对比流程\n6. **禁止**调用已停用的 `bizdata_list_entities`\n\n## 常用操作\n1. `apiservice_list_services` / `apiservice_get_service` 浏览与查看详情\n2. `apiservice_update_service` 修改配置\n3. `apiservice_publish_service` 发布 draft\n4. `apiservice_disable_service` 禁用已发布服务\n5. `apiservice_delete_service` 删除服务\n\n## API 测试协助\n- 用户打开测试页或要求测试 API 时：\n  1. `aibase_read_surfaces`（surfaceId=api-services.test）读取当前 operation 与参数\n  2. `apiservice_get_test_profile` 获取参数结构与 mock\n  3. `apiservice_suggest_test_params` 或 `apiservice_set_test_params` 写入 mock\n  4. `apiservice_run_test` 执行测试；**成功后立即汇报并 STOP**\n\n## 测试失败自动修复（重要）\n用户点击「自动修复」或粘贴测试错误时：\n- **mock/参数错误** → `apiservice_set_test_params` + `apiservice_run_test`\n- **SQL/配置错误** → `apiservice_update_service`（执行后自动跳转至服务列表） → `apiservice_navigate`(test, autoRunTest=true)\n\n必须调用 Tool 完成修复，禁止只输出文字方案。\n\n## 状态\n- draft：草稿，未对外暴露\n- published：已发布\n- disabled：已禁用\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取列表/测试/编辑页状态\n\n## AI 完善 / 编辑页（重要）\n用户点击「AI 完善」或要求优化 SQL/配置时，须按下列 **Todo 逐项执行**，禁止跳过：\n\n### 完善前\n1. `aibase_read_surfaces`（api-services.edit）+ `apiservice_get_service` 读取当前脚本与 operation\n2. `bizdata_get_entity`（若有 entityCode）了解表结构与字段\n\n### 脚本要求\n- **禁止** `SELECT 1`、`SELECT 1 AS result` 等占位 SQL\n- create 类：物化表结构参考 SQL（`WHERE 1=0`）或合理业务 SQL；须绑定实体表\n- find 类：完整查询 SQL + 命名参数\n\n### TypeScript Handler 契约（必遵）\n- interface 声明全部请求字段；枚举用 `// @adb-enum <enumCode>`\n- 只写函数体；`params` + `db(实体code)`；用 `paginate` / `count` / `leftJoin`\n- **禁止** queryPg / 双重 where / 拼字符串\n- params：网关已校验只读；经 SDK 参数化\n- 编辑完善须同步 interface + Example + Handler，保存前 `apiservice_check_handler`\n\n### Handler SDK（paginate / join / count）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })`，禁止 where 写两遍\n- `count()` 别名可用；`leftJoin(entity, alias, leftCol, rightCol)` 仅等值 ON\n- where：`$gte/$in/$ilike/$isNull`\n\n### 完善后校验 Todo（全部完成才可汇报成功）\n- [ ] `apiservice_update_service` 保存\n- [ ] （可选）测前 `apiservice_get_service` 确认非占位\n- [ ] `apiservice_check_handler`（typescript）\n- [ ] `apiservice_get_test_profile`：目标 operation 的 `executable=true`\n- [ ] `apiservice_suggest_test_params` 或 `apiservice_set_test_params`\n- [ ] `apiservice_run_test`：`success=true` 且 `verified=true`\n- [ ] **STOP**：向用户汇报；**禁止**再 get_service / read_surfaces「查看完整 handler」\n\n## 测试成功后收束（必遵）\n- `apiservice_run_test` 一旦 success=true（及 verified）→ **立即汇报并结束**\n- **禁止**测试成功后再 `apiservice_get_service` / `aibase_read_surfaces`「查看完整 handler」\n- `get_service` 仅测前用于确认非占位\n\n### 禁止\n- 禁止仅 update 成功就声称测试通过\n- 禁止编造 preview / rolledBack\n- 禁止测试成功后再改 handler 除非用户明确要求',
        true
    ),
    (
        '77777777-7777-4777-8777-777777777708',
        '55555555-5555-4555-8555-555555555501',
        'API 测试自动修复',
        'bizdata-api-service-test-fix',
        '分析 API 测试失败原因，自动修正 mock 或 SQL 并重测',
        E'# API 测试自动修复助手\n\n你在 **API 测试页 / 编辑页** 协助用户修复测试失败。这是系统核心能力，必须 **全自动调用 Tool** 完成修复。\n\n## 1. 读取上下文\n- `aibase_read_surfaces`：surfaceId=`api-services.test` 或 `api-services.edit`\n- `apiservice_get_test_profile` + `apiservice_get_service`（仅测前）\n\n## 2. 错误分类\n| 类型 | 典型错误 | 修复路径 |\n|------|----------|----------|\n| mock/参数 | 参数校验失败、SQL 命名参数未填、类型错误、测试 id 不存在 | set_test_params → run_test |\n| 配置/SQL/Handler | 语法错误、表/列不存在、未物化、operation 配置错误 | update_service → navigate(test, autoRunTest) |\n\n## 3. mock 修复\n1. `apiservice_set_test_params` 写入完整 parameters\n2. `apiservice_run_test` 立即重测\n3. 仍失败则重新分类\n\n## 4. SQL/配置/Handler 修复\n1. `apiservice_update_service` 修改脚本等（**即保存**）\n2. typescript：保存前 `apiservice_check_handler`；用 `paginate`/`count`/`leftJoin`，禁止 queryPg\n3. `apiservice_navigate` target=test autoRunTest=true\n4. 根据自动重测结果向用户汇报\n\n## 约束\n- 禁止询问 serviceId（从 Surface 获取）\n- 禁止只描述方案不调用 Tool\n- 写操作测试 rolledBack=true 为正常行为\n\n## 脚本质量（编辑/修复共用）\n- 测前可用 `apiservice_get_service` 确认非占位；**拒绝** `SELECT 1 AS result`\n- 汇报测试通过前必须 `apiservice_run_test` 且 success=true + verified\n\n## Handler SDK（paginate / join / count）\n- 分页+计数：`.paginate({ limit: params.limit, skip: params.skip })`，禁止 where 写两遍\n- `count()` 别名可用；`leftJoin` 仅等值 ON；where `$gte/$in/$ilike/$isNull`\n- params 经 SDK 参数化，禁止拼字符串\n\n## 测试成功后收束（必遵）\n- `apiservice_run_test` 一旦 success=true（及 verified）→ **立即汇报并结束**\n- **禁止**测试成功后再 `apiservice_get_service` / `aibase_read_surfaces`「查看完整 handler」\n- `get_service` 仅测前用于确认非占位\n\n## TypeScript Handler / 命名参数\n- 报「命名参数未填」或参数面板缺字段：先补 `requestParameterInterface` 与 `requestOverrides.requestExample`，再 `set_test_params`\n- 可用 `suggest_test_params` 生成含自定义字段的 mock',
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
    'apiservice_check_handler',
    'apiservice_resolve_connection',
    'apiservice_list_operations',
    'apiservice_list_services',
    'apiservice_filter_services',
    'bizdata_list_entity_summaries',
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
    'bizdata_list_entity_summaries',
    'apiservice_list_services',
    'apiservice_filter_services',
    'apiservice_get_service',
    'apiservice_update_service',
    'apiservice_check_handler',
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
SELECT s.id, t.id, 0
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-manage'
  AND t.function_name = 'bizdata_list_entity_summaries'
ON CONFLICT (skill_id, tool_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

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
    'apiservice_check_handler',
    'apiservice_run_test',
    'apiservice_navigate',
    'apiservice_update_service',
    'bizdata_get_entity',
    'bizdata_get_materialization_status'
  )
ON CONFLICT DO NOTHING;
