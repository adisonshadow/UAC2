const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const {
  BizdataMetric,
  BizdataMetricRun,
  BizdataMetricValue,
} = require('../../models');

function normalizeSchedulePayload(payload) {
  const scheduleType = payload.scheduleType || payload.schedule_type;
  const scheduleConfig = payload.scheduleConfig || payload.schedule_config || {};

  if (scheduleType === 'cron') {
    const expression = String(scheduleConfig.expression || scheduleConfig.cron || '').trim();
    if (!expression) {
      return { schedule_type: 'manual', schedule_config: {} };
    }
    return {
      schedule_type: 'cron',
      schedule_config: { expression },
    };
  }

  if (scheduleType) {
    return {
      schedule_type: scheduleType,
      schedule_config: scheduleConfig,
    };
  }

  return null;
}

function formatMetric(row) {
  const d = row.toJSON ? row.toJSON() : row;
  return {
    id: d.id,
    code: d.code,
    label: d.label,
    description: d.description,
    metricType: d.metric_type,
    connectionId: d.connection_id,
    queryScript: d.query_script,
    formulaConfig: d.formula_config || {},
    computeMode: d.compute_mode,
    scheduleType: d.schedule_type,
    scheduleConfig: d.schedule_config || {},
    unit: d.unit,
    category: d.category,
    scopeCode: d.scope_code,
    status: d.status,
    lastComputedAt: d.last_computed_at,
    lastValue: d.last_value != null ? Number(d.last_value) : null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function formatRun(row) {
  const d = row.toJSON ? row.toJSON() : row;
  return {
    id: d.id,
    metricId: d.metric_id,
    status: d.status,
    triggeredBy: d.triggered_by,
    startedAt: d.started_at,
    finishedAt: d.finished_at,
    durationMs: d.duration_ms,
    errorMessage: d.error_message,
    rowCount: d.row_count,
    createdAt: d.created_at,
  };
}

function formatValue(row) {
  const d = row.toJSON ? row.toJSON() : row;
  return {
    id: d.id,
    metricId: d.metric_id,
    runId: d.run_id,
    value: d.value != null ? Number(d.value) : null,
    dimensionKey: d.dimension_key || '',
    computedAt: d.computed_at,
  };
}

function collectFormulaCodes(formulaConfig) {
  const cfg = formulaConfig || {};
  const codes = [];
  if (cfg.op === 'ratio') {
    if (cfg.numerator_code) codes.push(cfg.numerator_code);
    if (cfg.denominator_code) codes.push(cfg.denominator_code);
  } else if (cfg.op === 'diff') {
    if (cfg.left_code) codes.push(cfg.left_code);
    if (cfg.right_code) codes.push(cfg.right_code);
  } else if (cfg.op === 'sum' && Array.isArray(cfg.codes)) {
    codes.push(...cfg.codes);
  }
  return codes;
}

async function detectFormulaCycle(code, formulaConfig, metricsByCode) {
  const visited = new Set();
  const stack = new Set();

  async function walk(currentCode) {
    if (stack.has(currentCode)) {
      throw new Error(`指标公式存在循环依赖: ${currentCode}`);
    }
    if (visited.has(currentCode)) return;
    visited.add(currentCode);
    stack.add(currentCode);

    const metric = metricsByCode[currentCode];
    if (!metric || metric.metric_type !== 'formula') {
      stack.delete(currentCode);
      return;
    }

    const deps = collectFormulaCodes(metric.formula_config);
    for (const dep of deps) {
      await walk(dep);
    }
    stack.delete(currentCode);
  }

  const deps = collectFormulaCodes(formulaConfig);
  for (const dep of deps) {
    await walk(dep);
  }
}

async function validateFormulaConfig(formulaConfig, selfCode) {
  const cfg = formulaConfig || {};
  const op = cfg.op;
  if (!['ratio', 'sum', 'diff'].includes(op)) {
    throw new Error('formula_config.op 仅支持 ratio、sum、diff');
  }

  const codes = collectFormulaCodes(cfg);
  if (codes.length === 0) {
    throw new Error('formula_config 缺少依赖指标 code');
  }
  if (selfCode && codes.includes(selfCode)) {
    throw new Error('公式不能引用自身');
  }

  const existing = await BizdataMetric.findAll({
    where: { code: { [Op.in]: codes } },
  });
  const found = new Set(existing.map((m) => m.code));
  for (const c of codes) {
    if (!found.has(c)) {
      throw new Error(`依赖指标不存在: ${c}`);
    }
  }

  const metricsByCode = {};
  const allMetrics = await BizdataMetric.findAll();
  allMetrics.forEach((m) => {
    metricsByCode[m.code] = m;
  });
  if (selfCode) {
    metricsByCode[selfCode] = { metric_type: 'formula', formula_config: cfg };
  }
  await detectFormulaCycle(selfCode || 'new', cfg, metricsByCode);
}

async function listMetrics({ codePrefix, status, page = 1, size = 20 } = {}) {
  const where = {};
  if (codePrefix) where.code = { [Op.like]: `${codePrefix}%` };
  if (status) where.status = status;

  const offset = (Math.max(page, 1) - 1) * size;
  const { rows, count } = await BizdataMetric.findAndCountAll({
    where,
    order: [['code', 'ASC']],
    limit: size,
    offset,
  });

  return {
    total: count,
    items: rows.map(formatMetric),
  };
}

async function getMetricById(id) {
  const row = await BizdataMetric.findByPk(id);
  if (!row) return null;
  return formatMetric(row);
}

async function getMetricByCode(code) {
  const row = await BizdataMetric.findOne({ where: { code } });
  if (!row) return null;
  return formatMetric(row);
}

async function createMetric(payload) {
  const metricType = payload.metricType || payload.metric_type;
  if (!payload.code || !payload.label || !metricType) {
    throw new Error('code、label、metricType 为必填');
  }

  if (metricType === 'sql') {
    if (!payload.queryScript && !payload.query_script) {
      throw new Error('SQL 型指标需要 queryScript');
    }
  } else if (metricType === 'formula') {
    await validateFormulaConfig(payload.formulaConfig || payload.formula_config, payload.code);
  } else {
    throw new Error('metricType 仅支持 sql 或 formula');
  }

  const scheduleNorm = normalizeSchedulePayload(payload);

  const row = await BizdataMetric.create({
    code: payload.code,
    label: payload.label,
    description: payload.description,
    metric_type: metricType,
    connection_id: payload.connectionId || payload.connection_id,
    query_script: payload.queryScript || payload.query_script,
    formula_config: payload.formulaConfig || payload.formula_config || {},
    compute_mode: payload.computeMode || payload.compute_mode || 'scheduled',
    schedule_type: scheduleNorm?.schedule_type || payload.scheduleType || payload.schedule_type || 'manual',
    schedule_config: scheduleNorm?.schedule_config || payload.scheduleConfig || payload.schedule_config || {},
    unit: payload.unit,
    status: payload.status || 'enabled',
  });

  refreshMetricScheduler();
  return formatMetric(row);
}

async function updateMetric(id, payload) {
  const row = await BizdataMetric.findByPk(id);
  if (!row) return null;

  const metricType = payload.metricType || payload.metric_type || row.metric_type;
  const formulaConfig = payload.formulaConfig || payload.formula_config || row.formula_config;

  if (metricType === 'formula') {
    await validateFormulaConfig(formulaConfig, row.code);
  }

  const updates = {};
  if (payload.label != null) updates.label = payload.label;
  if (payload.description != null) updates.description = payload.description;
  if (payload.metricType != null || payload.metric_type != null) {
    updates.metric_type = payload.metricType || payload.metric_type;
  }
  if (payload.connectionId != null || payload.connection_id != null) {
    updates.connection_id = payload.connectionId || payload.connection_id;
  }
  if (payload.queryScript != null || payload.query_script != null) {
    updates.query_script = payload.queryScript || payload.query_script;
  }
  if (payload.formulaConfig != null || payload.formula_config != null) {
    updates.formula_config = payload.formulaConfig || payload.formula_config;
  }
  if (payload.computeMode != null || payload.compute_mode != null) {
    updates.compute_mode = payload.computeMode || payload.compute_mode;
  }
  if (payload.scheduleType != null || payload.schedule_type != null) {
    updates.schedule_type = payload.scheduleType || payload.schedule_type;
  }
  if (payload.scheduleConfig != null || payload.schedule_config != null) {
    updates.schedule_config = payload.scheduleConfig || payload.schedule_config;
  }
  if (payload.unit != null) updates.unit = payload.unit;
  if (payload.status != null) updates.status = payload.status;

  const scheduleNorm = normalizeSchedulePayload(payload);
  if (scheduleNorm) {
    updates.schedule_type = scheduleNorm.schedule_type;
    updates.schedule_config = scheduleNorm.schedule_config;
  }

  await row.update(updates);
  refreshMetricScheduler();
  return formatMetric(row);
}

async function deleteMetric(id) {
  const row = await BizdataMetric.findByPk(id);
  if (!row) return false;
  await row.destroy();
  refreshMetricScheduler();
  return true;
}

async function listRuns(metricId, { page = 1, size = 20 } = {}) {
  const offset = (Math.max(page, 1) - 1) * size;
  const { rows, count } = await BizdataMetricRun.findAndCountAll({
    where: { metric_id: metricId },
    order: [['created_at', 'DESC']],
    limit: size,
    offset,
  });
  return { total: count, items: rows.map(formatRun) };
}

async function listValues(metricId, { from, to, dimensionKey, page = 1, size = 50 } = {}) {
  const where = { metric_id: metricId };
  if (dimensionKey != null) where.dimension_key = dimensionKey;
  if (from || to) {
    where.computed_at = {};
    if (from) where.computed_at[Op.gte] = new Date(from);
    if (to) where.computed_at[Op.lte] = new Date(to);
  }

  const offset = (Math.max(page, 1) - 1) * size;
  const { rows, count } = await BizdataMetricValue.findAndCountAll({
    where,
    order: [['computed_at', 'DESC']],
    limit: size,
    offset,
  });
  return { total: count, items: rows.map(formatValue) };
}

async function getDashboard(options = {}) {
  const metricCardService = require('./metricCardService');
  return metricCardService.getDashboard(options);
}

async function listScheduledMetrics() {
  const rows = await BizdataMetric.findAll({
    where: {
      status: 'enabled',
      schedule_type: { [Op.in]: ['hourly', 'daily', 'cron'] },
    },
  });
  return rows.map(formatMetric);
}

function refreshMetricScheduler() {
  try {
    const { registerCronJobs } = require('./metricScheduler');
    registerCronJobs().catch((err) => {
      logger.warn('Metrics scheduler refresh failed', { message: err.message });
    });
  } catch {
    // scheduler 未加载时忽略
  }
}

module.exports = {
  formatMetric,
  formatRun,
  formatValue,
  collectFormulaCodes,
  listMetrics,
  getMetricById,
  getMetricByCode,
  createMetric,
  updateMetric,
  deleteMetric,
  listRuns,
  listValues,
  getDashboard,
  listScheduledMetrics,
};
