-- API 测试 mock 参数：测试成功后须 set_test_params 持久化

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_set_test_params\n\n传 operation（必填）+ parameters 或 mockParameters（完整 JSON 对象）。\n\n### 作用\n- **持久化**到服务 security_config.testMockParameters（按 operation 存储）\n- mutation 同步到 surfaceId=api-services.test 的表单\n\n### 调用时机（重要）\n- 参数类问题：`run_test` **执行成功后**必须调用本 Tool 保存已通过测试的 mock\n- 生成/完善 mock 后测试通过，同样必须保存\n- 禁止仅 run_test 成功就结束而不保存 mock',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_set_test_params';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true` 才可声称测试通过\n- `success: false` 须展示 `error` / `validationErrors`，并进入修复流程\n- `executable: false` / 仅校验 **不算** 测试通过\n- create 类：`preview` 应含 `item` 或有效写入结果\n- **禁止**未调用本 Tool 就声称测试通过\n\n### 测试成功后（参数类修复）\n- 执行成功后会自动持久化 mock（savedMockParameters）\n- **仍须**接着 `apiservice_set_test_params` 显式保存并同步表单（传相同 operation + parameters）\n- 禁止仅 run_test 成功就结束\n\n执行测试并将结果同步到测试页（mutation: test_completed）。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_run_test';

UPDATE aibase.skills
SET
    content_markdown = content_markdown || E'\n\n## Mock 参数持久化（测试页）\n- `apiservice_run_test` 执行成功后，**必须** `apiservice_set_test_params` 保存已通过测试的 mock（operation + parameters）\n- 已保存 mock 会在 `apiservice_get_test_profile` 中作为默认值返回（mockParametersSource=saved）\n- 参数类修复流程：修正 parameters → run_test → **成功后 set_test_params**',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('bizdata-api-service-manage', 'bizdata-api-service-test-fix')
  AND content_markdown NOT LIKE '%Mock 参数持久化（测试页）%';
