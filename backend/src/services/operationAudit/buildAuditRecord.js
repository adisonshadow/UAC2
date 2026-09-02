const { clientIp } = require('./clientIp');
const { resolveOperator } = require('./resolveOperator');
const { resolveAuditSuccess } = require('./resolveAuditSuccess');

function pickKeys(body, summaryKeys) {
  if (!body || typeof body !== 'object' || !Array.isArray(summaryKeys) || !summaryKeys.length) {
    return [];
  }
  return summaryKeys.filter((key) => Object.prototype.hasOwnProperty.call(body, key));
}

/**
 * 从 ctx + 中间件 config 组装落库 record。
 * @param {import('koa').Context} ctx
 * @param {object} config operationAudit 配置
 * @param {number} startAt
 */
function buildAuditRecord(ctx, config, startAt) {
  const audit = ctx.state?.auditContext || {};
  const success = resolveAuditSuccess(ctx);
  const operator = resolveOperator(ctx, audit.operator);

  let resourceId = audit.resource_id;
  if (resourceId == null && typeof config.resourceId === 'function') {
    resourceId = config.resourceId(ctx);
  }
  if (resourceId == null) {
    resourceId = '';
  }
  resourceId = String(resourceId);

  const skip = typeof config.skip === 'function' ? config.skip(ctx, success) : false;
  if (skip) {
    return null;
  }

  return {
    operator_id: operator.operator_id,
    operator_name: operator.operator_name,
    operator_type: operator.operator_type,
    application_id: operator.application_id,
    domain: config.domain,
    operation_type: config.operationType,
    resource_type: config.resourceType,
    resource_id: resourceId,
    resource_name: audit.resource_name ?? null,
    user_id: audit.target_user_id ?? null,
    old_data: audit.old_data ?? null,
    new_data: audit.new_data ?? null,
    status: success ? 'SUCCESS' : 'FAILED',
    error_message: success ? null : String(ctx.body?.message || '').slice(0, 2000) || null,
    ip: clientIp(ctx),
    user_agent: String(ctx.get('user-agent') || '').slice(0, 500),
    trace_id: ctx.state?.traceId ?? null,
    duration_ms: Date.now() - startAt,
    request_summary: {
      method: ctx.method,
      path: ctx.path,
      statusCode: ctx.status,
      bodyKeys: pickKeys(ctx.request.body, config.summaryKeys),
    },
  };
}

module.exports = { buildAuditRecord, pickKeys };
