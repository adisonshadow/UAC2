/**
 * LOGIN 专用 skip：失败不记；验证码挑战（HTTP 202）尚未登录，也不记。
 * 仅当控制器补了 operator（真正签发令牌）才落库。
 */
function skipLoginAudit(ctx, success) {
  return !success || !ctx.state?.auditContext?.operator;
}

module.exports = { skipLoginAudit };
