const { v4: uuidv4 } = require('uuid');

module.exports = async (ctx, next) => {
  const incomingTraceId = ctx.get('X-Trace-Id');
  const traceId = incomingTraceId || uuidv4();
  ctx.state.traceId = traceId;
  ctx.set('X-Trace-Id', traceId);
  await next();
};
