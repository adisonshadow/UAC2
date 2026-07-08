const vm = require('vm');
const { stripTypeScriptForVm } = require('../../utils/stripTypeScriptForVm');

const HANDLER_TIMEOUT_MS = 5000;

function buildHandlerSandbox(ctx) {
  return {
    module: { exports: {} },
    exports: {},
    ctx,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    Promise,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
  };
}

function extractHandler(moduleExports) {
  if (typeof moduleExports?.handler === 'function') return moduleExports.handler;
  if (typeof moduleExports?.default === 'function') return moduleExports.default;
  if (typeof moduleExports === 'function') return moduleExports;
  return null;
}

async function executeHandlerScript(handlerScript, ctx) {
  const trimmed = String(handlerScript || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('Handler 脚本为空'), { status: 400 });
  }

  const sandbox = buildHandlerSandbox(ctx);
  const scriptBody = `
${stripTypeScriptForVm(trimmed)}
if (typeof handler === 'function' && !module.exports.handler) {
  module.exports.handler = handler;
}
`;
  const script = new vm.Script(scriptBody, { timeout: HANDLER_TIMEOUT_MS });
  script.runInNewContext(sandbox, { timeout: HANDLER_TIMEOUT_MS });

  const handler = extractHandler(sandbox.module.exports);
  if (!handler) {
    throw Object.assign(
      new Error('Handler 脚本须导出 async function handler(ctx) 或 module.exports = { handler }'),
      { status: 400 },
    );
  }

  const result = await Promise.race([
    Promise.resolve(handler(ctx)),
    new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('Handler 执行超时'), { status: 408 })), HANDLER_TIMEOUT_MS);
    }),
  ]);
  return result;
}

function buildHandlerContext({
  service,
  operation,
  parameters,
  queryPg,
  user,
  bypassAccessControl,
}) {
  return {
    service: {
      id: service.id,
      code: service.code,
      name: service.name,
      scopeCode: service.scopeCode,
      operation,
    },
    operation,
    params: parameters || {},
    parameters: parameters || {},
    user: user || { bypassAccessControl: !!bypassAccessControl },
    queryPg,
  };
}

module.exports = {
  executeHandlerScript,
  buildHandlerContext,
};
