/**
 * 钩子执行引擎：动作执行、重试退避、超时、单钩子并发闸、Run 落库、连续失败自动停用。
 * 由 eventDispatcher 队列调用（executeHookForEvent），或 hookService 测试/重放入口直接调用。
 */
const { randomUUID } = require('crypto');
const logger = require('../../utils/logger');
const { AutomationHook, AutomationHookRun } = require('../../models');
const { runWithEventDepth } = require('./eventContext');
const { executeHttpRequestAction } = require('./actions/httpRequestAction');
const { executeInternalApiAction } = require('./actions/internalApiAction');
const { executeScriptAction } = require('./actions/scriptAction');

const DEFAULT_POLICY = {
  retry: 2,               // 失败自动重试次数（指数退避 1s/4s/16s…）
  disableThreshold: 10,   // 连续失败达阈值 → auto_disabled
  concurrency: 3,         // 单钩子并发上限（超出排队）
};

const BACKOFF_MS = [1000, 4000, 16000, 64000];

const ACTION_TIMEOUT_DEFAULTS = {
  http_request: 30000,
  script: 5000,
  internal_api: 60000,
};
const ACTION_TIMEOUT_MAX = {
  http_request: 60000,
  script: 30000,
  internal_api: 300000,
};

// 单钩子并发闸
const hookSlots = new Map(); // hookId -> { active: number, waiters: [] }

async function acquireHookSlot(hookId, maxConcurrency) {
  let slot = hookSlots.get(hookId);
  if (!slot) {
    slot = { active: 0, waiters: [] };
    hookSlots.set(hookId, slot);
  }
  if (slot.active < maxConcurrency) {
    slot.active += 1;
    return;
  }
  await new Promise((resolve) => slot.waiters.push(resolve));
  slot.active += 1;
}

function releaseHookSlot(hookId) {
  const slot = hookSlots.get(hookId);
  if (!slot) return;
  slot.active = Math.max(0, slot.active - 1);
  const next = slot.waiters.shift();
  if (next) next();
}

// 去重护栏（进程内）：同 event_id + hook_id 并发投递只执行一次；DB 唯一索引兜底
const inFlight = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePolicy(hook) {
  const raw = hook.failurePolicy && typeof hook.failurePolicy === 'object'
    ? hook.failurePolicy
    : {};
  const retry = Math.min(Math.max(Number(raw.retry ?? DEFAULT_POLICY.retry) || 0, 0), 5);
  const disableThreshold = Math.min(
    Math.max(Number(raw.disableThreshold ?? DEFAULT_POLICY.disableThreshold) || DEFAULT_POLICY.disableThreshold, 1),
    1000,
  );
  const concurrency = Math.min(Math.max(Number(raw.concurrency ?? DEFAULT_POLICY.concurrency) || 1, 1), 10);
  const timeoutMs = Math.min(
    Math.max(Number(raw.timeoutMs) || ACTION_TIMEOUT_DEFAULTS[hook.actionType] || 30000, 1000),
    ACTION_TIMEOUT_MAX[hook.actionType] || 300000,
  );
  return { retry, disableThreshold, concurrency, timeoutMs };
}

/** 动作配置快照（脱敏：加密字段永不落 Run） */
function buildActionSnapshot(actionConfig) {
  const clone = JSON.parse(JSON.stringify(actionConfig || {}));
  const mask = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach((key) => {
      if (/(_enc|secret)$/i.test(key)) {
        obj[key] = obj[key] ? '[已加密，不记录]' : null;
      } else if (typeof obj[key] === 'object') {
        mask(obj[key]);
      }
    });
  };
  mask(clone);
  return clone;
}

function truncateJson(value, maxChars = 50000) {
  if (value == null) return value;
  try {
    const text = JSON.stringify(value);
    if (text.length <= maxChars) return value;
    return { _truncated: true, preview: text.slice(0, maxChars) };
  } catch {
    return { _truncated: true, reason: 'unserializable' };
  }
}

async function runAction(hook, envelope, ctxLogs) {
  const config = hook.actionConfig || {};
  if (hook.actionType === 'http_request') {
    return executeHttpRequestAction(config, envelope);
  }
  if (hook.actionType === 'internal_api') {
    return executeInternalApiAction(config, envelope);
  }
  if (hook.actionType === 'script') {
    const result = await executeScriptAction(config, envelope, { id: hook.id, name: hook.name });
    if (Array.isArray(result.logs)) ctxLogs.push(...result.logs);
    return result;
  }
  throw Object.assign(new Error(`未知动作类型: ${hook.actionType}`), { status: 400 });
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(
        new Error(`${label}执行超时（${ms}ms）`),
        { status: 408 },
      )), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function createRun(row) {
  try {
    return await AutomationHookRun.create(row);
  } catch (e) {
    const name = e?.name || '';
    if (name === 'SequelizeUniqueConstraintError') {
      // (event_id, hook_id, attempt) 唯一冲突 = 去重成功（重复投递），静默跳过
      return { deduped: true };
    }
    throw e;
  }
}

/**
 * 更新连续失败计数；达阈值自动停用。
 * 仅正式触发（event|schedule）计入；test/replay 不影响。
 */
