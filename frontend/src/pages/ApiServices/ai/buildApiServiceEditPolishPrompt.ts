export interface ApiServiceEditPolishContext {
  code?: string;
  name?: string;
  serviceId?: string;
  primaryOperation?: string;
  scriptMode?: string;
  entityCode?: string;
}

/** 编辑页「AI 完善」发送给 Chat 的提示词 */
export function buildApiServiceEditPolishPrompt(ctx: ApiServiceEditPolishContext): string {
  const label = ctx.name || ctx.code || '当前 API 服务';
  const op = ctx.primaryOperation || '主 operation';
  const mode = ctx.scriptMode === 'typescript' ? 'TypeScript Handler' : 'SQL';
  const entityHint = ctx.entityCode ? `\n- 绑定实体：\`${ctx.entityCode}\`（须 \`bizdata_get_entity\` 了解字段）` : '';

  return `请完善 API 服务「${label}」（code: ${ctx.code || '未知'}，主 operation: ${op}）的配置，使其可测试、可发布。${entityHint}

## 执行流程（必须调用 Tool，不要只给文字建议）
1. \`aibase_read_surfaces\`（surfaceId=api-services.edit）读取当前表单与脚本
2. \`apiservice_get_service\`（serviceId=${ctx.serviceId || '从 Surface 获取'}）核对已保存配置
3. 若有 entityCode → \`bizdata_get_entity\` 获取表结构
4. 改进 ${mode} 脚本、请求参数 interface、访问协议等
5. \`apiservice_update_service\` **自动保存**（禁止让用户手动点保存）

## SQL / Handler 规范（重要）
- **禁止**占位脚本：\`SELECT 1\`、\`SELECT 1 AS result\`、与业务无关的常量查询
- **create** 类 + SQL：definitionScript 应为物化表结构参考，例如：
  \`\`\`sql
  SELECT *
  FROM "bizdata_mat"."表名"
  WHERE 1 = 0
  \`\`\`
  （运行时 Gateway 根据 body 执行 INSERT，不是靠 SELECT 写入）
- **find** 类：完整 \`FROM\` 物化表查询，含 \`:limit\`、\`:skip\` 等命名参数

## 完善后校验 Todo（逐项完成，禁止跳过）
- [ ] \`apiservice_get_service\` 回读 definitionScript/handlerScript，确认**非占位 SQL**
- [ ] \`apiservice_get_test_profile\`：operation=${op} 的 executable=true
- [ ] \`apiservice_suggest_test_params\` 或 \`apiservice_set_test_params\`（create 须有合理 body）
- [ ] \`apiservice_run_test\`：success=true；create 的 preview 含 item 或有效写入结果
- [ ] 若执行了测试且成功：\`apiservice_set_test_params\` 保存 mock 参数
- [ ] **仅当以上全部通过**才可向用户声称「完善成功」或「测试通过」

## 约束
- 禁止向用户索要 connectionId / serviceId
- **禁止**仅 update 成功就声称测试通过
- 已发布服务修改后会回到未发布，可提示用户重新发布`;
}
