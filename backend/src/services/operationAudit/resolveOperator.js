/**
 * 从 Koa ctx 解析操作者。
 * @param {import('koa').Context} ctx
 * @param {object} [auditOverride] auditContext 中的 operator 覆盖
 */
function resolveOperator(ctx, auditOverride = {}) {
  if (auditOverride.operator_type) {
    return {
      operator_type: auditOverride.operator_type,
      operator_id: auditOverride.operator_id ?? null,
      operator_name: auditOverride.operator_name ?? null,
      application_id: auditOverride.application_id ?? null,
    };
  }

  const user = ctx.state?.user;
  if (user?.user_id) {
    return {
      operator_type: 'USER',
      operator_id: user.user_id,
      operator_name: user.username || user.name || null,
      application_id: null,
    };
  }

  const application = ctx.state?.application;
  if (application?.application_id) {
    return {
      operator_type: 'APPLICATION',
      operator_id: null,
      operator_name: application.name || application.code || null,
      application_id: application.application_id,
    };
  }

  return {
    operator_type: 'ANONYMOUS',
    operator_id: null,
    operator_name: null,
    application_id: null,
  };
}

module.exports = { resolveOperator };
