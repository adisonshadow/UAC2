/**
 * 动作实现：执行 TypeScript 钩子脚本（vm 沙箱）。
 * 配置（action_config）：
 *  - source: 脚本源码（≤20000 字符；handler(event, ctx) 签名）
 *  - connectionId: 可选数据库连接；缺省用系统默认连接；无默认连接时仅日志类脚本可用
 *  - timeoutMs: 默认 5000，上限 30000
 * 脚本上下文：ctx.log（落 Run）/ ctx.payload（负载别名）/ ctx.db（受控 SDK）；无网络与文件。
 */
const databaseConnectionService = require('../../businessData/databaseConnectionService');
const { createHandlerSdk } = require('../../apiService/handlerSdk');
const { executeHookScript, MAX_SOURCE_CHARS } = require('../hookScriptRuntime');

const MAX_OUTPUT_CHARS = 50000;

/** 无可用连接时的 db 桩：仅在脚本真正访问 db 时才报错 */
function buildUnavailableDb(reason) {
  const throwUnavailable = () => {
    throw Object.assign(new Error(`钩子脚本 db 不可用：${reason}`), { status: 400 });
  };
  return new Proxy(function hookDbUnavailable() {}, {
    apply: throwUnavailable,
    get: (target, prop) => {
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => 'db(unavailable)';
      throwUnavailable();
      return undefined;
    },
  });
}

async function resolveDb(connectionId) {
  try {
    const conn = await databaseConnectionService.resolveConnectionRecord(connectionId || null);
    const runtime = databaseConnectionService.buildRuntimeConfig(conn);
    const { db } = createHandlerSdk({
      service: {
        targetSchema: runtime.targetSchema || 'bizdata_mat',
        entityCode: null,
        tableName: null,
        connectionId: runtime.id,
      },
      client: null,
      runtime,
    });
    return db;
  } catch (e) {
    return buildUnavailableDb(connectionId
      ? `连接 ${connectionId} 不可用（${e.message}）`
      : `未配置默认数据库连接（${e.message}）`);
  }
}

/** 输出序列化（超限截断标注，绝不抛错） */
function serializeOutput(value) {
  if (value === undefined) return null;
  try {
    const text = JSON.stringify(value ?? null);
    if (text.length <= MAX_OUTPUT_CHARS) return value ?? null;
    return { _truncated: true, preview: text.slice(0, MAX_OUTPUT_CHARS) };
  } catch {
    return { _truncated: true, reason: 'unserializable' };
  }
}

/**
 * 执行脚本动作。
 * @returns {Promise<{ ok: boolean, output: unknown, error: string|null, logs: unknown[] }>}
 */
async function executeScriptAction(actionConfig = {}, envelope, hookMeta) {
  const source = String(actionConfig.source || '');
  if (!source.trim()) {
    throw Object.assign(new Error('script 动作缺少 source'), { status: 400 });
  }
  if (source.length > MAX_SOURCE_CHARS) {
    throw Object.assign(new Error(`脚本超过 ${MAX_SOURCE_CHARS} 字符上限`), { status: 400 });
  }

  const logs = [];
  const ctx = {
    payload: envelope.payload || {},
    log: (...args) => {
      try {
        logs.push(args.map((a) => {
          if (typeof a === 'string') return a;
          return JSON.stringify(a);
        }).join(' '));
      } catch { /* 单条日志失败忽略 */ }
    },
    db: null,
    hook: hookMeta || { id: null, name: null },
  };
  ctx.db = await resolveDb(actionConfig.connectionId);

  const result = await executeHookScript(source, envelope, ctx, {
    timeoutMs: actionConfig.timeoutMs,
  });

  return {
    ok: true,
    output: serializeOutput(result),
    error: null,
    logs,
  };
}

module.exports = {
  executeScriptAction,
  serializeOutput,
  MAX_SOURCE_CHARS,
  MAX_OUTPUT_CHARS,
};
