/**
 * 钩子领域服务：CRUD / 启停 / 软删 / 测试 / 重放 / 运行历史 / 统计。
 * 所有写操作后失效注册表缓存并刷新调度器。
 */
const cron = require('node-cron');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { AutomationHook, AutomationHookRun } = require('../../models');
const logger = require('../../utils/logger');
const { encryptApiKey, decryptApiKey } = require('../../utils/encryption');
const { isValidEventType, listEventTypes } = require('./eventCatalog');
const hookRegistryCache = require('./hookRegistryCache');
const { executeHookForEvent, buildActionSnapshot } = require('./hookExecutor');
const { assertHookScriptValid, checkHookScript, MAX_SOURCE_CHARS } = require('./hookTypeCheck');
const { MAX_SOURCE_CHARS: RUNTIME_MAX_SOURCE } = require('./hookScriptRuntime');

const ACTION_TYPES = new Set(['http_request', 'internal_api', 'script']);
const SETTABLE_STATUSES = new Set(['draft', 'enabled', 'disabled']);

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

function assertValidEventType(eventType) {
  if (!isValidEventType(eventType)) {
    throw Object.assign(new Error(`未知事件类型: ${eventType}`), { status: 400 });
  }
}

function assertValidConditionExpr(expr) {
  if (!expr || !String(expr).trim()) return;
  try {
    // eslint-disable-next-line no-new, no-new-func
    new Function('payload', 'event', `"use strict"; return (${String(expr)});`);
  } catch (e) {
    throw Object.assign(
      new Error(`条件表达式语法错误: ${e.message}`),
      { status: 400 },
    );
  }
}

function assertValidCron(filter, eventType) {
  if (eventType !== 'schedule.cron') return;
  const expression = String(filter?.cron || '').trim();
  if (!expression) {
    throw Object.assign(new Error('定时触发钩子必须在 eventFilter.cron 配置表达式'), { status: 400 });
  }
  if (!cron.validate(expression)) {
    throw Object.assign(new Error(`无效的 cron 表达式: ${expression}`), { status: 400 });
  }
}

/**
 * 校验并规整动作配置；auth.secret（明文）→ auth.secretEnc（加密），空/缺省保留旧密钥。
 * @param {object} nextConfig 提交的 action_config
 * @param {object|null} prevRow 旧钩子行（保留旧密钥用）
 */
function normalizeActionConfig(actionType, nextConfig, prevRow) {
  const config = nextConfig && typeof nextConfig === 'object'
    ? JSON.parse(JSON.stringify(nextConfig))
    : {};

  if (actionType === 'http_request') {
    if (!String(config.url || '').trim()) {
      throw Object.assign(new Error('http_request 动作缺少 url'), { status: 400 });
    }
    const method = String(config.method || 'POST').toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      throw Object.assign(new Error('http_request 仅支持 POST / PUT / PATCH'), { status: 400 });
    }
    config.method = method;
    const auth = config.auth && typeof config.auth === 'object' ? config.auth : {};
    const prevEnc = prevRow?.action_config?.auth?.secretEnc || null;
    const secret = auth.secret;
    delete auth.secret;
    if (auth.type === 'none' || !auth.type) {
      auth.type = auth.type || 'none';
      auth.secretEnc = null;
    } else if (typeof secret === 'string' && secret.length) {
      auth.secretEnc = encryptApiKey(secret);
    } else {
      auth.secretEnc = prevEnc; // 空提交保留
    }
    config.auth = auth;
  }

  if (actionType === 'internal_api') {
    if (!String(config.apiServiceId || '').trim()) {
      throw Object.assign(new Error('internal_api 动作缺少 apiServiceId'), { status: 400 });
    }
  }

  if (actionType === 'script') {
    const source = String(config.source || '');
    if (!source.trim()) {
      throw Object.assign(new Error('script 动作缺少 source 脚本'), { status: 400 });
    }
    if (source.length > MAX_SOURCE_CHARS) {
      throw Object.assign(new Error(`脚本超过 ${MAX_SOURCE_CHARS} 字符上限`), { status: 400 });
    }
    assertHookScriptValid(source);
  }

  return config;
}

