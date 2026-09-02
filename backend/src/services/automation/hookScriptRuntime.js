/**
 * 钩子脚本运行时：vm 沙箱执行 `handler(event, ctx)`。
 * 与 apiServiceHandlerRuntime 同一模式（vm.Script 超时 + Promise 竞速），
 * 但注入的是事件信封 event 与钩子上下文 ctx（log / payload 别名 / 受控 db SDK）。
 */
const vm = require('vm');
const { stripTypeScriptForVm } = require('../../utils/stripTypeScriptForVm');

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 30000;
const MAX_SOURCE_CHARS = 20000;

function isExplicitHookScript(source) {
  const text = String(source || '');
  if (/\bexport\s+(?:default\s+)?(?:async\s+)?function\s+handler\b/.test(text)) return true;
  if (/\bexport\s+default\s+(?:async\s+)?(?:function|\()/.test(text)) return true;
  if (/\b(?:async\s+)?function\s+handler\s*\(/.test(text)) return true;
  if (/\bmodule\.exports\b/.test(text)) return true;
  if (/\bexports\.handler\b/.test(text)) return true;
  return false;
}

/**
 * 编译为可执行 JS：显式 handler / module.exports 保持兼容；否则视为「只写函数体」。
 */
function compileHookSource(source) {
  const trimmed = String(source || '').trim();
  const stripped = stripTypeScriptForVm(trimmed);

  if (isExplicitHookScript(trimmed)) {
    return `
${stripped}
if (typeof handler === 'function' && !module.exports.handler) {
  module.exports.handler = handler;
}
`;
  }

  return `
module.exports.handler = async function __eadaf_hook_handler(event, ctx) {
${stripped}
};
`;
}

function extractHandler(moduleExports) {
  if (typeof moduleExports?.handler === 'function') return moduleExports.handler;
  if (typeof moduleExports?.default === 'function') return moduleExports.default;
  if (typeof moduleExports === 'function') return moduleExports;
  return null;
}

function buildHookSandbox(event, ctx) {
  const log = (...args) => {
    try {
      ctx?.log?.(...args);
    } catch { /* 日志失败不影响脚本 */ }
  };
  return {
    module: { exports: {} },
    exports: {},
    event,
    ctx,
    db: ctx?.db,
    console: { log, warn: log, error: log },
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

/**
 * 执行钩子脚本。
 * @param {string} source 脚本源码（≤ MAX_SOURCE_CHARS）
 * @param {object} event 事件信封 {id,type,occurredAt,depth,payload}
 * @param {object} ctx 钩子上下文 { log, payload, db, hook }
 * @param {{ timeoutMs?: number }} [options]
 */
async function executeHookScript(source, event, ctx, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const trimmed = String(source || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('钩子脚本为空'), { status: 400 });
  }
  if (trimmed.length > MAX_SOURCE_CHARS) {
    throw Object.assign(new Error(`钩子脚本超过 ${MAX_SOURCE_CHARS} 字符上限`), { status: 400 });
  }

  const timeout = Math.min(
    Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 1000),
    MAX_TIMEOUT_MS,
  );

  const sandbox = buildHookSandbox(event, ctx);
  const scriptBody = compileHookSource(trimmed);
  const script = new vm.Script(scriptBody, { timeout });
  script.runInNewContext(sandbox, { timeout });

  const handler = extractHandler(sandbox.module.exports);
  if (!handler) {
    throw Object.assign(
      new Error('钩子脚本须导出 handler，或直接编写函数体（推荐：使用 event.payload / ctx.log / db）'),
      { status: 400 },
    );
  }

  const result = await Promise.race([
    Promise.resolve(handler(event, ctx)),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(Object.assign(new Error(`钩子脚本执行超时（${timeout}ms）`), { status: 408 })),
        timeout,
      );
    }),
  ]);
  return result;
}

module.exports = {
  executeHookScript,
  compileHookSource,
  isExplicitHookScript,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MAX_SOURCE_CHARS,
};
