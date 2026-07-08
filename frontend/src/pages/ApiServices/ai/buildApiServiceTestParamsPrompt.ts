/** AI Chat 生成 API 测试 mock 参数的提示词（由 AI 调用 Tool 执行） */
export function buildApiServiceTestParamsPrompt(input: {
  code?: string;
  name?: string;
  operation?: string;
  operationLabel?: string;
}) {
  const label = input.name || input.code || '当前 API 服务';
  const op = input.operationLabel || input.operation || '当前 operation';
  return `请为 API 服务「${label}」的 ${op} 操作生成 mock 测试参数并完成测试。

请按以下步骤通过 Tool 执行（不要向用户索要 serviceId）：
1. 使用 aibase_read_surfaces（surfaceId=api-services.test）读取当前测试页上下文
2. 调用 apiservice_get_test_profile 获取参数结构与已保存/默认 mock
3. 调用 apiservice_suggest_test_params 生成 mock 并同步到测试页表单
4. 调用 apiservice_run_test 执行测试并解读 preview / rolledBack
5. **测试成功后**必须调用 apiservice_set_test_params 保存已通过测试的 mock 参数（传与 run_test 相同的 operation + parameters）

写操作测试是否回滚由系统设置决定；成功后 mock 会持久化，下次打开测试页自动加载。`;
}