function validateHookPayload(body, prevRow = null) {
  const name = String(body.name || '').trim();
  if (!name) throw Object.assign(new Error('钩子名称不能为空'), { status: 400 });

  const eventType = String(body.eventType || body.event_type || '').trim();
  assertValidEventType(eventType);

  const actionType = String(body.actionType || body.action_type || '').trim();
  if (!ACTION_TYPES.has(actionType)) {
    throw Object.assign(new Error(`未知动作类型: ${actionType}`), { status: 400 });
  }

  const eventFilter = body.eventFilter && typeof body.eventFilter === 'object'
    ? body.eventFilter
    : (body.event_filter && typeof body.event_filter === 'object' ? body.event_filter : {});
  assertValidCron(eventFilter, eventType);
  assertValidConditionExpr(body.conditionExpr ?? body.condition_expr);

  return {
    name,
    description: body.description ?? null,
    eventType,
    eventFilter,
    conditionExpr: body.conditionExpr ?? body.condition_expr ?? null,
    actionType,
    actionConfig: normalizeActionConfig(
      actionType,
      body.actionConfig ?? body.action_config ?? {},
      prevRow,
    ),
    failurePolicy: body.failurePolicy && typeof body.failurePolicy === 'object'
      ? body.failurePolicy
      : (body.failure_policy && typeof body.failure_policy === 'object' ? body.failure_policy : {}),
  };
}

// ---------------------------------------------------------------------------
// 格式化（脱敏）
// ---------------------------------------------------------------------------

function maskSecretEnc(enc) {
  if (!enc) return null;
  try {
    const plain = decryptApiKey(enc);
    if (!plain) return null;
    if (plain.length <= 4) return '****';
    return `${'*'.repeat(Math.min(8, plain.length - 4))}${plain.slice(-4)}`;
  } catch {
    return '****';
  }
}

function formatHook(row) {
  const json = row.toJSON ? row.toJSON() : row;
  const auth = json.action_config?.auth;
  return {
    id: json.id,
    name: json.name,
    description: json.description,
    status: json.status,
    eventType: json.event_type,
    eventFilter: json.event_filter || {},
    conditionExpr: json.condition_expr,
    actionType: json.action_type,
    actionConfig: {
      ...json.action_config,
      auth: auth
        ? {
          ...auth,
          secretEnc: undefined,
          secretSet: Boolean(auth.secretEnc),
          secretMasked: maskSecretEnc(auth.secretEnc),
        }
        : undefined,
    },
    failurePolicy: json.failure_policy || {},
    consecutiveFailures: json.consecutive_failures,
    version: json.version,
    createdBy: json.created_by,
    updatedBy: json.updated_by,
    createdAt: json.created_at,
    updatedAt: json.updated_at,
  };
}

