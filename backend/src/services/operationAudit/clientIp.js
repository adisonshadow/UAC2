/**
 * 客户端 IP：X-Forwarded-For 第一段，否则 ctx.ip。
 * @param {import('koa').Context} ctx
 */
function clientIp(ctx) {
  const forwarded = ctx.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first.slice(0, 45);
  }
  return String(ctx.ip || '').slice(0, 45);
}

module.exports = { clientIp };
