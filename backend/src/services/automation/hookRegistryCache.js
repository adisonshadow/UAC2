/**
 * 钩子注册表内存缓存。
 * 启动/首次访问时全量加载 enabled 钩子，CRUD/启停后失效重建；
 * 事件分发路径只做内存匹配（零 DB 查询）。
 * 过滤条件在加载时预编译（Set 匹配 + 表达式 vm.Script）。
 */
const vm = require('vm');
const logger = require('../../utils/logger');
const { AutomationHook } = require('../../models');

let cache = { hooks: [], loadedAt: null };
let loadingPromise = null;

/** 预编译表达式条件（绑定 payload / event；异常视为不匹配） */
function compileConditionExpr(expr) {
  const text = String(expr || '').trim();
  if (!text) return null;
  try {
    return new vm.Script(`(${text})`);
  } catch (e) {
    logger.warn('钩子条件表达式编译失败（该钩子表达式将被忽略）', { expr: text, error: e.message });
    return null;
  }
}

function toSet(list) {
  if (!Array.isArray(list)) return null;
  const set = new Set(list.map((v) => String(v)).filter(Boolean));
  return set.size ? set : null;
}

/** 过滤条件预编译：由宽到严（对象 → 操作 → 字段 → 表达式） */
function compileFilter(hook) {
  const filter = hook.eventFilter && typeof hook.eventFilter === 'object'
    ? hook.eventFilter
    : {};
  return {
    entityCodes: toSet(filter.entityCodes),
    apiServiceIds: toSet(filter.apiServiceIds),
    operations: toSet(filter.operations),
    changedFields: toSet(filter.changedFields),
    invokeStatus: toSet(filter.invokeStatus),
    cron: filter.cron ? String(filter.cron) : null,
    conditionScript: compileConditionExpr(hook.conditionExpr),
  };
}

/**
 * 判断预编译过滤器是否匹配事件负载；返回 { matched, reason }。
 * @param {object} compiled compileFilter 结果
 * @param {object} envelope HookEvent 信封
 * @param {{ id?: string }|null} [hook] 注册表中的钩子（schedule.cron 需按 hook_id 定向）
 */
function matchesFilter(compiled, envelope, hook = null) {
  const payload = envelope.payload || {};

  // cron 触发：同一表达式可能挂多个钩子，必须按 payload.hook_id 定向，避免 N×N
  if (envelope.type === 'schedule.cron') {
    const targetHookId = String(payload.hook_id || '');
    if (!hook?.id || targetHookId !== String(hook.id)) {
      return { matched: false, reason: '非本钩子的 cron 触发' };
    }
  }

  if (compiled.entityCodes && !compiled.entityCodes.has(String(payload.entity_code || ''))) {
    return { matched: false, reason: 'entity_code 不在过滤范围' };
  }
  if (compiled.apiServiceIds && !compiled.apiServiceIds.has(String(payload.api_service_id || ''))) {
    return { matched: false, reason: 'api_service_id 不在过滤范围' };
  }
  if (compiled.operations && !compiled.operations.has(String(payload.operation || ''))) {
    return { matched: false, reason: 'operation 不在过滤范围' };
  }
  if (compiled.changedFields) {
    const changed = Array.isArray(payload.changed_fields) ? payload.changed_fields : [];
    if (!changed.some((f) => compiled.changedFields.has(String(f)))) {
      return { matched: false, reason: '变更字段不在过滤范围' };
    }
  }
  if (compiled.invokeStatus && !compiled.invokeStatus.has(String(payload.status || ''))) {
    return { matched: false, reason: 'status 不在过滤范围' };
  }
  if (compiled.cron && compiled.cron !== String(payload.cron || '')) {
    return { matched: false, reason: 'cron 表达式不匹配' };
  }
  if (compiled.conditionScript) {
    try {
      const result = compiled.conditionScript.runInNewContext(
        { payload, event: envelope, undefined: undefined },
        { timeout: 500 },
      );
      if (result !== true) {
        return { matched: false, reason: '条件表达式不满足' };
      }
    } catch (e) {
      logger.warn('钩子条件表达式求值失败（视为不匹配）', { error: e.message });
      return { matched: false, reason: `条件表达式求值失败: ${e.message}` };
    }
  }
  return { matched: true, reason: null };
}

async function reload() {
  const rows = await AutomationHook.findAll({ where: { status: 'enabled' } });
  cache = {
    hooks: rows.map((row) => ({
      id: row.id,
      name: row.name,
      eventType: row.event_type,
      actionType: row.action_type,
      actionConfig: row.action_config || {},
      failurePolicy: row.failure_policy || {},
      conditionExpr: row.condition_expr,
      version: row.version,
      compiled: compileFilter({
        eventFilter: row.event_filter,
        conditionExpr: row.condition_expr,
      }),
    })),
    loadedAt: Date.now(),
  };
  return cache.hooks.length;
}

/** 获取 enabled 钩子快照（首次访问触发加载；失败降级为空表并记录） */
async function getEnabledHooks() {
  if (!cache.loadedAt) {
    if (!loadingPromise) {
      loadingPromise = reload()
        .catch((e) => {
          logger.error('钩子注册表加载失败（事件分发将空跑）', { error: e.message });
          cache = { hooks: [], loadedAt: Date.now() };
          return 0;
        })
        .finally(() => { loadingPromise = null; });
    }
    await loadingPromise;
  }
  return cache.hooks;
}

/** CRUD/启停后失效；下一次访问或显式 reloadNow 重建 */
function invalidate() {
  cache = { hooks: [], loadedAt: null };
}

async function reloadNow() {
  invalidate();
  await getEnabledHooks();
}

module.exports = {
  getEnabledHooks,
  invalidate,
  reloadNow,
  matchesFilter,
  compileFilter,
};