function formatRun(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    runGroupId: json.run_group_id,
    hookId: json.hook_id,
    hookVersion: json.hook_version,
    eventId: json.event_id,
    eventType: json.event_type,
    eventDepth: json.event_depth,
    triggerSource: json.trigger_source,
    payload: json.payload,
    actionConfigSnapshot: json.action_config_snapshot,
    status: json.status,
    attempt: json.attempt,
    durationMs: json.duration_ms,
    error: json.error,
    output: json.output,
    logs: json.logs,
    startedAt: json.started_at,
    finishedAt: json.finished_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

async function listHooks({ status, eventType, page = 1, size = 20 } = {}) {
  const where = { status: { [Op.ne]: 'deleted' } };
  if (status) where.status = status;
  if (eventType) where.event_type = eventType;

  const { rows, count } = await AutomationHook.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  const hookIds = rows.map((r) => r.id);

  // 近 7 天正式触发统计（仅 event|schedule 计入成功率）
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let statsRows = [];
  let latestRuns = [];
  if (hookIds.length) {
    statsRows = await AutomationHookRun.findAll({
      where: {
        hook_id: { [Op.in]: hookIds },
        trigger_source: { [Op.in]: ['event', 'schedule'] },
        started_at: { [Op.gte]: since },
      },
      attributes: [
        'hook_id',
        'status',
        [AutomationHookRun.sequelize.fn('COUNT', '*'), 'count'],
      ],
      group: ['hook_id', 'status'],
      raw: true,
    });
    latestRuns = await Promise.all(
      hookIds.map((hookId) => AutomationHookRun.findOne({
        where: { hook_id: hookId },
        order: [['started_at', 'DESC']],
      })),
    );
  }

  const statsByHook = new Map();
  statsRows.forEach((s) => {
    const entry = statsByHook.get(s.hook_id) || { total: 0, success: 0 };
    const n = Number(s.count) || 0;
    entry.total += n;
    if (s.status === 'success') entry.success += n;
    statsByHook.set(s.hook_id, entry);
  });
  const latestByHook = new Map();
  latestRuns.forEach((run) => {
    if (run) latestByHook.set(run.hook_id, run);
  });

  return {
    total: count,
    page,
    size,
    items: rows.map((row) => {
      const stats = statsByHook.get(row.id) || { total: 0, success: 0 };
      const latest = latestByHook.get(row.id);
      return {
        ...formatHook(row),
        latestRun: latest ? {
          status: latest.status,
          triggerSource: latest.trigger_source,
          startedAt: latest.started_at,
          error: latest.error,
        } : null,
        stats7d: {
          total: stats.total,
          success: stats.success,
          successRate: stats.total ? Math.round((stats.success / stats.total) * 100) : null,
        },
      };
    }),
  };
}

async function getHookById(id, { includeRuns = false } = {}) {
  const row = await AutomationHook.findByPk(id);
  if (!row || row.status === 'deleted') return null;
  const result = { ...formatHook(row) };
  if (includeRuns) {
    const runs = await AutomationHookRun.findAll({
      where: { hook_id: id },
      order: [['started_at', 'DESC']],
      limit: 10,
    });
    result.recentRuns = runs.map(formatRun);
  }
  return result;
}

async function afterMutation(row) {
  await hookRegistryCache.reloadNow();
  try {
    const { refreshHookScheduler } = require('./hookScheduler');
    refreshHookScheduler();
  } catch { /* 调度器未加载时忽略 */ }
  return row;
}

async function createHook(body, actor = null) {
  const payload = validateHookPayload(body);
  const dup = await AutomationHook.findOne({
    where: { name: payload.name, status: { [Op.ne]: 'deleted' } },
  });
  if (dup) {
    throw Object.assign(new Error(`同名钩子已存在: ${payload.name}`), { status: 409 });
  }
  const status = SETTABLE_STATUSES.has(body.status) ? body.status : 'draft';
  const row = await AutomationHook.create({
    name: payload.name,
    description: payload.description,
    status,
    event_type: payload.eventType,
    event_filter: payload.eventFilter,
    condition_expr: payload.conditionExpr,
    action_type: payload.actionType,
    action_config: payload.actionConfig,
    failure_policy: payload.failurePolicy,
    created_by: actor?.user_id || actor?.username || null,
    updated_by: actor?.user_id || actor?.username || null,
  });
  await afterMutation();
  return formatHook(row);
}

async function updateHook(id, body, actor = null) {
  const row = await AutomationHook.findByPk(id);
  if (!row || row.status === 'deleted') {
    throw Object.assign(new Error('钩子不存在'), { status: 404 });
  }
  const payload = validateHookPayload(body, row);

  const dup = await AutomationHook.findOne({
    where: { name: payload.name, status: { [Op.ne]: 'deleted' }, id: { [Op.ne]: id } },
  });
  if (dup) {
    throw Object.assign(new Error(`同名钩子已存在: ${payload.name}`), { status: 409 });
  }

  // 禁用/自动停用状态下编辑保持原状态；启用状态下编辑仍启用
  await row.update({
    name: payload.name,
    description: payload.description,
    event_type: payload.eventType,
    event_filter: payload.eventFilter,
    condition_expr: payload.conditionExpr,
    action_type: payload.actionType,
    action_config: payload.actionConfig,
    failure_policy: payload.failurePolicy,
    version: (row.version || 1) + 1,
    updated_by: actor?.user_id || actor?.username || null,
  });
  await afterMutation();
  return formatHook(row);
}

async function setHookStatus(id, status, actor = null) {
  if (!SETTABLE_STATUSES.has(status)) {
    throw Object.assign(new Error(`非法状态: ${status}`), { status: 400 });
  }
  const row = await AutomationHook.findByPk(id);
  if (!row || row.status === 'deleted') {
    throw Object.assign(new Error('钩子不存在'), { status: 404 });
  }
  if (status === 'enabled') {
    // 启用前置校验：动作配置完整（草稿期允许的字段缺失此时必须补齐）
    if (row.action_type === 'http_request' && !String(row.action_config?.url || '').trim()) {
      throw Object.assign(new Error('启用前必须配置外呼 url'), { status: 400 });
    }
    if (row.action_type === 'internal_api' && !String(row.action_config?.apiServiceId || '').trim()) {
      throw Object.assign(new Error('启用前必须配置内部 API 服务'), { status: 400 });
    }
    if (row.action_type === 'script' && !String(row.action_config?.source || '').trim()) {
      throw Object.assign(new Error('启用前必须配置脚本'), { status: 400 });
    }
    if (row.event_type === 'schedule.cron') {
      assertValidCron(row.event_filter, row.event_type);
    }
  }
  await row.update({
    status,
    consecutive_failures: status === 'enabled' ? 0 : row.consecutive_failures,
    updated_by: actor?.user_id || actor?.username || null,
  });
  await afterMutation();
  return formatHook(row);
}

async function deleteHook(id) {
  const row = await AutomationHook.findByPk(id);
  if (!row || row.status === 'deleted') {
    throw Object.assign(new Error('钩子不存在'), { status: 404 });
  }
  await row.update({ status: 'deleted', deleted_at: new Date() });
  await afterMutation();
  return { id, deleted: true };
}

// ---------------------------------------------------------------------------
// 测试 / 重放 / 运行历史
// ---------------------------------------------------------------------------

function toHookView(row) {
  return {
    id: row.id,
    name: row.name,
    eventType: row.event_type,
    actionType: row.action_type,
    actionConfig: row.action_config || {},
    failurePolicy: row.failure_policy || {},
    conditionExpr: row.condition_expr,
    version: row.version,
  };
}

/**
 * 试跑：mock payload 或引用历史 Run 的 payload。
 * 先评估过滤条件（不匹配记 skipped Run 并返回说明），匹配则单次执行（trigger_source=test）。
 */
async function testHook(id, { mockPayload, sourceRunId } = {}) {
  const row = await AutomationHook.findByPk(id);
  if (!row || row.status === 'deleted') {
    throw Object.assign(new Error('钩子不存在'), { status: 404 });
  }

  let payload = mockPayload;
  let eventType = row.event_type;
  if (sourceRunId) {
    const run = await AutomationHookRun.findByPk(sourceRunId);
    if (!run) throw Object.assign(new Error('引用的运行记录不存在'), { status: 404 });
    const sourceEnvelope = run.payload && typeof run.payload === 'object' ? run.payload : {};
    payload = sourceEnvelope.payload ?? sourceEnvelope;
    eventType = run.event_type || eventType;
  }
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw Object.assign(new Error('mockPayload 须为 JSON 对象'), { status: 400 });
  }

  // schedule.cron 匹配要求 payload.hook_id；试跑时自动注入本钩子 id
  if (eventType === 'schedule.cron' && !payload.hook_id) {
    payload = { ...payload, hook_id: row.id };
  }

  const envelope = {
    id: randomUUID(),
    type: eventType,
    occurredAt: new Date().toISOString(),
    depth: 0,
    payload,
  };

  // 过滤条件评估（与分发器同一实现）
  const { compileFilter, matchesFilter } = hookRegistryCache;
  const compiled = compileFilter({ eventFilter: row.event_filter, conditionExpr: row.condition_expr });
  const { matched, reason } = matchesFilter(compiled, envelope, { id: row.id });

  if (!matched) {
    const run = await AutomationHookRun.create({
      run_group_id: randomUUID(),
      hook_id: row.id,
      hook_version: row.version || 1,
      event_id: envelope.id,
      event_type: envelope.type,
      event_depth: 0,
      trigger_source: 'test',
      payload: envelope,
      action_config_snapshot: buildActionSnapshot(row.action_config),
      status: 'skipped',
      attempt: 1,
      duration_ms: 0,
      error: `条件不匹配，未执行：${reason || '过滤条件不满足'}`,
      started_at: new Date(),
      finished_at: new Date(),
    });
    return { conditionMatched: false, reason, run: formatRun(run) };
  }

  const result = await executeHookForEvent(toHookView(row), envelope, { triggerSource: 'test' });
  const latestRun = await AutomationHookRun.findOne({
    where: { event_id: envelope.id, hook_id: row.id },
    order: [['attempt', 'DESC']],
  });
  return {
    conditionMatched: true,
    result,
    run: latestRun ? formatRun(latestRun) : null,
  };
}

