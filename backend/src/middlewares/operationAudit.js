const { buildAuditRecord } = require('../services/operationAudit/buildAuditRecord');
const { writeOperationLog } = require('../services/operationAudit/writeOperationLog');

/**
 * 声明式操作审计中间件。须在 auth / authWithBuiltinApiGuard 之后挂载。
 *
 * M4b 挂载对照（写操作；preview/test/validate/upload 等跳过）：
 * - bizdata: businessDataRoutes（实体/字段/枚举/关系/连接/物化执行/mock/指标卡片 CRUD/标准/元数据/scope-doc）
 * - apiservice: apiServiceAdminRoutes / outboundWebhookRoutes / exceptionResponseRoutes
 * - ai: adminProvider|AiModel|Scope|Tool|SkillRoutes（provider 勿记密钥明文）
 * - storage: storageRoutes buckets CRUD（不挂 upload/tus/dedup）
 * - collection: collectionPipelineAdminRoutes（不挂 test）
 * - automation: automationHookRoutes（含 test/retry EXECUTE；不挂 validate-script）
 * - system: systemRoutes features/backups + builtinApiRoutes access-restriction
 * - server_builtin 补记: toolInvokeService bizdata_execute_materialization / bizdata_insert_mock_data
 *
 * @param {object} config
 * @param {string} config.domain
 * @param {string} config.operationType
 * @param {string} config.resourceType
 * @param {(ctx: import('koa').Context) => string|undefined} [config.resourceId]
 * @param {string[]} [config.summaryKeys]
 * @param {(ctx: import('koa').Context, success: boolean) => boolean} [config.skip]
 */
function operationAudit(config) {
  return async (ctx, next) => {
    const startAt = Date.now();
    try {
      await next();
    } finally {
      const record = buildAuditRecord(ctx, config, startAt);
      if (record) {
        writeOperationLog(record);
      }
    }
  };
}

module.exports = { operationAudit };
