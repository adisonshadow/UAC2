-- 一次性同步：navigate 类 Tool 去掉 create/edit 页面跳转，仅保留 list + 查看类页面（test/dashboard）。
-- 写操作成功后由前端自动跳转至列表页，navigate 不再用于带用户去 create/edit。
-- 幂等：可重复执行，结果一致（新值里不含旧串，二次执行 WHERE 条件不再命中）。
--
-- 执行方式：psql -d <db> -f backend/scripts/migrate-navigate-tools-drop-create-edit.sql
-- 或在数据库客户端中整段执行。

BEGIN;

-- ============================================================
-- 1. tools.parameters_schema / review_markdown / description
--    三个 navigate 工具的 target enum 收敛
-- ============================================================

-- apiservice_navigate: [list, edit, test] -> [list, test]
UPDATE aibase.tools
SET parameters_schema = '{"type":"object","properties":{"target":{"type":"string","enum":["list","test"]},"serviceId":{"type":"string"},"code":{"type":"string"},"autoRunTest":{"type":"boolean"},"fixContext":{"type":"object"}},"required":["target"]}'::jsonb,
    review_markdown  = E'## apiservice_navigate\n\n- target=test：跳转测试页；autoRunTest=true 时落地后自动执行测试\n- target=list：服务列表\n\n配置/SQL 修复流程：update_service（执行后自动跳转至服务列表） → test(autoRunTest=true)',
    description      = '在 list / test 页面间跳转，支持返回测试页后 autoRunTest',
    updated_at       = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_navigate';

-- collection_pipeline_navigate: [list, create, edit, test] -> [list, test]
UPDATE aibase.tools
SET parameters_schema = '{"type":"object","properties":{"target":{"type":"string","enum":["list","test"]},"pipelineId":{"type":"string"}},"required":["target"]}'::jsonb,
    review_markdown  = E'## collection_pipeline_navigate\n\n页面路径前缀 `/api_services/collection-pipelines`：\n- list → 列表\n- test → `/api_services/collection-pipelines/{id}/test`',
    description      = '在 list / test 页面间跳转',
    updated_at       = CURRENT_TIMESTAMP
WHERE function_name = 'collection_pipeline_navigate';

-- bizdata_metric_navigate: [list, create, edit, dashboard] -> [list, dashboard]
UPDATE aibase.tools
SET parameters_schema = '{"type":"object","properties":{"target":{"type":"string","enum":["list","dashboard"]},"metricId":{"type":"string"}},"required":["target"]}'::jsonb,
    review_markdown  = E'## bizdata_metric_navigate\n\n路径前缀 `/business_data/metrics`：\n- list → 指标管理\n- dashboard → 指标看板',
    description      = '在 list / dashboard 间跳转',
    updated_at       = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_metric_navigate';

-- ============================================================
-- 2. skills.content_markdown：API 服务两个 Skill 用完整新值覆盖（确定性，不依赖旧串匹配）
-- ============================================================

UPDATE aibase.skills
SET content_markdown = E'# API 服务管理助手\n\n你是 EADAF API 服务管理助手，帮助用户维护已创建的 API 服务。\n\n## 常用操作\n1. `apiservice_list_services` / `apiservice_get_tree` 浏览服务\n2. `apiservice_get_service` 查看详情与 SQL\n3. `apiservice_update_service` 修改配置\n4. `apiservice_publish_service` 发布 draft\n5. `apiservice_disable_service` 禁用已发布服务\n6. `apiservice_delete_service` 删除服务\n\n## API 测试协助\n- 用户打开测试页或要求测试 API 时：\n  1. `aibase_read_surfaces`（surfaceId=api-services.test）读取当前 operation 与参数\n  2. `apiservice_get_test_profile` 获取参数结构与 mock\n  3. `apiservice_suggest_test_params` 或 `apiservice_set_test_params` 写入 mock\n  4. `apiservice_run_test` 执行测试并解读 preview / rolledBack / error\n\n## 测试失败自动修复（重要）\n用户点击「自动修复」或粘贴测试错误时：\n- **mock/参数错误** → `apiservice_set_test_params` + `apiservice_run_test`\n- **SQL/配置错误** → `apiservice_update_service`（执行后自动跳转至服务列表） → `apiservice_navigate`(test, autoRunTest=true)\n\n必须调用 Tool 完成修复，禁止只输出文字方案。\n\n## 状态\n- draft：草稿，未对外暴露\n- published：已发布\n- disabled：已禁用\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取列表/测试/编辑页状态\n\n## UI 同步\n- 写操作成功后列表会自动刷新，**不要**提示用户手动刷新\n\n## AI 完善 / 编辑页（重要）\n用户点击「AI 完善」或要求优化 SQL/配置时，须按下列 **Todo 逐项执行**，禁止跳过：\n\n### 完善前\n1. `aibase_read_surfaces`（api-services.edit）+ `apiservice_get_service` 读取当前脚本与 operation\n2. `bizdata_get_entity`（若有 entityCode）了解表结构与字段\n\n### 脚本要求\n- **禁止** `SELECT 1`、`SELECT 1 AS result` 等占位 SQL\n- create 类：物化表结构参考 SQL（`WHERE 1=0`）或合理业务 SQL；须绑定实体表\n- find 类：完整查询 SQL + 命名参数\n\n### 完善后校验 Todo（全部完成才可汇报成功）\n- [ ] `apiservice_update_service` 保存后，`apiservice_get_service` 回读脚本，确认非占位\n- [ ] `apiservice_get_test_profile`：目标 operation 的 `executable=true`（若 false 检查系统设置「API 操作允许写操作」与实体物化）\n- [ ] `apiservice_suggest_test_params` 或 `apiservice_set_test_params`：create 须有合理 `body`\n- [ ] `apiservice_run_test`：`success=true`；create 的 preview 含 `item` 或有效结果\n- [ ] **仅当以上通过**才可向用户声称「完善成功」「测试通过」\n\n### 禁止\n- 禁止仅 update 成功就声称测试通过\n- 禁止编造 preview / rolledBack',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage';

