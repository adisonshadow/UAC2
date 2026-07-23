/** AI Chat 生成 API 测试请求参数 Example 的提示词（由 AI 调用 Tool 执行） */
export function buildApiServiceTestParamsPrompt(input: {
  code?: string;
  name?: string;
  operation?: string;
  operationLabel?: string;
}) {
  const label = input.name || input.code || '当前 API 服务';
  const op = input.operationLabel || input.operation || '当前 operation';
  return `请为 API 服务「${label}」的 ${op} 操作生成「请求参数 Example」并完成测试。

请求参数 Example 与编辑页右侧 / 测试页表单为**同一数据**（security_config.requestOverrides[operation].requestExample）。

请按以下步骤通过 Tool 执行（不要向用户索要 serviceId）：
1. \`aibase_read_surfaces\`（surfaceId=api-services.test）读取当前测试页上下文与 parametersText
2. \`apiservice_get_test_profile\` 获取参数结构与已保存 Example
3. \`apiservice_suggest_test_params\` 生成带**具体示例值**的 Example，持久化并同步到测试页表单（mutation）
4. \`apiservice_run_test\` 使用相同 parameters 执行测试并解读 preview / rolledBack
5. 测试成功后调用 \`apiservice_set_test_params\` 再次保存（与 run_test 相同 operation + parameters），确保表单与持久化一致

禁止未调用 suggest/set/run_test 就声称已更新测试页参数。写操作测试是否回滚由系统设置决定。`;
}
