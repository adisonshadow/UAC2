const vm = require('vm');
const { stripTypeScriptForVm } = require('../../utils/stripTypeScriptForVm');
const { isExplicitHandlerScript } = require('./handlerTypeCheck');

const HANDLER_TIMEOUT_MS = 5000;

function buildHandlerSandbox(ctx, { params, db } = {}) {
  return {
    module: { exports: {} },
    exports: {},
    ctx,
    params: params ?? ctx?.params ?? {},
    db,
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

/**
 * 将用户脚本编译为可执行 JS：
 * - 显式 handler / module.exports：保持兼容
 * - 否则视为「只写函数体」，包成 module.exports.handler
 */
function compileHandlerSource(handlerScript) {
  const trimmed = String(handlerScript || '').trim();
  const stripped = stripTypeScriptForVm(trimmed);

  if (isExplicitHandlerScript(trimmed)) {
    return `
${stripped}
if (typeof handler === 'function' && !module.exports.handler) {
  module.exports.handler = handler;
}
`;
  }

  return `
module.exports.handler = async function __eadaf_handler(ctx) {
${stripped}
};
`;
}

async function executeHandlerScript(handlerScript, ctx, { params, db } = {}) {
  const trimmed = String(handlerScript || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('Handler 脚本为空'), { status: 400 });
  }

  const sandbox = buildHandlerSandbox(ctx, {
    params: params ?? ctx?.params,
    db,
  });
  const scriptBody = compileHandlerSource(trimmed);
  const script = new vm.Script(scriptBody, { timeout: HANDLER_TIMEOUT_MS });
  script.runInNewContext(sandbox, { timeout: HANDLER_TIMEOUT_MS });

  const handler = extractHandler(sandbox.module.exports);
  if (!handler) {
    throw Object.assign(
      new Error('Handler 须导出 handler，或直接编写函数体（推荐：使用 params / db）'),
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
  db,
  user,
  bypassAccessControl,
}) {
  const frozenParams = Object.freeze({ ...(parameters || {}) });
  return {
    service: {
      id: service.id,
      code: service.code,
      name: service.name,
      scopeCode: service.scopeCode,
      entityCode: service.entityCode,
      targetSchema: service.targetSchema,
      tableName: service.tableName,
      operation,
    },
    operation,
    params: frozenParams,
    parameters: frozenParams,
    user: user || { bypassAccessControl: !!bypassAccessControl },
    // 内部弃用兜底：旧 Handler 仍可运行；类型检查会禁止新保存
    queryPg,
    db,
  };
}

module.exports = {
  executeHandlerScript,
  buildHandlerContext,
  compileHandlerSource,
  isExplicitHandlerScript,
};