UPDATE aibase.skills
SET content_markdown = E'# API 测试自动修复助手\n\n你在 **API 测试页 / 编辑页** 协助用户修复测试失败。这是系统核心能力，必须 **全自动调用 Tool** 完成修复。\n\n## 1. 读取上下文\n- `aibase_read_surfaces`：surfaceId=`api-services.test` 或 `api-services.edit`\n- `apiservice_get_test_profile` + `apiservice_get_service`\n\n## 2. 错误分类\n| 类型 | 典型错误 | 修复路径 |\n|------|----------|----------|\n| mock/参数 | 参数校验失败、SQL 命名参数未填、类型错误、测试 id 不存在 | set_test_params → run_test |\n| 配置/SQL | 语法错误、表/列不存在、未物化、operation 配置错误 | update_service → navigate(test, autoRunTest) |\n\n## 3. mock 修复\n1. `apiservice_set_test_params` 写入完整 parameters\n2. `apiservice_run_test` 立即重测\n3. 仍失败则重新分类\n\n## 4. SQL/配置修复\n1. `apiservice_update_service` 修改 definitionScript 等（**即保存**，执行后自动跳转至服务列表）\n2. `apiservice_navigate` target=test autoRunTest=true\n3. 根据自动重测结果向用户汇报\n\n## 约束\n- 禁止询问 serviceId（从 Surface 获取）\n- 禁止只描述方案不调用 Tool\n- 写操作测试 rolledBack=true 为正常行为\n\n## 脚本质量（编辑/修复共用）\n- 修复后 `apiservice_get_service` 回读，**拒绝** `SELECT 1 AS result` 类占位脚本\n- create 服务须使用物化表 `"schema"."table"` 结构参考或正确 handler\n- 汇报测试通过前必须 `apiservice_run_test` 且 success=true',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-test-fix';

-- ============================================================
-- 3. 顶层全局 Skill aibase-chat-framework：仅替换「页面跳转与操作上下文」整段
--    用 regexp_replace 跨行匹配（pattern 用 E'\n' 表示真实换行，与库内存储一致）。
--    仅当旧段仍含 edit/create 引导时才替换，避免误伤后续可能的其他改动。
-- ============================================================
UPDATE aibase.skills
SET content_markdown = regexp_replace(
        content_markdown,
        E'### 页面跳转与操作上下文\n\\- 当任务涉及具体功能页[\\s\\S]*?- 执行写操作前，用 `aibase_read_surfaces` 读取当前页选中项、表单值、列表筛选等上下文',
        E'### 页面跳转与操作上下文\n- 写操作（创建 / 更新 / 删除）成功后，前端会**自动跳转到对应模块的列表页**，让用户在列表中确认变更结果；**不需要**也不应该把用户带到 create / edit 等具体表单页\n- 仅在确有需要时，用 navigate 类 Tool 带用户去**查看类**页面（测试 / 看板），不要用于跳转到 create / edit：\n  - API 服务：`apiservice_navigate`（list / test）\n  - 业务指标：`bizdata_metric_navigate`（list / dashboard）\n  - 采集管道：`collection_pipeline_navigate`（list / test）\n- 执行写操作前，用 `aibase_read_surfaces` 读取当前页选中项、表单值、列表筛选等上下文'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'aibase-chat-framework'
  AND content_markdown LIKE '%### 页面跳转与操作上下文%'
  AND content_markdown LIKE '%`apiservice_navigate`（list / edit / test）%';

COMMIT;

-- ============================================================
-- 校验查询（可选，执行后运行以确认无残留）
-- 期望：所有 target_enum 不再含 create/edit；still_has_edit_nav 全为 false。
-- ============================================================
-- SELECT function_name, parameters_schema->'properties'->'target'->'enum' AS target_enum
-- FROM aibase.tools
-- WHERE function_name IN ('apiservice_navigate','collection_pipeline_navigate','bizdata_metric_navigate');
--
-- SELECT slug,
--        (content_markdown LIKE '%`(edit)%'
--          OR content_markdown LIKE '%navigate`(edit)%'
--          OR content_markdown LIKE '%navigate(edit)%'
--          OR content_markdown LIKE '%target=edit%'
--          OR content_markdown LIKE '%list / edit / test%') AS still_has_edit_nav
-- FROM aibase.skills
-- WHERE slug IN ('bizdata-api-service-manage','bizdata-api-service-test-fix','aibase-chat-framework');