async function applyFailureAccounting(hookId, succeeded, disableThreshold) {
  try {
    if (succeeded) {
      await AutomationHook.update(
        { consecutive_failures: 0 },
        { where: { id: hookId } },
      );
      return;
    }
    const rows = await AutomationHook.update(
      { consecutive_failures: AutomationHook.sequelize.literal('consecutive_failures + 1') },
      { where: { id: hookId }, returning: true },
    );
    const updated = rows?.[1]?.[0];
    const failures = Number(updated?.consecutive_failures ?? 0);
    if (failures >= disableThreshold) {
      const [affected] = await AutomationHook.update(
        { status: 'auto_disabled' },
        { where: { id: hookId, status: 'enabled' } },
      );
      if (affected) {
        logger.error('钩子连续失败已达阈值，已自动停用', { hookId, failures, disableThreshold });
        const hookRegistryCache = require('./hookRegistryCache');
        hookRegistryCache.invalidate();
      }
    }
  } catch (e) {
    logger.warn('钩子失败计数更新失败', { hookId, error: e.message });
  }
}

/**
 * 执行一个钩子（含重试）。
 * @param {{ id, name, eventType, actionType, actionConfig, failurePolicy, version }} hook 钩子视图
 * @param {{ id, type, occurredAt, depth, payload }} envelope 事件信封
 * @param {{ triggerSource?: 'event'|'test'|'replay'|'schedule', suppressed?: 'depth'|'queue_full'|null,
 *           forceSingleAttempt?: boolean }} [opts]
 */
async function executeHookForEvent(hook, envelope, opts = {}) {
  const triggerSource = opts.triggerSource || 'event';
  const policy = resolvePolicy(hook);
  const runGroupId = randomUUID();
  const snapshot = buildActionSnapshot(hook.actionConfig);

  // suppressed：不执行动作，只记 Run（depth 拦截 / 队列满）
  if (opts.suppressed) {
    const reason = opts.suppressed === 'depth'
      ? `疑似循环触发已拦截（事件深度 ${envelope.depth} ≥ 3）`
      : '执行队列已满，本次投递被抑制';
    await createRun({
      run_group_id: runGroupId,
      hook_id: hook.id,
      hook_version: hook.version ?? 1,
      event_id: envelope.id,
      event_type: envelope.type,
      event_depth: envelope.depth,
      trigger_source: triggerSource,
      payload: envelope,
      action_config_snapshot: snapshot,
      status: 'suppressed',
      attempt: 1,
      duration_ms: 0,
      error: reason,
      started_at: new Date(),
      finished_at: new Date(),
    }).catch((e) => logger.warn('suppressed Run 落库失败', { error: e.message }));
    return { status: 'suppressed', error: reason };
  }

  const dedupKey = `${envelope.id}:${hook.id}`;
  if (inFlight.has(dedupKey)) {
    return { status: 'deduped' };
  }
  inFlight.add(dedupKey);

  const isInteractive = triggerSource === 'test' || triggerSource === 'replay';
  const maxAttempts = (isInteractive || opts.forceSingleAttempt) ? 1 : policy.retry + 1;

  let finalStatus = 'failed';
  let lastError = null;

  try {
    await acquireHookSlot(hook.id, policy.concurrency);
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const startedAt = new Date();
        const logs = [];
        let status = 'success';
        let error = null;
        let output = null;

        try {
          // 动作在事件深度上下文中执行（internal_api 的后续事件 depth+1）；script 的日志经 ctxLogs 收集
          const actionResult = await runWithEventDepth(envelope.depth, () => withTimeout(
            runAction(hook, envelope, logs),
            policy.timeoutMs,
            `钩子「${hook.name}」动作`,
          ));
          if (actionResult && actionResult.ok === false) {
            status = 'failed';
            error = actionResult.error || '动作执行失败';
          }
          output = truncateJson(actionResult?.output ?? null);
        } catch (e) {
          status = e?.status === 408 ? 'timeout' : 'failed';
          error = String(e?.message || e);
        }

        const run = await createRun({
          run_group_id: runGroupId,
          hook_id: hook.id,
          hook_version: hook.version ?? 1,
          event_id: envelope.id,
          event_type: envelope.type,
          event_depth: envelope.depth,
          trigger_source: triggerSource,
          payload: envelope,
          action_config_snapshot: snapshot,
          status,
          attempt,
          duration_ms: Date.now() - startedAt.getTime(),
          error,
          output,
          logs: logs.length ? logs : null,
          started_at: startedAt,
          finished_at: new Date(),
        });

        finalStatus = status;
        lastError = error;

        if (run?.deduped) {
          return { status: 'deduped' };
        }
        if (status === 'success') break;

        if (attempt < maxAttempts) {
          await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
        }
      }
    } finally {
      releaseHookSlot(hook.id);
    }
  } finally {
    inFlight.delete(dedupKey);
  }

  if (!isInteractive) {
    await applyFailureAccounting(hook.id, finalStatus === 'success', policy.disableThreshold);
  }

  return { status: finalStatus, error: lastError };
}

module.exports = {
  executeHookForEvent,
  resolvePolicy,
  buildActionSnapshot,
};
