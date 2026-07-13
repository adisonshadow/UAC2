const vm = require('vm');
const { stripTypeScriptForVm } = require('../../utils/stripTypeScriptForVm');

const SCRIPT_TIMEOUT_MS = 5000;

function buildSandbox(ctx) {
  return {
    module: { exports: {} },
    exports: {},
    ctx,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Promise, JSON, Math, Date, Array, Object, String, Number, Boolean, Error, Buffer,
  };
}

/**
 * 执行处置脚本 transform(data, ctx)，返回请求 body 对象。
 * 复用 collectionScriptRuntime 的 VM 沙箱模式。
 */
async function executeTransformScript(scriptSource, inputData, ctx) {
  const trimmed = String(scriptSource || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('处置脚本为空'), { status: 400 });
  }

  const sandbox = buildSandbox(ctx);
  const scriptBody = `
${stripTypeScriptForVm(trimmed)}
if (typeof transform === 'function' && !module.exports.transform) {
  module.exports.transform = transform;
}
`;
  const script = new vm.Script(scriptBody, { timeout: SCRIPT_TIMEOUT_MS });
  script.runInNewContext(sandbox, { timeout: SCRIPT_TIMEOUT_MS });

  const fn = sandbox.module.exports.transform
    || (typeof sandbox.module.exports.default === 'function' ? sandbox.module.exports.default : null);
  if (!fn) {
    throw Object.assign(new Error('处置脚本须导出 function transform(data, ctx)'), { status: 400 });
  }

  const result = await Promise.race([
    Promise.resolve(fn(inputData, ctx)),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(Object.assign(new Error('处置脚本执行超时'), { status: 408 })),
        SCRIPT_TIMEOUT_MS,
      );
    }),
  ]);

  if (result === null || result === undefined || typeof result !== 'object') {
    throw Object.assign(new Error('处置脚本须返回对象'), { status: 400 });
  }
  return result;
}

function buildWebhookScriptContext({ webhook }) {
  return {
    webhook: {
      id: webhook.id,
      code: webhook.code,
      name: webhook.name,
      triggerApiServiceCode: webhook.trigger_api_service_code,
    },
  };
}

module.exports = {
  executeTransformScript,
  buildWebhookScriptContext,
};
