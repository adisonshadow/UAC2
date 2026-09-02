-- 钩子管理 Skill（hook-center-manage）幂等种子：skill + tools + skill_tools + skill_applications
-- 存量库可重复执行；新库经 aibase-ai-seed.sql / initdb 增量段获得同内容
BEGIN;

-- ===== skill =====
INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_active, is_global, is_dedicated, completion_strategy, created_at, updated_at)
VALUES (
  '77777777-7777-4777-8777-7777777777a0',
  '55555555-5555-4555-8555-555555555501',
  '钩子管理',
  'hook-center-manage',
  '事件钩子的创建、试跑、修复与运行排查',
  '# 钩子管理 Skill

你是 EADAF 钩子管理助手。钩子 = 「当某事件发生且条件满足 → 执行某动作」。入口：API 服务 → 钩子管理（/api_services/hooks）。

## 事件体系（单一事实源）

- `auth.user.login` / `auth.user.logout`：用户登录/登出
- `bizdata.record.created|updated|deleted`：已发布 Data API HTTP 网关实体写（负载含 before/after/changed_fields；自定义 SQL / TS Handler 不触发）
- `apiservice.invoked`：Data API HTTP 调用完成（成功/失败均发；可按 status 过滤）
- `schedule.cron`：定时（eventFilter.cron 五段式，服务器时区）
- `manual.test`：测试面板/AI 试跑

**禁止凭记忆编造事件类型或负载字段**：创建前必须 `hook_list_event_types`。

## 动作类型

- `http_request`：外呼（`{{payload.*}}` 插值、可选鉴权、响应判定规则；内网地址被 SSRF 拦截）
- `internal_api`：调用内部已发布 API 服务（系统身份；会引起 depth+1 的后续事件）
- `script`：TypeScript 沙箱脚本 `handler(event, ctx)`，可用 `event.payload` / `ctx.log(...)`（落运行记录）/ `db(''实体code'')`；无网络与文件；默认 5s 超时

## 强制 SOP

1. **查目录**：`hook_list_event_types` 确认事件与 payload 结构；需要内部 API 时先查已发布服务清单。
2. **收窄触发**：按实体/服务/字段/状态填 eventFilter；复杂条件才用 conditionExpr（绑定 payload）。
3. **脚本检查**：script 类型必须 `hook_check_script` 通过，否则禁止保存。
4. **落库**：表单页用 `hook_suggest_config` 同步草稿待用户确认；用户明确要求直接保存时才 `hook_create_hook` / `hook_update_hook`。
5. **试跑验证**：`hook_test_hook` 用事件目录 example 构造 mock；失败必须自动修复重测至 success（禁止只给文字建议）。
6. **提醒状态**：新建钩子为草稿，需启用后触发；启用走 `hook_enable_hook` 或列表页。

## 排查口径

- 未触发 → 查 `hook_list_runs` 是否 skipped（条件不匹配）或 suppressed（循环深度≥3 / 队列满）
- 失败 → 看 run 的 error 与 logs；修复后用 `hook_retry_run` 以原始负载重放验证
- 连续失败 10 次 → 自动停用（auto_disabled），修复后须重新启用',
  true,
  false,
  true,
  '{"structuredTermination": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  content_markdown = EXCLUDED.content_markdown,
  is_active = EXCLUDED.is_active,
  is_dedicated = EXCLUDED.is_dedicated,
  updated_at = CURRENT_TIMESTAMP;

-- ===== tools（function_name 与前端 registerHookTools TOOL_NAMES 一致） =====
INSERT INTO aibase.tools (id, scope_id, name, slug, function_name, description, execution_type, parameters_schema, review_markdown, server_config, is_active, created_at, updated_at)
VALUES
(
  '66666666-6666-4666-8666-6666666666b0',
  '55555555-5555-4555-8555-555555555501',
  '列出钩子事件目录',
  'hook-list-event-types',
  'hook_list_event_types',
  '列出钩子可用的事件类型目录（含负载 JSON Schema 与示例）。创建钩子前必须先调用',
  'client',
  '{"type":"object","properties":{},"required":[]}'::jsonb,
  '## hook_list_event_types',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b1',
  '55555555-5555-4555-8555-555555555501',
  '列出钩子',
  'hook-list-hooks',
  'hook_list_hooks',
  '列出钩子（可按状态过滤），含最近运行与近7天成功率',
  'client',
  '{"type":"object","properties":{"status":{"type":"string","description":"draft|enabled|disabled|auto_disabled，不传查全部"}},"required":[]}'::jsonb,
  '## hook_list_hooks',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b2',
  '55555555-5555-4555-8555-555555555501',
  '获取钩子详情',
  'hook-get-hook',
  'hook_get_hook',
  '获取钩子完整配置（触发条件、动作、失败策略；密钥已脱敏）',
  'client',
  '{"type":"object","required":["hookId"],"properties":{"hookId":{"type":"string"}}}'::jsonb,
  '## hook_get_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b3',
  '55555555-5555-4555-8555-555555555501',
  '创建钩子',
  'hook-create-hook',
  'hook_create_hook',
  '创建钩子（草稿）。script 动作须先 hook_check_script；创建后建议 hook_test_hook',
  'client',
  '{"type":"object","required":["name","eventType","actionType","actionConfig"],"properties":{"name":{"type":"string"},"description":{"type":"string"},"eventType":{"type":"string"},"eventFilter":{"type":"object"},"conditionExpr":{"type":"string"},"actionType":{"type":"string"},"actionConfig":{"type":"object"},"failurePolicy":{"type":"object"}}}'::jsonb,
  '## hook_create_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b4',
  '55555555-5555-4555-8555-555555555501',
  '更新钩子',
  'hook-update-hook',
  'hook_update_hook',
  '更新钩子配置（version+1；密钥留空保留）',
  'client',
  '{"type":"object","required":["hookId","name","eventType","actionType","actionConfig"],"properties":{"hookId":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"},"eventType":{"type":"string"},"eventFilter":{"type":"object"},"conditionExpr":{"type":"string"},"actionType":{"type":"string"},"actionConfig":{"type":"object"},"failurePolicy":{"type":"object"}}}'::jsonb,
  '## hook_update_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b5',
  '55555555-5555-4555-8555-555555555501',
  '删除钩子',
  'hook-delete-hook',
  'hook_delete_hook',
  '软删钩子（运行历史保留）',
  'client',
  '{"type":"object","required":["hookId"],"properties":{"hookId":{"type":"string"}}}'::jsonb,
  '## hook_delete_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b6',
  '55555555-5555-4555-8555-555555555501',
  '启用钩子',
  'hook-enable-hook',
  'hook_enable_hook',
  '启用钩子（清零连续失败计数）',
  'client',
  '{"type":"object","required":["hookId"],"properties":{"hookId":{"type":"string"}}}'::jsonb,
  '## hook_enable_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b7',
  '55555555-5555-4555-8555-555555555501',
  '禁用钩子',
  'hook-disable-hook',
  'hook_disable_hook',
  '禁用钩子',
  'client',
  '{"type":"object","required":["hookId"],"properties":{"hookId":{"type":"string"}}}'::jsonb,
  '## hook_disable_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b8',
  '55555555-5555-4555-8555-555555555501',
  '检查钩子脚本',
  'hook-check-script',
  'hook_check_script',
  '对钩子 TypeScript 脚本做语法/类型检查。保存 script 类型前必须通过',
  'client',
  '{"type":"object","required":["source"],"properties":{"source":{"type":"string"}}}'::jsonb,
  '## hook_check_script',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666b9',
  '55555555-5555-4555-8555-555555555501',
  '试跑钩子',
  'hook-test-hook',
  'hook_test_hook',
  '用 mock 负载试跑钩子（不计入正式成功率）',
  'client',
  '{"type":"object","required":["hookId"],"properties":{"hookId":{"type":"string"},"mockPayload":{"type":"object"}}}'::jsonb,
  '## hook_test_hook',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666ba',
  '55555555-5555-4555-8555-555555555501',
  '列出钩子运行历史',
  'hook-list-runs',
  'hook_list_runs',
  '查询钩子运行历史（可按状态过滤）',
  'client',
  '{"type":"object","required":["hookId"],"properties":{"hookId":{"type":"string"},"status":{"type":"string"}}}'::jsonb,
  '## hook_list_runs',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666bb',
  '55555555-5555-4555-8555-555555555501',
  '重放钩子运行',
  'hook-retry-run',
  'hook_retry_run',
  '用历史运行的原始负载重放（新 event_id，trigger_source=replay）',
  'client',
  '{"type":"object","required":["runId"],"properties":{"runId":{"type":"string"}}}'::jsonb,
  '## hook_retry_run',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666bc',
  '55555555-5555-4555-8555-555555555501',
  '建议钩子配置草稿',
  'hook-suggest-config',
  'hook_suggest_config',
  '将钩子配置草稿同步到当前打开的钩子表单（不保存）',
  'client',
  '{"type":"object","required":["name","eventType","actionType","actionConfig"],"properties":{"name":{"type":"string"},"description":{"type":"string"},"eventType":{"type":"string"},"eventFilter":{"type":"object"},"conditionExpr":{"type":"string"},"actionType":{"type":"string"},"actionConfig":{"type":"object"},"failurePolicy":{"type":"object"}}}'::jsonb,
  '## hook_suggest_config',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '66666666-6666-4666-8666-6666666666bd',
  '55555555-5555-4555-8555-555555555501',
  '跳转钩子页',
  'hook-navigate',
  'hook_navigate',
  '跳转到钩子管理相关页面（列表/新建/编辑/运行历史）',
  'client',
  '{"type":"object","required":["target"],"properties":{"target":{"type":"string","description":"list|create|edit|runs"},"hookId":{"type":"string"}}}'::jsonb,
  '## hook_navigate',
  '{}'::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  function_name = EXCLUDED.function_name,
  description = EXCLUDED.description,
  parameters_schema = EXCLUDED.parameters_schema,
  review_markdown = EXCLUDED.review_markdown,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

-- ===== skill_tools =====
INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT v.id::uuid, '77777777-7777-4777-8777-7777777777a0'::uuid, v.tool_id::uuid, v.sort_order
FROM (VALUES
  ('c1000000-0000-4000-8000-0000000000b0', '66666666-6666-4666-8666-6666666666b0', 0),
  ('c1000000-0000-4000-8000-0000000000b1', '66666666-6666-4666-8666-6666666666b1', 1),
  ('c1000000-0000-4000-8000-0000000000b2', '66666666-6666-4666-8666-6666666666b2', 2),
  ('c1000000-0000-4000-8000-0000000000b3', '66666666-6666-4666-8666-6666666666b3', 3),
  ('c1000000-0000-4000-8000-0000000000b4', '66666666-6666-4666-8666-6666666666b4', 4),
  ('c1000000-0000-4000-8000-0000000000b5', '66666666-6666-4666-8666-6666666666b5', 5),
  ('c1000000-0000-4000-8000-0000000000b6', '66666666-6666-4666-8666-6666666666b6', 6),
  ('c1000000-0000-4000-8000-0000000000b7', '66666666-6666-4666-8666-6666666666b7', 7),
  ('c1000000-0000-4000-8000-0000000000b8', '66666666-6666-4666-8666-6666666666b8', 8),
  ('c1000000-0000-4000-8000-0000000000b9', '66666666-6666-4666-8666-6666666666b9', 9),
  ('c1000000-0000-4000-8000-0000000000ba', '66666666-6666-4666-8666-6666666666ba', 10),
  ('c1000000-0000-4000-8000-0000000000bb', '66666666-6666-4666-8666-6666666666bb', 11),
  ('c1000000-0000-4000-8000-0000000000bc', '66666666-6666-4666-8666-6666666666bc', 12),
  ('c1000000-0000-4000-8000-0000000000bd', '66666666-6666-4666-8666-6666666666bd', 13)
) AS v(id, tool_id, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM aibase.skill_tools st
  WHERE st.skill_id = '77777777-7777-4777-8777-7777777777a0'
    AND st.tool_id = v.tool_id::uuid
);

-- 关联 EADAF 主应用（dedicated skill 仅对关联应用可见）
INSERT INTO aibase.skill_applications (skill_id, application_id, created_at)
SELECT s.id, '10000000-0000-4000-8000-000000000002', CURRENT_TIMESTAMP
FROM aibase.skills s
WHERE s.slug = 'hook-center-manage'
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_applications sa
    WHERE sa.skill_id = s.id AND sa.application_id = '10000000-0000-4000-8000-000000000002'
  );

COMMIT;
