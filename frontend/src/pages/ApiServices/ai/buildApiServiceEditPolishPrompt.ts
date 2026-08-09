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
1. \`aibase_read_surfaces\`（surfaceId=api-services.edit）读取当前表单
2. \`apiservice_get_service\`（serviceId=${ctx.serviceId || '从 Surface 获取'}）核对已保存配置（**仅测前**）
3. 若有 entityCode → \`bizdata_get_entity\` 获取表结构与字段
4. 改进 ${mode} 脚本、请求参数 interface、请求 Example、Responses Schema/Example 等
5. \`apiservice_update_service\` **自动保存**
6. typescript：\`apiservice_check_handler\` 通过后再测
7. \`apiservice_run_test\`；**一旦 success=true（及 verified=true）立即向用户汇报并结束，禁止再 get_service「查看完整 handler」**

## 表单结构（v3）
- **信息 / 请求 / 处理 / 响应** 四区块；处理区为 SQL 或 TypeScript Handler

## SQL / Handler 规范
- **禁止**占位 SQL：\`SELECT 1\` 等
- **create** + SQL：物化表结构参考 \`WHERE 1=0\`
- **find** + SQL：只写 SELECT/WHERE/ORDER BY；**禁止** SQL 内 \`LIMIT\`/\`OFFSET\`（分页由网关按 \`limit\`/\`skip\` 施加）

## TypeScript Handler 契约（scriptMode=typescript 时必遵）
- \`requestParameterInterface\` 为唯一真相源；\`params.xxx\` 须先声明
- 编辑器有锁定壳；存库为函数体。用只读 \`params\` + \`db(实体code)\`
- **params 安全**：网关已校验只读；经 \`db().where/paginate\` 参数化防注入；禁止拼字符串 / queryPg
- **禁止双重过滤**：分页+计数用 \`.paginate({ limit: params.limit, skip: params.skip })\`（或 \`getManyAndCount\`），勿 where 写两遍再分别 getMany/getCount
- 别名：\`count()\`=\`getCount()\`，\`find()\`=\`getMany()\`，\`findOne()\`=\`getOne()\`
- JOIN：\`db('A','o').leftJoin('B','b','o.id','b.a_id')\`（仅等值 ON）
- where 操作符：\`$gte/$lte/$in/$ilike/$isNull\` 等
- 示例：
  \`\`\`ts
  return await db('fmms:production:WorkCard')
    .where({ status: params.status })
    .orderBy('created_at', 'DESC')
    .paginate({ limit: params.limit, skip: params.skip });
  // → { items, pagination: { total, page, pageSize, totalPages, hasNext } }
  \`\`\`
- 修改 Handler 后：\`apiservice_check_handler\` → \`apiservice_update_service\` →（可选测前 \`get_service\`）→ \`apiservice_run_test\` → **STOP**

## Response Example（分页必遵）
- **禁止** \`"item": null\`；create/findOne 须具体 item
- **find 必须** \`data.items\` + \`data.pagination\`：
  \`\`\`json
  {
    "items": [{ "...": "..." }],
    "pagination": {
      "total": 53,
      "page": 1,
      "pageSize": 10,
      "totalPages": 6,
      "hasNext": true
    }
  }
  \`\`\`
- Schema / Example / Handler 返回值三者一致；禁止仅 \`items+total\` 或 \`items+count\` 平铺

## 完善后校验 Todo（顺序固定，测过后禁止加戏）
- [ ] typescript：\`apiservice_check_handler\` ok=true
- [ ] \`apiservice_update_service\` 保存（含完整 responseOverrides）
- [ ] （可选）测前 \`apiservice_get_service\` 确认非占位 —— **不得在测试成功后再做**
- [ ] interface / Example / Response Example 完整（find 含 pagination）
- [ ] \`apiservice_run_test\` success=true
- [ ] **STOP**：向用户汇报测试结果；**禁止**再 get_service / read_surfaces / check_handler「确认完整 handler」
- [ ] **禁止**测试成功后再改 handler 除非用户明确要求继续改

## 约束
- 禁止索要 connectionId / serviceId
- **禁止**仅 update 成功就声称测试通过
- **禁止**测试已通过后进入「再看一眼代码」循环`;

}
