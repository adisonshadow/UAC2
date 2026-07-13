const {
  matchApiPermission,
  assertBuiltinApiAccess,
} = require('../services/builtinApi/builtinApiPermissionService');

/**
 * 内置 API 访问强制中间件
 *
 * 放在 auth 之后、具体路由处理之前。对每个请求：
 * 1. 按 method + path 匹配内置 API 清单；未命中（非内置 API 路由）→ 直接放行，不影响既有逻辑。
 * 2. 命中则按调用主体鉴权：
 *    - 应用令牌（ctx.state.application）→ 校验 builtin_api_scope.permissionCodes，命中放行（跳过角色/组织）。
 *    - 用户令牌（ctx.state.user）→ 按 accessRestriction（role/department）鉴权；未配置→放行。
 *
 * 仅应挂载到内置 API 路由组（users/roles/departments/permissions），避开公开端点。
 */
module.exports = async (ctx, next) => {
  const matched = await matchApiPermission(ctx.method, ctx.path);
  if (!matched) {
    // 非内置 API 清单路由：放行，由既有逻辑（auth 等）决定
    return await next();
  }
  assertBuiltinApiAccess(ctx, matched);
  await next();
};
