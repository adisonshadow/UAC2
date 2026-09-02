/**
 * 事件分发器：emit(type, payload) → 构造统一信封 → 内存注册表匹配 → 进程内异步队列执行。
 * 设计约束：
 *  - 永不向调用方（业务主流程）抛错；
 *  - 主请求路径零 await 动作执行（setImmediate 投递后立即返回）；
 *  - 全局并发上限 + 队列深度上限（满则记 suppressed Run，不无界堆积）。
 */
const { randomUUID } = require('crypto');
const logger = require('../../utils/logger');
const hookRegistryCache = require('./hookRegistryCache');
const { currentEventDepth, MAX_EVENT_DEPTH } = require('./eventContext');
const { isValidEventType } = require('./eventCatalog');

const GLOBAL_MAX_CONCURRENCY = 20;
const QUEUE_MAX_DEPTH = 500;

let activeCount = 0;
const queue = [];
let executorFn = null;

/**
 * 延迟加载执行器（避免 dispatcher ↔ executor 循环依赖）。
 * hookExecutor 在模块加载完成后调用 bindExecutor 注册自身。
 */
function getExecutor() {
  if (executorFn) return executorFn;
  try {
    // eslint-disable-next-line global-require
    executorFn = require('./hookExecutor').executeHookForEvent;
  } catch {
    executorFn = false;
  }
  return executorFn || null;
}

function pump() {
  while (activeCount < GLOBAL_MAX_CONCURRENCY && queue.length) {
    const task = queue.shift();
    activeCount += 1;
    setImmediate(() => {
      Promise.resolve()
        .then(task)
        .catch((e) => logger.error('钩子执行任务异常', { error: e.message }))
        .finally(() => {
          activeCount -= 1;
          pump();
        });
    });
  }
}

/** 供测试/极端场景观察队列状态 */
function getQueueStats() {
  return { active: activeCount, depth: queue.length, maxDepth: QUEUE_MAX_DEPTH };
}

/**
 * 发出事件（fire-and-forget）。
 * @param {string} type 事件类型（须在 eventCatalog 登记）
 * @param {object} payload 事件负载
 * @param {{ source?: 'event'|'test'|'replay'|'schedule', envelopeOverride?: object }} [opts]
 *   envelopeOverride 供重放/测试注入完整信封（新 event_id）
 */
async function emit(type, payload, opts = {}) {
  try {
    if (!isValidEventType(type)) {
      logger.warn('忽略未登记的事件类型', { type });
      return;
    }
    const envelope = opts.envelopeOverride || {
      id: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      depth: currentEventDepth(),
      payload: payload || {},
    };

    const hooks = await hookRegistryCache.getEnabledHooks();
    const matched = [];
    for (const hook of hooks) {
      if (hook.eventType !== type) continue;
      const { matched: hit } = hookRegistryCache.matchesFilter(hook.compiled, envelope, hook);
      if (hit) matched.push(hook);
    }
    if (!matched.length) return;

    const executor = getExecutor();
    if (!executor) {
      logger.warn('钩子执行器不可用，事件被丢弃', { type });
      return;
    }

    for (const hook of matched) {
      // 递归保护：depth 超限不执行，记 suppressed（执行器负责落 Run）
      if (envelope.depth >= MAX_EVENT_DEPTH) {
        setImmediate(() => {
          Promise.resolve(executor(hook, envelope, { triggerSource: opts.source || 'event', suppressed: 'depth' }))
            .catch(() => {});
        });
        continue;
      }
      if (queue.length >= QUEUE_MAX_DEPTH) {
        logger.error('钩子执行队列已满（suppressed）', { type, hookId: hook.id, ...getQueueStats() });
        setImmediate(() => {
          Promise.resolve(executor(hook, envelope, { triggerSource: opts.source || 'event', suppressed: 'queue_full' }))
            .catch(() => {});
        });
        continue;
      }
      queue.push(() => executor(hook, envelope, { triggerSource: opts.source || 'event' }));
    }
    pump();
  } catch (e) {
    logger.warn('事件分发失败（不影响业务主流程）', { type, error: e.message });
  }
}

module.exports = {
  emit,
  getQueueStats,
  GLOBAL_MAX_CONCURRENCY,
  QUEUE_MAX_DEPTH,
};
