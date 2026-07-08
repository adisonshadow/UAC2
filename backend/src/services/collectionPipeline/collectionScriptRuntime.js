const vm = require('vm');
const { stripTypeScriptForVm } = require('../../utils/stripTypeScriptForVm');

const SCRIPT_TIMEOUT_MS = 5000;

function buildSandbox(ctx) {
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
    Buffer,
  };
}

function extractNamedExport(moduleExports, exportName) {
  if (typeof moduleExports?.[exportName] === 'function') return moduleExports[exportName];
  if (typeof moduleExports?.default === 'function' && exportName !== 'store') {
    return moduleExports.default;
  }
  return null;
}

function runScriptInVm(scriptSource, exportName, ctx) {
  const trimmed = String(scriptSource || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error(`${exportName} 脚本为空`), { status: 400 });
  }

  const sandbox = buildSandbox(ctx);
  const scriptBody = `
${stripTypeScriptForVm(trimmed)}
if (typeof ${exportName} === 'function' && !module.exports.${exportName}) {
  module.exports.${exportName} = ${exportName};
}
`;
  const script = new vm.Script(scriptBody, { timeout: SCRIPT_TIMEOUT_MS });
  script.runInNewContext(sandbox, { timeout: SCRIPT_TIMEOUT_MS });

  const fn = extractNamedExport(sandbox.module.exports, exportName);
  if (!fn) {
    throw Object.assign(
      new Error(`${exportName} 脚本须导出 function ${exportName}(...)`),
      { status: 400 },
    );
  }
  return fn;
}

async function executeParseScript(parseScript, raw, ctx) {
  const parseFn = runScriptInVm(parseScript, 'parse', ctx);
  const result = await Promise.race([
    Promise.resolve(parseFn(raw, ctx)),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(Object.assign(new Error('解析脚本执行超时'), { status: 408 })),
        SCRIPT_TIMEOUT_MS,
      );
    }),
  ]);
  if (result === null || result === undefined || typeof result !== 'object') {
    throw Object.assign(new Error('解析脚本须返回对象'), { status: 400 });
  }
  return result;
}

function detectStoreArgOrder(storeScript) {
  const src = String(storeScript || '');
  if (/function\s+store\s*\(\s*ctx\b/i.test(src)) {
    return 'ctxFirst';
  }
  return 'dataFirst';
}

function buildBizdataDeprecationError() {
  return Object.assign(
    new Error(
      'store 脚本禁止使用 ctx.bizdata；须使用 store(data, ctx) 签名，并通过 ctx.queryPg、ctx.tableQualified 写入物化表',
    ),
    { status: 400 },
  );
}

function wrapScriptContext(ctx) {
  const wrapped = { ...ctx };
  wrapped.bizdata = {
    find() {
      throw buildBizdataDeprecationError();
    },
    create() {
      throw buildBizdataDeprecationError();
    },
  };
  return wrapped;
}

async function executeStoreScript(storeScript, data, ctx) {
  const storeFn = runScriptInVm(storeScript, 'store', ctx);
  const scriptCtx = wrapScriptContext(ctx);
  const args = detectStoreArgOrder(storeScript) === 'ctxFirst'
    ? [scriptCtx, data]
    : [data, scriptCtx];
  const result = await Promise.race([
    Promise.resolve(storeFn(...args)),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(Object.assign(new Error('存储脚本执行超时'), { status: 408 })),
        SCRIPT_TIMEOUT_MS,
      );
    }),
  ]);
  return result;
}

function normalizeRawBody(buffer, contentType) {
  if (!buffer || buffer.length === 0) return '';
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('application/octet-stream') || ct.includes('application/binary')) {
    return buffer.toString('hex');
  }
  return buffer.toString('utf8');
}

function buildScriptContext({ pipeline, entity, queryPg, tableQualified }) {
  return {
    protocolType: pipeline.protocolType,
    pipeline: {
      id: pipeline.id,
      code: pipeline.code,
      name: pipeline.name,
      protocolType: pipeline.protocolType,
      entityCode: pipeline.entityCode,
      tableName: pipeline.tableName,
      targetSchema: pipeline.targetSchema,
    },
    entity: entity || null,
    tableQualified,
    queryPg,
  };
}

module.exports = {
  executeParseScript,
  executeStoreScript,
  normalizeRawBody,
  buildScriptContext,
};
