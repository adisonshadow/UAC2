const auth = require('./auth');
const requireBuiltinApiPermission = require('./requireBuiltinApiPermission');

/**
 * 组合中间件：先执行身份认证（auth），再执行内置 API 访问强制（requireBuiltinApiPermission）。
 *
 * 背景：项目内 auth 是「逐路由」挂载（如 router.get('/', auth, handler)），而非全局。
 * 内置 API 鉴权必须在 auth 之后运行（依赖 ctx.state.user / ctx.state.application），
 * 故将其与 auth 组合，供内置 API 路由组（users/roles/departments/permissions）逐路由使用：
 *   router.get('/', authWithBuiltinApiGuard, handler)
 */
async function authWithBuiltinApiGuard(ctx, next) {
  await auth(ctx, async () => {
    await requireBuiltinApiPermission(ctx, next);
  });
}

module.exports = authWithBuiltinApiGuard;
