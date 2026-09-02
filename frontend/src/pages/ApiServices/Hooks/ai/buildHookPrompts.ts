/**
 * 钩子 AI 生成提示词：引导模型走「读事件目录 →（按需查 API 服务）→ 组装配置 → 建议草稿/创建 → 试跑验证」闭环。
 */
export function buildHookGeneratePrompt(context: {
  requirement?: string;
  hookId?: string;
} = {}) {
  const { requirement, hookId } = context;
  return [
    '请帮我创建/编写一个钩子（Hook）。',
    requirement ? `我的需求：${requirement}` : '请根据当前表单已填内容补全配置。',
    '',
    '执行步骤（严格遵循）：',
    '1. 先调用 hook_list_event_types 获取事件目录，确认应使用的 eventType 与 payload 结构（不要凭记忆编造事件类型或字段）。',
    '2. 若需要调用内部 API 服务，用已有工具查询可用的已发布 API 服务清单后选择 apiServiceId。',
    '3. 组装钩子配置：',
    '   - 事件过滤 eventFilter 按需收窄（实体/服务/变更字段/状态），避免全量触发；',
    '   - 复杂条件用 conditionExpr（绑定 payload），简单场景不要加；',
    '   - 动作三选一：http_request（{{payload.*}} 插值）/ internal_api / script。',
    '4. script 类型：必须先调用 hook_check_script 且通过（签名 handler(event, ctx)，可用 event.payload、ctx.log、db(实体code)；无网络访问）。',
    '5. 落库：表单页场景调用 hook_suggest_config 同步草稿给我确认；用户明确要求直接保存时才用 hook_create_hook / hook_update_hook。',
    '6. 已保存的钩子必须调用 hook_test_hook 用事件目录的 example 构造 mock 负载试跑；失败则根据错误修复后重测，直到 success。',
    '7. 试跑通过后提醒我：钩子当前为草稿，需在列表页启用后才会真正触发。',
    hookId ? `当前正在编辑的钩子 id：${hookId}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 试跑失败后的自动修复提示词 */
export function buildHookTestAutoFixPrompt(context: {
  hookId: string;
  hookName?: string;
  runStatus?: string;
  error?: string | null;
  logs?: string[] | null;
  output?: unknown;
}) {
  const { hookId, hookName, runStatus, error, logs, output } = context;
  return [
    `钩子「${hookName || hookId}」试跑未通过（状态：${runStatus || 'failed'}），请帮我修复。`,
    '',
    '错误信息：',
    error || '（无明确错误）',
    logs?.length ? `\n脚本日志：\n${logs.join('\n')}` : '',
    output != null ? `\n动作输出：\n${JSON.stringify(output)}` : '',
    '',
    '修复要求：',
    '1. 先 hook_get_hook 读取当前完整配置，定位问题（事件类型/过滤条件/表达式语法/脚本类型错误/URL 或参数）。',
    '2. 修复后：script 类型先 hook_check_script 通过，再 hook_update_hook 保存（version 会 +1）。',
    '3. 用同样的事件负载重新 hook_test_hook，直到 success 才算修复完成；未验证通过不得声称已修复。',
    '4. 若错误是"条件不匹配"，对照事件目录的 payload 结构检查 mock 负载与 eventFilter/conditionExpr 是否对应。',
  ]
    .filter(Boolean)
    .join('\n');
}
