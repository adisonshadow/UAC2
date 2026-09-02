/**
 * 成败判定：信封 code 优先，否则 HTTP status。
 * @param {import('koa').Context} ctx
 */
function resolveAuditSuccess(ctx) {
  const envelopeCode = Number(ctx.body?.code);
  if (Number.isFinite(envelopeCode)) {
    return envelopeCode < 400;
  }
  return ctx.status < 400;
}

module.exports = { resolveAuditSuccess };
