-- API 服务请求参数结构（requestParameterInterface）约束 + 定位规则强化

-- Tool: create_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        COALESCE(parameters_schema, '{}'::jsonb),
        '{properties,requestParameterInterface}',
        '{"type":"string","description":"设计期 TS interface（编辑页「请求参数结构」唯一来源）；有实体时须按字段编写；省略且能解析实体时 Tool 会自动生成。Example 不能代替本字段"}'::jsonb
    ),
    review_markdown = E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId；使用 **scopeCode + serviceSlug** 或 code\n- enabledOperations **只传一项**，如 `["create"]`\n- scriptMode=typescript 时写 handlerScript，否则写 definitionScript（SQL）\n- tags 为 **string[]**\n\n### 请求参数结构（必须，与 Example 不同）\n- **`requestParameterInterface`**：编辑页左侧「请求参数结构」的 **唯一来源**\n- **禁止**只写 `requestOverrides` Example 却省略 interface（会导致 UI 结构为空）\n- 有实体时：先 `bizdata_get_entity`，按 operation 生成 TS interface（create→`body`；find→`limit/skip/filter`；updateOne→`id`+`body`）\n- 省略且传了 entityId/entityCodes 时，Tool **会自动生成** interface；仍须在回读中确认非空\n- `requestOverrides`：请求 Example（与测试 mock 同源）；未传或空对象时创建后自动 suggest\n- `responseOverrides`：Responses Schema + Example；**禁止** `data.item: null`\n\n### 定位后续更新\n- create 成功后记住返回的 **`id` / `code`**\n- 更新用 `serviceId` 或返回的 `code`，也可用 **scopeCode + serviceSlug**\n- **禁止**用实体 code（如 `fmms:WorkCard`）当作服务 code\n\n### 成功判定（必须）\n- Tool 返回 `id` 且 `_verification.verified=true`\n- `_verification.requestDocsComplete=true`（requestParameterInterface 非空）\n- **禁止**仅服务存在就声称「请求文档完整」\n- **禁止**未调用本 Tool 就声称创建成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

-- Tool: update_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        jsonb_set(
            COALESCE(parameters_schema, '{}'::jsonb),
            '{properties,requestParameterInterface}',
            '{"type":"string","description":"设计期 TS interface；补全请求结构时必须传非空字符串"}'::jsonb
        ),
        '{properties,code}',
        '{"type":"string","description":"服务 code（非实体 code）；也可用 serviceId 或 scopeCode+serviceSlug"}'::jsonb
    ),
    review_markdown = E'## apiservice_update_service\n\n### 定位（必须）\n1. **优先 `serviceId`**（create 返回的 id）\n2. 或 **服务 `code`**（create 返回的 code，不是实体 code）\n3. 或 **`scopeCode` + `serviceSlug`**（与创建时一致）\n4. **禁止**用实体 code（如 `fmms:WorkCardPushed`）定位 → 会报「未找到 code」\n\n### 请求参数结构\n- 补「请求参数结构」必须写 **`requestParameterInterface`**（非空 TS interface）\n- Example 用 `requestOverrides`；**不能**用 Example 代替 interface\n- 更新 interface 后看 `_verification.requestDocsComplete`\n\n### 请求参数 Example\n- `requestOverrides[operation].requestExample` 与测试页同源，须含具体字段值\n\n### SQL / Handler\n- **禁止**占位 SQL：`SELECT 1`\n- create 类：物化表结构参考或合理 handler；find 类：含 `:limit`、`:skip`\n\n### 更新后校验\n1. `apiservice_get_service` 回读（可用同一 serviceId/code/scope+slug）\n2. 确认 `requestParameterInterface` 非空\n3. 可测试时 `apiservice_run_test` 且 success=true\n4. **禁止**仅 update 成功就声称完善成功',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

-- Tool: get_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        jsonb_set(
            COALESCE(parameters_schema, '{"type":"object","properties":{}}'::jsonb),
            '{properties,scopeCode}',
            '{"type":"string"}'::jsonb
        ),
        '{properties,serviceSlug}',
        '{"type":"string"}'::jsonb
    ),
    description = '获取 API 服务详情；可用 serviceId、code 或 scopeCode+serviceSlug（勿用实体 code）',
    review_markdown = E'## apiservice_get_service\n\n定位：`serviceId` / 服务 `code` / `scopeCode`+`serviceSlug`。\n\n回读时检查 `requestParameterInterface` 是否非空（对应编辑页请求参数结构）。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_get_service';

-- Skill: create
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 请求参数结构 vs Example（必读）\n- **请求参数结构** = `requestParameterInterface`（TS interface），编辑页左侧展示；**不能为空**\n- **请求参数 Example** = `requestOverrides[op].requestExample`，与测试页同源\n- Example **不能代替** interface；只填 Example 会导致「结构为空」\n- 有实体：先 `bizdata_get_entity` 再写 interface，或依赖 create Tool 自动生成后回读确认\n- create 成功后务必保存返回的 **id/code**；后续 update 禁止用实体 code 定位，可用 scopeCode+serviceSlug\n- 成功须 `_verification.requestDocsComplete=true`',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown NOT LIKE '%请求参数结构 vs Example（必读）%';

-- Skill: manage
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 请求参数结构补全与定位\n- 完善「请求参数结构」必须 `apiservice_update_service` 传非空 `requestParameterInterface`\n- 定位：**serviceId** > 服务 **code** > **scopeCode+serviceSlug**；禁止实体 code\n- 若报「未找到 code」：用 `apiservice_list_services` / create 返回的 id，勿猜实体名\n- Example 走 `requestOverrides`；与 interface 分开维护',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%请求参数结构补全与定位%';
