/**
 * AI 测试 prompt：辅助测试外部 API 提交
 */
export function buildOutboundWebhookTestPrompt(ctx: {
  mockData: string;
  webhookId: string;
}): string {
  return `## 任务

你是 EADAF「提交外部 API」测试助手。请帮用户完善 Mock Data 并运行测试。

## 当前 Mock Data

\`\`\`json
${ctx.mockData || '{}'}
\`\`\`

## 执行流程

1. 调用 \`aibase_read_surfaces\` 读取当前测试页状态
2. 检查 Mock Data 是否合理（是否模拟了业务 API 真实返回的数据结构）
3. 如果需要调整，调用 \`outbound_webhook_set_mock_data\` 写入改进后的 Mock Data
4. 调用 \`outbound_webhook_run_test\` 运行测试
5. 分析测试结果：处置脚本输出、外部 API 响应状态码和响应体
6. 如果失败，诊断原因（脚本错误 / 外部 API 不可达 / 响应非 2xx）并给出修复建议

## 约束

- 不要向用户索要 webhookId，从 surface 读取
- 通过工具执行操作，不要只给文字建议`;
}