/** 重放：用历史 Run 的原 payload 重新执行（新 event_id，trigger_source=replay） */
async function retryRun(runId) {
  const run = await AutomationHookRun.findByPk(runId);
  if (!run) throw Object.assign(new Error('运行记录不存在'), { status: 404 });
  const row = await AutomationHook.findByPk(run.hook_id);
  if (!row) throw Object.assign(new Error('钩子不存在（可能已被清理）'), { status: 404 });

  const sourceEnvelope = run.payload && typeof run.payload === 'object'
    ? run.payload
    : { type: run.event_type, payload: {} };
  const envelope = {
    id: randomUUID(),
    type: run.event_type,
    occurredAt: new Date().toISOString(),
    depth: Number(run.event_depth) || 0,
    payload: sourceEnvelope.payload ?? {},
  };

  const result = await executeHookForEvent(toHookView(row), envelope, { triggerSource: 'replay' });
  const latestRun = await AutomationHookRun.findOne({
    where: { event_id: envelope.id, hook_id: row.id },
    order: [['attempt', 'DESC']],
  });
  return { result, run: latestRun ? formatRun(latestRun) : null };
}

async function listRuns(hookId, { status, triggerSource, page = 1, size = 20 } = {}) {
  const where = { hook_id: hookId };
  if (status) where.status = status;
  if (triggerSource) where.trigger_source = triggerSource;
  const { rows, count } = await AutomationHookRun.findAndCountAll({
    where,
    order: [['started_at', 'DESC'], ['attempt', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });
  return { total: count, page, size, items: rows.map(formatRun) };
}

function getEventTypes() {
  return listEventTypes();
}

function validateScript(source) {
  const text = String(source || '');
  if (text.length > RUNTIME_MAX_SOURCE) {
    return {
      ok: false,
      diagnostics: [{ line: 1, column: 1, message: `脚本超过 ${RUNTIME_MAX_SOURCE} 字符上限` }],
    };
  }
  return checkHookScript(text);
}

module.exports = {
  listHooks,
  getHookById,
  createHook,
  updateHook,
  setHookStatus,
  deleteHook,
  testHook,
  retryRun,
  listRuns,
  getEventTypes,
  validateScript,
  formatHook,
  formatRun,
};
