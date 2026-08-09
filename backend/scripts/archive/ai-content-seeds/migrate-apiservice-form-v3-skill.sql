-- API 服务表单 v3：Skill / Tool 对齐（分区表单、Response Example 禁止 item:null）

-- Tool: create_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        jsonb_set(
            parameters_schema,
            '{properties,responseOverrides}',
            '{"type":"object","description":"按 operation 覆盖 { responsesSchema, responseExample }"}'::jsonb
        ),
        '{properties,requestOverrides}',
        '{"type":"object","description":"按 operation 覆盖 { requestExample }"}'::jsonb
    ),
    review_markdown = E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId；使用 **scopeCode + serviceSlug** 或 code\n- enabledOperations **只传一项**，如 `["create"]`\n- scriptMode=typescript 时写 handlerScript，否则写 definitionScript（SQL）\n- tags 为 **string[]**（标签输入组件，非逗号字符串）\n\n### 请求 / 响应文档（v3 表单）\n- `requestParameterInterface`：设计期 TS interface\n- `requestOverrides`：按 operation 保存请求 Example JSON\n- `responseOverrides`：按 operation 保存 Responses Schema + Response Example\n- **禁止** Response Example 中 `data.item: null` 或空占位；须根据 `bizdata_get_entity` 字段生成具体示例\n- create/findOne：`data.item` 含 `id`（UUID）及实体字段示例值\n- find：`data.items` 至少 1 条，`total` ≥ 1\n\n### 成功判定（必须）\n- Tool 返回 `id` 且 `_verification.verified=true`\n- `_verification.listedInApiList=true` 表示列表可见\n- **禁止**未调用本 Tool 就声称创建成功\n- 创建后须 `apiservice_list_services` 按 code 二次确认',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

-- Tool: update_service
UPDATE aibase.tools
SET
    parameters_schema = jsonb_set(
        jsonb_set(
            parameters_schema,
            '{properties,responseOverrides}',
            '{"type":"object","description":"按 operation 覆盖 { responsesSchema, responseExample }"}'::jsonb
        ),
        '{properties,requestOverrides}',
        '{"type":"object","description":"按 operation 覆盖 { requestExample }"}'::jsonb
    ),
    review_markdown = E'## apiservice_update_service\n\nserviceId 或 code 定位服务；可更新 scopeCode、serviceSlug、scriptMode、handlerScript、requestParameterInterface、accessRestriction、transportProtocols、responseOverrides、requestOverrides；仅传需修改字段。\n\n### SQL 脚本（重要）\n- **禁止**写入占位 SQL：`SELECT 1`、`SELECT 1 AS result`、与业务无关的常量查询\n- **create** 类（operation=create）：definitionScript 应为绑定实体物化表的结构参考，例如：\n  ```sql\n  SELECT *\n  FROM "bizdata_mat"."equipment"\n  WHERE 1 = 0\n  ```\n  运行时由 Gateway 根据 body 执行 INSERT，不是靠 SELECT 写入\n- **find** 类：须 `FROM` 物化表或合理子查询，含 `:limit`、`:skip` 等命名参数\n- **typescript**：handler 须 export async function handler(ctx)，写操作使用 ctx 提供的 queryPg\n\n### 响应文档（重要）\n- 完善/编辑时**必须**同步 `responseOverrides` 与 `requestOverrides`\n- **禁止** `responseExample` 中 `"item": null`；须写入含实体字段的完整示例对象\n- find 的 `items` 数组至少一条示例记录\n\n### 更新后校验（必须）\n1. 本 Tool 成功后 **必须** `apiservice_get_service` 回读 definitionScript/handlerScript 与 responseOverrides\n2. 确认脚本非占位、operation 与 enabledOperations 一致\n3. 用户要求完善/可测试时：**必须** `apiservice_run_test` 且 `success=true` 才可声称测试通过\n4. **禁止**仅 update 成功就声称「完善成功」或「测试通过」',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

-- Skill: bizdata-api-service-create
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 表单结构（v3）\n页面分区：**信息** / **请求** / **处理** / **响应**（`aibase_read_surfaces` surfaceId=api-services.create）\n\n- **信息**：主操作类型（行内 HTTP 方法 + help）、Scope、服务短名（label 旁 Code 标签可查看 code/路径）、显示名称、标签（Tag 数组）、卡片底部访问端点预览\n- **请求**：请求参数 interface + 请求 Example（JSON）分栏；GET 走 query string\n- **处理**：SQL / TypeScript Handler\n- **响应**：Responses Schema (200) + Response Example (200) 分栏\n\n## Response Example 规范\n- **禁止** `"item": null`、空对象占位\n- 有实体时先 `bizdata_get_entity`，按字段生成 `data.item` 或 `data.items[]` 示例\n- 通过 `responseOverrides` / `requestOverrides` 与 create_service 一并保存',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown NOT LIKE '%表单结构（v3）%';

-- Skill: bizdata-api-service-manage
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 表单结构（v3，编辑/完善）\n`surfaceId=api-services.edit`：信息 / 请求 / 处理 / 响应 四区块。\n\n- 标签字段为 **string[]**（AntdTagInput）\n- 服务短名 label 旁 **Code** 标签：悬停/点击查看 `scope:Slug` 与 API 路径\n- 响应区 Schema 与 Example **分开维护**；Schema 可用 `$refEntity`（如 `@web:user`）\n\n## Response Example 规范（完善时必遵）\n- **禁止** Response Example 出现 `"item": null`\n- create / findOne / updateOne：`data.item` 为含 `id` 与业务字段的完整示例\n- find：`data.items` 至少 1 条，`total` ≥ 1\n- 使用 `apiservice_update_service` 的 `responseOverrides`、`requestOverrides` 持久化\n- 完善后 `apiservice_get_service` 回读确认 Example 已更新',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%表单结构（v3，编辑/完善）%';

-- Skill: bizdata-api-service-test-fix
UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 表单 v3 与响应文档\n编辑页响应区含 Responses Schema 与 Response Example。修复配置时若 Example 为 `item:null`，须 `bizdata_get_entity` 后通过 `responseOverrides` 写入真实字段示例，再 `update_service`。',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-test-fix'
  AND content_markdown NOT LIKE '%表单 v3 与响应文档%';
