const { authRequired } = require('../../middlewares/storageAuth');
const { getTusServer, isTusProtocolPath } = require('./tusServer');

function createTusKoaMiddleware() {
  return async function tusKoaMiddleware(ctx, next) {
    if (!isTusProtocolPath(ctx.path)) {
      await next();
      return;
    }
    if (ctx.method !== 'OPTIONS') {
      let authed = false;
      await authRequired(ctx, async () => {
        authed = true;
      });
      if (!authed) return;
    }
    await (await getTusServer()).handle(ctx.req, ctx.res);
    ctx.respond = false;
  };
}

module.exports = {
  createTusKoaMiddleware,
};
