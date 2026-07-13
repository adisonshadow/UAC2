/**
 * Per-model 内存态限流器（进程内）。
 *
 * 用于在上游 AI Provider（豆包/Seed 等突发保护严格的模型）前加护栏，
 * 防止 AIBase 续接循环密集连发请求打穿 Provider。
 *
 * 维度：
 * - maxConcurrent：限制同一模型同时进行中的上游请求数（并发闸门 + 等待队列）。
 * - requestsPerMinute：令牌桶，限制每分钟请求量。
 *
 * 两个维度均可独立配置、可留空（null = 不限制）。
 * 全空时 acquire 直接放行，不占用任何资源。
 *
 * 说明：进程内实现，适用于单实例部署；多实例下需替换为 Redis 等共享存储。
 */

const { AIBaseError } = require('../../utils/aiErrors');

// slug → 限流状态
const buckets = new Map();

/**
 * @typedef {Object} RateLimitConfig
 * @property {number|null} [maxConcurrent]
 * @property {number|null} [requestsPerMinute]
 */

function hasLimit(config) {
  if (!config) return false;
  return Boolean(config.maxConcurrent || config.requestsPerMinute);
}

function getOrCreateBucket(slug, config) {
  let bucket = buckets.get(slug);
  if (!bucket) {
    bucket = {
      maxConcurrent: config.maxConcurrent || null,
      rpm: config.requestsPerMinute || null,
      // 令牌桶：初始满桶，按每分钟补充令牌
      tokens: config.requestsPerMinute || 0,
      lastRefill: Date.now(),
      inFlight: 0,
      // 并发等待队列
      queue: []
    };
    buckets.set(slug, bucket);
  }
  return bucket;
}

/** 按时间流逝补充令牌 */
function refillTokens(bucket) {
  if (!bucket.rpm) return;
  const now = Date.now();
  const elapsedMs = now - bucket.lastRefill;
  // 令牌数 = 毫秒 / 60000 * rpm
  const refill = (elapsedMs / 60000) * bucket.rpm;
  if (refill > 0) {
    bucket.tokens = Math.min(bucket.rpm, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
}

/** 等待一个并发出线位（已确认有名额或入队等待） */
function waitForConcurrencySlot(bucket, traceId) {
  return new Promise((resolve, reject) => {
    const entry = { traceId, resolve, reject, timer: null };

    // 超时兜底：避免队列无限积压。默认 30s 内拿不到并发位则限流失败。
    const MAX_WAIT_MS = 30000;
    entry.timer = setTimeout(() => {
      const idx = bucket.queue.indexOf(entry);
      if (idx >= 0) bucket.queue.splice(idx, 1);
      reject(
        new AIBaseError(
          'RATE_LIMITED',
          '当前模型并发请求过多，已排队等待超时，请稍后重试',
          traceId
        )
      );
    }, MAX_WAIT_MS);

    bucket.queue.push(entry);
  });
}

/** 释放一个并发出线位，唤醒队首 */
function releaseConcurrencySlot(bucket) {
  if (!bucket.maxConcurrent) return;
  bucket.inFlight = Math.max(0, bucket.inFlight - 1);
  while (bucket.queue.length > 0 && bucket.inFlight < bucket.maxConcurrent) {
    const next = bucket.queue.shift();
    clearTimeout(next.timer);
    bucket.inFlight += 1;
    next.resolve();
  }
}

/**
 * 获取一次请求的"许可"。返回 release 句柄，请求结束后必须调用（含错误路径）。
 *
 * @param {string} slug 模型 slug（限流维度 key）
 * @param {RateLimitConfig} config 该模型的限流配置（来自 resolveModel.rateLimit）
 * @param {string} traceId 链路追踪 id
 * @returns {Promise<() => void>} release 函数
 * @throws {AIBaseError} RATE_LIMITED —— 超出 RPM 且无法即时排队，或并发等待超时
 */
async function acquire(slug, config, traceId) {
  // 无配置 → 直接放行
  if (!hasLimit(config)) {
    return () => {};
  }

  const bucket = getOrCreateBucket(slug, config);

  // 1) RPM 令牌桶：无令牌则直接拒绝（让前端退避重试，而非长排队）
  if (bucket.rpm) {
    refillTokens(bucket);
    if (bucket.tokens < 1) {
      // 计算到下一令牌的等待秒数，作为 Retry-After 提示
      const retryAfterSec = Math.ceil((1 - bucket.tokens) / bucket.rpm * 60) || 1;
      const err = new AIBaseError('RATE_LIMITED', '触发模型 RPM 限流，请稍后重试', traceId);
      err.retryAfter = retryAfterSec;
      throw err;
    }
    bucket.tokens -= 1;
  }

  // 2) 并发闸门：有名额则立即占用，否则排队等待（有超时兜底）
  if (bucket.maxConcurrent) {
    if (bucket.inFlight < bucket.maxConcurrent) {
      bucket.inFlight += 1;
      return () => releaseConcurrencySlot(bucket);
    }
    await waitForConcurrencySlot(bucket, traceId);
    return () => releaseConcurrencySlot(bucket);
  }

  return () => {};
}

module.exports = {
  acquire,
  // 仅供测试 / 内部清理
  _reset() {
    buckets.clear();
  }
};
