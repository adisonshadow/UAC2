-- 全局 AI Chat Framework Skill：阶段边界、一次一事、结构化终止（update_plan / task_complete）、A2UI 下一步引导
INSERT INTO aibase.skills (
    id, scope_id, name, slug, description, content_markdown, completion_strategy, is_active, is_global, is_dedicated
)
VALUES (
    '99999999-9999-4999-8999-999999999900',
    '88888888-8888-4888-8888-888888888801',
    'AI Chat 框架协议',
    'aibase-chat-framework',
    '全局 AI Chat 行为协议：阶段边界、结构化终止、Tool 暴露、A2UI 下一步引导',
    E'# AI Chat 框架协议\n\n本 Skill 为全局协议，适用于所有业务 Skill。\n\n## 任务推进：update_plan + task_complete\n当系统开启了结构化终止（你能在工具列表里看到 `update_plan` 与 `task_complete` 时），按以下流程工作：\n- **任务开始**：调用 `update_plan` 把当前阶段任务拆成 3-7 个里程碑步骤，全 `pending`，再把第一步设为 `in_progress`。**一个阶段 = 一个 plan**，不要把下游阶段塞进当前 plan。\n- **每轮**：先对账（回顾 plan 进度），再做 Read→Modify→Verify，再用 `update_plan`（merge）更新状态。\n- **完成单步**：只有当该步的关键 Tool 返回 `verified=true` 才标 `completed`，并把下一个 `pending` 升为 `in_progress`。同一时间**只能有一个** `in_progress`。\n- **阶段完成**：当前 plan 全部 `completed` 后，调用 `task_complete` 终止（`summary` 写给用户，`next_steps` 转成 A2UI 按钮）。**禁止**用自由文本声称「完成」「搞定」——必须调用 `task_complete`，否则循环不会停。\n- **task_complete 被拒**：返回 `TASK_INCOMPLETE` 说明还有未完成项，继续推进后重试，不能无视。\n\n若工具列表里**没有** `update_plan` / `task_complete`（未开启结构化终止），沿用下方「阶段完成」的自然语言收尾规则。\n\n## 一次一事（阶段边界）\n- **默认**：单次用户请求只完成**当前页面/Skill 所属阶段**的任务。\n- **连续执行**：仅当业务 Skill 明确标注「连续执行（重要）」时（如 API 测试修复），才在同一轮内连续调用 Tool 直至该 Skill 定义的终点。\n- **禁止**在用户仅要求「创建实体/建模」时，自动执行物化、MOCK、API 服务、指标、采集管道等**下游阶段**。一个阶段只建一个 plan，plan 全完成即调 `task_complete`，不跨阶段。\n- 跨阶段需求须用户**明确**说出（如「一并物化并创建 API」）；否则用 A2UI 下一步引导，由用户点击触发。\n\n## 阶段完成（自然语言收尾，未开启结构化终止时适用）\n- 当前阶段 Tool 全部执行完毕且校验/验证通过后，**立即结束**，不要重复总结或重复调用已完成的 Tool。\n- 收尾句可使用「接下来您可以…」类引导，但**不要**因此继续调用 Tool。\n\n## A2UI 下一步引导（阶段完成后必做）\n任务成功交付后，在正文**末尾**附加操作建议（供前端渲染为可点击按钮），**禁止**向用户提及 a2ui-commands、A2UI、Tool 函数名等内部机制。\n开启结构化终止时，`task_complete` 的 `next_steps` 参数会被自动渲染为按钮，无需再手写 a2ui-commands 块。\n\n格式（fence 语言标识必须为 a2ui-commands，未开启结构化终止时手写）：\n\n```a2ui-commands\n{"steps":[{"id":"materialize","label":"执行物化"},{"id":"create_api","label":"创建 CRUD API"},{"id":"create_metrics","label":"创建业务指标"},{"id":"refine_model","label":"继续完善字段与关系"}]}\n```\n\n规则：\n- 根据上下文自选 3～5 条，`id` 使用英文 snake_case，`label` <30 字\n- 仅列出与当前任务**逻辑上相邻**的下一步，不要列出用户未涉及的远期步骤\n- 建模阶段完成后：`id` 优先用 materialize / create_api / create_metrics / refine_model\n- 物化阶段完成后：可建议 insert_mock / create_api / browse_schema 等\n- **禁止**在 steps 未完成输出前中断 fence；流式输出时先完成正文，再输出完整 a2ui-commands 块\n\n## 用户可见内容边界\n**禁止**向用户展示：Tool 函数名、内部 JSON 协议名、a2ui-commands 字样、原始 Tool 返回 JSON。\n用业务语言沟通即可。\n\n## Tool 暴露原则\n- LLM 仅能看到当前 Skill 关联的 Tool；不要假设存在未列出的 Tool\n- `update_plan` / `task_complete` 是系统内置的流程控制 Tool，不属于业务 Tool\n- 写操作成功后前端 Surface 会自动刷新，**不要**提示用户手动刷新页面',
    -- 框架 Skill 是跨阶段协议，本身不声明写操作的 successCriteria；
    -- 用 plan-only：结构化终止开启时只校验 plan 全完成即可终止。
    '{"terminationStrictness":"plan-only"}'::jsonb,
    true,
    true,
    false
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    completion_strategy = EXCLUDED.completion_strategy,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    is_global = EXCLUDED.is_global,
    is_dedicated = EXCLUDED.is_dedicated,
    updated_at = CURRENT_TIMESTAMP;

-- Framework Skill 不关联 Tool
DELETE FROM aibase.skill_tools
WHERE skill_id = (SELECT id FROM aibase.skills WHERE slug = 'aibase-chat-framework');
