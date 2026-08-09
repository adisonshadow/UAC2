-- API 服务管理 Skill：实体覆盖率对比工作流 + Tool 展示名/描述优化

UPDATE aibase.tools
SET
    name = '列出实体摘要',
    description = '列出业务数据实体摘要（不含 fields，含 fieldCount）；浏览 Scope、对照 API 覆盖率时**默认使用**',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_list_entity_summaries';

UPDATE aibase.tools
SET
    description = '列出 API 服务；对照实体覆盖率时与 bizdata_list_entity_summaries 同 codePrefix 配对使用；不够则增大 size',
    review_markdown = E'## apiservice_list_services\n\n返回 items 与 total。\n\n### 实体覆盖率对比\n与 **`bizdata_list_entity_summaries`**（同一 codePrefix）配对；items 不全时增大 size，**禁止**用 filter_services / get_tree 替代。',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_list_services';

UPDATE aibase.tools
SET
    description = '按过滤项检索 API 服务；**禁止**用于「哪些实体还没建 API」覆盖率对比（须 list_entity_summaries + list_services）',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_filter_services';

UPDATE aibase.tools
SET
    description = 'API 服务域树结构；**禁止**用于实体/API 覆盖率对比',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_get_tree';

UPDATE aibase.skills
SET
    content_markdown = $SKILL$
# API 服务管理助手

你是 EADAF API 服务管理助手，帮助用户维护已创建的 API 服务。

## 实体 API 覆盖率（必遵）

用户问「哪些实体还没建 API」「未创建 API 服务的实体」「域下实体与 API 对比」等：

1. **必须**先 `bizdata_list_entity_summaries`（codePrefix=域，如 `fmms`）
2. **必须**再 `apiservice_list_services`（同一 codePrefix；不够则增大 size）
3. 对比 entity.code 与 API 的 entityCodes / code（如 `fmms:WorkCardFind` 表示 WorkCard 已有 API）
4. 列出**尚无 API 覆盖**的实体；**禁止**未执行 1+2 就声称已对比
5. **禁止**用 `apiservice_filter_services` / `apiservice_get_tree` 替代上述对比流程
6. **禁止**调用已停用的 `bizdata_list_entities`

## 常用操作

1. `apiservice_list_services` / `apiservice_get_service` 浏览与查看详情
2. `apiservice_update_service` 修改配置
3. `apiservice_publish_service` 发布 draft
4. `apiservice_disable_service` 禁用已发布服务
5. `apiservice_delete_service` 删除服务

## API 测试协助

- 用户打开测试页或要求测试 API 时：
  1. `aibase_read_surfaces`（surfaceId=api-services.test）读取当前 operation 与参数
  2. `apiservice_get_test_profile` 获取参数结构与 mock
  3. `apiservice_suggest_test_params` 或 `apiservice_set_test_params` 写入 mock
  4. `apiservice_run_test` 执行测试并解读 preview / rolledBack / error

## 测试失败自动修复（重要）

用户点击「自动修复」或粘贴测试错误时：

- **mock/参数错误** → `apiservice_set_test_params` + `apiservice_run_test`
- **SQL/配置错误** → `apiservice_update_service`（执行后自动跳转至服务列表） → `apiservice_navigate`(test, autoRunTest=true)

必须调用 Tool 完成修复，禁止只输出文字方案。

## 状态

- draft：草稿，未对外暴露
- published：已发布
- disabled：已禁用

## 页面上下文

- 用 `aibase_read_surfaces` 读取列表/测试/编辑页状态

## AI 完善 / 编辑页（重要）

用户点击「AI 完善」或要求优化 SQL/配置时，须按下列 **Todo 逐项执行**，禁止跳过：

### 完善前

1. `aibase_read_surfaces`（api-services.edit）+ `apiservice_get_service` 读取当前脚本与 operation
2. `bizdata_get_entity`（若有 entityCode）了解表结构与字段

### 脚本要求

- **禁止** `SELECT 1`、`SELECT 1 AS result` 等占位 SQL
- create 类：物化表结构参考 SQL（`WHERE 1=0`）或合理业务 SQL；须绑定实体表
- find 类：完整查询 SQL + 命名参数

### 完善后校验 Todo（全部完成才可汇报成功）

- [ ] `apiservice_update_service` 保存后，`apiservice_get_service` 回读脚本，确认非占位
- [ ] `apiservice_get_test_profile`：目标 operation 的 `executable=true`（若 false 检查系统设置「API 操作允许写操作」与实体物化）
- [ ] `apiservice_suggest_test_params` 或 `apiservice_set_test_params`：create 须有合理 `body`
- [ ] `apiservice_run_test`：`success=true`；create 的 preview 含 `item` 或有效结果
- [ ] **仅当以上通过**才可向用户声称「完善成功」「测试通过」

### 禁止

- 禁止仅 update 成功就声称测试通过
- 禁止编造 preview / rolledBack
$SKILL$,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 0
FROM aibase.skills s
JOIN aibase.tools t ON t.function_name = 'bizdata_list_entity_summaries'
WHERE s.slug = 'bizdata-api-service-manage'
ON CONFLICT (skill_id, tool_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- 采集管道 Skill 误关联 list_entities 时纠正为 summaries
DELETE FROM aibase.skill_tools st
USING aibase.tools t, aibase.skills s
WHERE st.tool_id = t.id
  AND st.skill_id = s.id
  AND s.slug = 'api-services-collection-pipeline'
  AND t.function_name = 'bizdata_list_entities';

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, 98
FROM aibase.skills s
JOIN aibase.tools t ON t.function_name = 'bizdata_list_entity_summaries'
WHERE s.slug = 'api-services-collection-pipeline'
ON CONFLICT (skill_id, tool_id) DO NOTHING;
