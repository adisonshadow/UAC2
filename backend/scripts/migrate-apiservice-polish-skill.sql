-- API 服务「AI 完善」：禁止占位 SQL，强制校验 Todo

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_update_service\n\nserviceId 或 code 定位服务；可更新 scopeCode、serviceSlug、scriptMode、handlerScript、requestParameterInterface、accessRestriction；仅传需修改字段。\n\n### SQL 脚本（重要）\n- **禁止**写入占位 SQL：`SELECT 1`、`SELECT 1 AS result`、与业务无关的常量查询\n- **create** 类（operation=create）：definitionScript 应为绑定实体物化表的结构参考，例如：\n  ```sql\n  SELECT *\n  FROM "bizdata_mat"."equipment"\n  WHERE 1 = 0\n  ```\n  运行时由 Gateway 根据 body 执行 INSERT，不是靠 SELECT 写入\n- **find** 类：须 `FROM` 物化表或合理子查询，含 `:limit`、`:skip` 等命名参数\n- **typescript**：handler 须 export async function handler(ctx)，写操作使用 ctx 提供的 queryPg\n\n### 更新后校验（必须）\n1. 本 Tool 成功后 **必须** `apiservice_get_service` 回读 definitionScript/handlerScript\n2. 确认脚本非占位、operation 与 enabledOperations 一致\n3. 用户要求完善/可测试时：**必须** `apiservice_run_test` 且 `success=true` 才可声称测试通过\n4. **禁止**仅 update 成功就声称「完善成功」或「测试通过」',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_update_service';

UPDATE aibase.tools
SET
    review_markdown = E'## apiservice_run_test\n\n### 成功判定\n- `success: true` 且 `verified: true` 才可声称测试通过\n- `success: false` 须展示 `error` / `validationErrors`，并进入修复流程\n- `executable: false` / 仅校验 **不算** 测试通过\n- create 类：`preview` 应含 `item` 或有效写入结果；rolledBack=true 为正常\n- **禁止**未调用本 Tool 就声称测试通过\n\n### 禁止接受的脚本结果\n- 若 get_service 显示 definitionScript 为 `SELECT 1` 等占位 SQL，须先 update_service 修正再测',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_run_test';

UPDATE aibase.skills
SET
    content_markdown = content_markdown || E'\n\n## AI 完善 / 编辑页（重要）\n用户点击「AI 完善」或要求优化 SQL/配置时，须按下列 **Todo 逐项执行**，禁止跳过：\n\n### 完善前\n1. `aibase_read_surfaces`（api-services.edit）+ `apiservice_get_service` 读取当前脚本与 operation\n2. `bizdata_get_entity`（若有 entityCode）了解表结构与字段\n\n### 脚本要求\n- **禁止** `SELECT 1`、`SELECT 1 AS result` 等占位 SQL\n- create 类：物化表结构参考 SQL（`WHERE 1=0`）或合理业务 SQL；须绑定实体表\n- find 类：完整查询 SQL + 命名参数\n\n### 完善后校验 Todo（全部完成才可汇报成功）\n- [ ] `apiservice_update_service` 保存后，`apiservice_get_service` 回读脚本，确认非占位\n- [ ] `apiservice_get_test_profile`：目标 operation 的 `executable=true`（若 false 检查系统设置「API 操作允许写操作」与实体物化）\n- [ ] `apiservice_suggest_test_params` 或 `apiservice_set_test_params`：create 须有合理 `body`\n- [ ] `apiservice_run_test`：`success=true`；create 的 preview 含 `item` 或有效结果\n- [ ] **仅当以上通过**才可向用户声称「完善成功」「测试通过」\n\n### 禁止\n- 禁止仅 update 成功就声称测试通过\n- 禁止编造 preview / rolledBack',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%完善后校验 Todo%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown || E'\n\n## 脚本质量（编辑/修复共用）\n- 修复后 `apiservice_get_service` 回读，**拒绝** `SELECT 1 AS result` 类占位脚本\n- create 服务须使用物化表 `"schema"."table"` 结构参考或正确 handler\n- 汇报测试通过前必须 `apiservice_run_test` 且 success=true',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-test-fix'
  AND content_markdown NOT LIKE '%脚本质量（编辑/修复共用）%';

-- manage skill 绑定 bizdata_get_entity（AI 完善需读实体结构）
INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 100
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'bizdata-api-service-manage'
  AND t.function_name = 'bizdata_get_entity'
ON CONFLICT DO NOTHING;
