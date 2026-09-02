/**
 * 事件执行上下文：以 AsyncLocalStorage 携带事件链深度。
 * 钩子动作（internal_api / script）引发的后续事件 depth+1，
 * depth ≥ 3 的后续钩子执行将被拦截（防循环触发，记 suppressed）。
 */
const { AsyncLocalStorage } = require('async_hooks');

const eventDepthStorage = new AsyncLocalStorage();

const MAX_EVENT_DEPTH = 3;

/** 在指定事件深度内运行 fn（fn 内发出的 emit 将携带 depth） */
function runWithEventDepth(depth, fn) {
  return eventDepthStorage.run(depth, fn);
}

/** 当前执行链的事件深度；不在钩子执行链中时为 0 */
function currentEventDepth() {
  const depth = eventDepthStorage.getStore();
  return typeof depth === 'number' && Number.isFinite(depth) ? depth : 0;
}

/** 子事件应携带的深度 */
function nextEventDepth() {
  return currentEventDepth() + 1;
}

module.exports = {
  MAX_EVENT_DEPTH,
  runWithEventDepth,
  currentEventDepth,
  nextEventDepth,
};
