-- API 服务 Skill/Tool：强制 Tool 校验成功后才可声称完成

UPDATE aibase.tools SET
    review_markdown = E'## apiservice_create_service\n\n- **一个 API 服务 = 一个主 operation**（如 create、find）\n- **禁止**向用户索要 connectionId\n- enabledOperations **只传一项**，如 `["create"]`\n- create 类服务 code 建议：`equipment:EquipmentCreate`\n\n### 成功判定（必须）\n1. Tool 返回 `id` 且 `_verification.verified=true`\n2. `_verification.listedInApiList=true` 表示列表可见\n3. **禁止**未调用本 Tool 就声称「创建成功」\n4. 创建后须 `apiservice_list_services`（codePrefix）二次确认\n\n### 发布 + 测试\n- `publish:true` 后检查 `_verification.status=published`\n- 声称「测试通过」前必须 `apiservice_run_test`，且 `success=true`',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_create_service';

UPDATE aibase.tools SET
    review_markdown = E'## apiservice_publish_service\n\n发布 draft → published。\n\n### 成功判定\n- 返回 `_verification.status` 必须为 `published`\n- **禁止**未调用本 Tool 就声称已发布',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_publish_service';

UPDATE aibase.tools SET
    review_markdown = E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true` 才可声称测试通过\n- `success: false` 须展示 `error` / `validationErrors`，并进入修复流程\n- **禁止**未调用本 Tool 就声称测试通过',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_run_test';

UPDATE aibase.tools SET
    review_markdown = E'## apiservice_list_services\n\n创建/发布后的**必调校验 Tool**。\n\n- 用 `codePrefix`（如 equipment）过滤\n- 在 items 中按 `code` 精确匹配确认服务存在\n- 向用户汇报时引用 items 中的 `id`、`status`',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_list_services';

UPDATE aibase.skills SET
    content_markdown = regexp_replace(
        content_markdown,
        E'## 工作流程[\\s\\S]*?(?=\\n## |$)',
        E'## 工作流程\n1. 解析引用，**不要**追问连接\n2. `bizdata_get_entity` 了解表结构\n3. `apiservice_list_services`（codePrefix）检查是否已存在\n4. `apiservice_create_service` 创建（enabledOperations 一项，如 create）\n5. **校验**：检查 Tool 返回 `_verification.verified` 与 `listedInApiList`；再 `apiservice_list_services` 按 code 确认\n6. 需要发布 → `apiservice_publish_service`，检查 `_verification.status=published`\n7. 需要测试 → `apiservice_run_test`，仅当 `success=true` 才可说测试通过\n8. **禁止**未调用 Tool 或 Tool 无 verification/success 字段时声称成功\n9. 列表页会自动刷新，可提示用户在左侧域树选择对应 scope',
        'g'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-create'
  AND content_markdown LIKE '%## 工作流程%';

UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 成功汇报约束\n- 创建：须 `apiservice_create_service` 返回 `_verification`\n- 发布：须 `apiservice_publish_service` 且 status=published\n- 测试：须 `apiservice_run_test` 且 success=true\n- 汇报前推荐 `apiservice_list_services` 或 `apiservice_get_service` 二次确认\n- **禁止**编造 id/code/status；Tool 失败须原样展示 error',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%成功汇报约束%';

-- 创建 Skill 补充 publish/run_test/list 工具
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 100 + row_number() OVER (ORDER BY t.function_name)
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-create'
  AND t.function_name IN (
    'apiservice_publish_service',
    'apiservice_run_test',
    'apiservice_get_service'
  )
ON CONFLICT DO NOTHING;
