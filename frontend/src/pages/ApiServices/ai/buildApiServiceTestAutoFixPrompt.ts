export interface ApiServiceTestAutoFixContext {
  code?: string;
  name?: string;
  serviceId?: string;
  operation?: string;
  operationLabel?: string;
  parametersText?: string;
  errorMessage?: string;
}

/** 测试失败时发送给 AI Chat 的自动修复提示词 */
export function buildApiServiceTestAutoFixPrompt(ctx: ApiServiceTestAutoFixContext): string {
  const label = ctx.name || ctx.code || '当前 API 服务';
  const op = ctx.operationLabel || ctx.operation || '当前 operation';
  const errorBlock = ctx.errorMessage?.trim()
    ? `\n\n## 测试错误\n\`\`\`\n${ctx.errorMessage.trim()}\n\`\`\``
    : '';
  const paramsBlock = ctx.parametersText?.trim()
    ? `\n\n## 当前 mock 参数\n\`\`\`json\n${ctx.parametersText.trim()}\n\`\`\``
    : '';

  return `API 服务「${label}」的 ${op} 测试失败，请**自动分析并修复**（必须调用 Tool 执行，不要只给文字建议）。${errorBlock}${paramsBlock}

## 执行流程（严格按序）

### 1. 读取上下文
- \`aibase_read_surfaces\`（surfaceId=api-services.test）读取测试页状态
- \`apiservice_get_test_profile\` + \`apiservice_get_service\` 获取参数结构与 SQL/配置

### 2. 错误分类
- **mock/参数问题**（参数校验失败、SQL 命名参数未填、类型错误、测试 id 不存在等）→ 走「参数修复」
- **API 配置/SQL/脚本问题**（SQL 语法/表列不存在、未绑定物化表、operation 配置错误、脚本逻辑错误等）→ 走「配置修复」

### 3. 参数修复（mock 问题）
1. \`apiservice_run_test\` 使用修正后的 parameters 重测
2. **测试执行成功后**，必须 \`apiservice_set_test_params\` 保存 mock（operation + 与 run_test 相同的 parameters，持久化并同步表单）
3. 仍失败则重新分类；成功则简要说明改了哪些参数

### 4. 配置修复（SQL/脚本问题）
1. \`apiservice_update_service\` 修改 definitionScript 等（**自动保存**，留在当前编辑/测试页）
2. \`apiservice_navigate\` target=test autoRunTest=true（勿跳 list）
3. 解读自动重测结果；成功则告知用户；失败则继续修复直至成功或明确阻塞原因

## 约束
- 禁止向用户索要 serviceId（从 Surface / profile 获取）
- 禁止只描述方案而不调用 Tool
- 参数类问题修复成功后**必须**调用 set_test_params 保存 mock，禁止仅 run_test 成功就结束`;
}
