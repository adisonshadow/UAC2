/** AI Chat 生成异常响应模板集的提示词（由 AI 调用 Tool 执行） */
export function buildExceptionResponsePrompt() {
  return `请为系统生成一套完整的标准异常响应模板，覆盖常见 HTTP 错误码。

请按以下步骤通过 Tool 执行（不要向用户索要参数）：
1. 使用 aibase_read_surfaces（surfaceId=api-services.exception-responses）读取当前已有的异常响应列表
2. 对以下标准错误码，调用 apiservice_create_exception_response 逐条创建（如果已存在同 code 则用 apiservice_update_exception_response 更新）：
   - 400 参数错误
   - 401 未授权
   - 403 禁止访问
   - 404 资源不存在
   - 409 冲突
   - 422 参数校验失败
   - 429 请求过于频繁
   - 500 服务器错误
   - 503 服务不可用
3. 每条需包含：code、title、description、schema（JSON Schema，含 code/message 字段）、example（示例 JSON 响应体）

schema 结构统一为：{ type:'object', properties:{ code:{type:'integer'}, message:{type:'string'} }, required:['code','message'] }
example 统一为：{ code: <状态码>, message: '<对应中文说明>' }

创建完成后总结已生成/更新的异常响应列表。`;
}
