const {
  BizdataMetric,
  BizdataMetricRun,
  BizdataMetricValue,
} = require('../../models');
const { Op } = require('sequelize');
const databaseConnectionService = require('../businessData/databaseConnectionService');
const { withPgClient } = require('../businessData/materialization/connectionRunner');
const metricRedis = require('./metricRedis');
const metricService = require('./metricService');

function parseNumeric(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function resolveDependencyValue(code) {
  const cached = await metricRedis.getLatest(code);
  if (cached?.value != null) {
    return parseNumeric(cached.value);
  }
  const row = await BizdataMetric.findOne({ where: { code } });
  if (!row) throw new Error(`依赖指标不存在: ${code}`);
  if (row.last_value != null) return parseNumeric(row.last_value);
  throw new Error(`依赖指标尚无计算结果: ${code}`);
}

async function computeFormula(formulaConfig) {
  const cfg = formulaConfig || {};
  const op = cfg.op;

  if (op === 'ratio') {
    const numerator = await resolveDependencyValue(cfg.numerator_code);
    const denominator = await resolveDependencyValue(cfg.denominator_code);
    if (denominator === 0) throw new Error('比率计算除数不能为 0');
    return numerator / denominator;
  }

  if (op === 'sum') {
    const codes = Array.isArray(cfg.codes) ? cfg.codes : [];
    let total = 0;
    for (const code of codes) {
      total += await resolveDependencyValue(code);
    }
    return total;
  }

  if (op === 'diff') {
    const left = await resolveDependencyValue(cfg.left_code);
    const right = await resolveDependencyValue(cfg.right_code);
    return left - right;
  }

  throw new Error(`不支持的公式 op: ${op}`);
}

async function executeSqlQuery(metric) {
  const conn = await databaseConnectionService.resolveConnectionRecord(metric.connectionId);
  const runtime = databaseConnectionService.buildRuntimeConfig(conn);
  if (runtime.dbType !== 'postgresql') {
    throw new Error(`SQL 指标暂不支持 ${runtime.dbType} 连接，请使用 PostgreSQL`);
  }

  const script = String(metric.queryScript || '').trim();
  if (!script) throw new Error('queryScript 为空');

  const res = await withPgClient(runtime, (client) => client.query(script));
  const rows = res.rows || [];

  if (rows.length === 0) {
    throw new Error('查询未返回任何行');
  }

  const parsed = rows.map((row) => {
    if (row.value == null) {
      throw new Error('查询结果须包含 value 列');
    }
    const value = parseNumeric(row.value);
    if (value == null) throw new Error('value 列无法解析为数字');
    const dimensionKey = row.dimension_key != null ? String(row.dimension_key) : '';
    return { value, dimensionKey };
  });

  return parsed;
}

async function computeMetricRows(metric) {
  if (metric.metricType === 'sql') {
    return await executeSqlQuery(metric);
  }
  if (metric.metricType === 'formula') {
    const value = await computeFormula(metric.formulaConfig);
    return [{ value, dimensionKey: '' }];
  }
  throw new Error(`未知指标类型: ${metric.metricType}`);
}

function pickScalarValue(rows) {
  const scalar = rows.find((r) => !r.dimensionKey);
  return scalar ? scalar.value : rows[0].value;
}

async function persistResults(metricRow, run, rows, computedAt) {
  const metricId = metricRow.id;
  const valueRows = rows.map((r) => ({
    metric_id: metricId,
    run_id: run?.id || null,
    value: r.value,
    dimension_key: r.dimensionKey || '',
    computed_at: computedAt,
  }));

  if (run?.id) {
    await BizdataMetricValue.bulkCreate(valueRows);
  }

  const scalarValue = pickScalarValue(rows);
  await BizdataMetric.update(
    {
      last_value: scalarValue,
      last_computed_at: computedAt,
    },
    { where: { id: metricId } },
  );

  const metric = metricService.formatMetric(metricRow);
  await metricRedis.setLatest(metric.code, {
    value: scalarValue,
    unit: metric.unit,
    computedAt,
    dimensionKey: '',
  });

  return scalarValue;
}

async function execute(metricId, { triggeredBy = 'manual' } = {}) {
  const metricRow = await BizdataMetric.findByPk(metricId);
  if (!metricRow) return null;

  const locked = await metricRedis.acquireRunLock(metricId);
  if (!locked) {
    throw Object.assign(new Error('指标正在执行中'), { status: 409 });
  }

  const start = Date.now();
  let run = null;

  try {
    run = await BizdataMetricRun.create({
      metric_id: metricId,
      status: 'running',
      triggered_by: triggeredBy,
      started_at: new Date(),
    });

    const metric = metricService.formatMetric(metricRow);
    const rows = await computeMetricRows(metric);
    const computedAt = new Date();
    const scalarValue = await persistResults(metricRow, run, rows, computedAt);

    await run.update({
      status: 'success',
      finished_at: computedAt,
      duration_ms: Date.now() - start,
      row_count: rows.length,
    });

    return {
      metricId,
      runId: run.id,
      status: 'success',
      value: scalarValue,
      rowCount: rows.length,
      computedAt,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    const finishedAt = new Date();
    if (run) {
      await run.update({
        status: 'failed',
        finished_at: finishedAt,
        duration_ms: Date.now() - start,
        error_message: error.message,
      });
    }
    throw error;
  } finally {
    await metricRedis.releaseRunLock(metricId);
  }
}

async function executeOnDemand(metricId) {
  const metricRow = await BizdataMetric.findByPk(metricId);
  if (!metricRow) return null;

  const metric = metricService.formatMetric(metricRow);
  if (!['on_demand', 'both'].includes(metric.computeMode)) {
    throw Object.assign(new Error('该指标不支持 on_demand 即时重算'), { status: 400 });
  }

  const locked = await metricRedis.acquireRunLock(metricId);
  if (!locked) {
    throw Object.assign(new Error('指标正在执行中'), { status: 409 });
  }

  const start = Date.now();

  try {
    const rows = await computeMetricRows(metric);
    const computedAt = new Date();
    const scalarValue = await persistResults(metricRow, null, rows, computedAt);

    return {
      metricId,
      status: 'success',
      value: scalarValue,
      rowCount: rows.length,
      computedAt,
      durationMs: Date.now() - start,
      persisted: false,
    };
  } finally {
    await metricRedis.releaseRunLock(metricId);
  }
}

async function executeBatch({ codePrefix, scopeCode, triggeredBy = 'manual' } = {}) {
  const prefix = codePrefix || scopeCode;
  const where = { status: 'enabled' };
  if (prefix) {
    where.code = { [Op.like]: `${prefix}%` };
  }

  const metrics = await BizdataMetric.findAll({
    where,
    order: [['metric_type', 'ASC'], ['code', 'ASC']],
  });

  const sqlFirst = [...metrics].sort((a, b) => {
    if (a.metric_type === 'sql' && b.metric_type === 'formula') return -1;
    if (a.metric_type === 'formula' && b.metric_type === 'sql') return 1;
    return a.code.localeCompare(b.code);
  });

  const results = [];
  for (const row of sqlFirst) {
    try {
      const result = await execute(row.id, { triggeredBy });
      results.push({ metricId: row.id, code: row.code, success: true, result });
    } catch (error) {
      results.push({
        metricId: row.id,
        code: row.code,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

async function getLatestValue(metricId, { refresh = false } = {}) {
  const metricRow = await BizdataMetric.findByPk(metricId);
  if (!metricRow) return null;

  const metric = metricService.formatMetric(metricRow);

  if (refresh && ['on_demand', 'both'].includes(metric.computeMode)) {
    const result = await executeOnDemand(metricId);
    return {
      metricId,
      code: metric.code,
      value: result.value,
      unit: metric.unit,
      computedAt: result.computedAt,
      refreshed: true,
    };
  }

  const cached = await metricRedis.getLatest(metric.code);
  if (cached?.value != null) {
    return {
      metricId,
      code: metric.code,
      value: Number(cached.value),
      unit: cached.unit || metric.unit,
      computedAt: cached.computedAt,
      refreshed: false,
    };
  }

  return {
    metricId,
    code: metric.code,
    value: metric.lastValue,
    unit: metric.unit,
    computedAt: metric.lastComputedAt,
    refreshed: false,
  };
}

module.exports = {
  execute,
  executeOnDemand,
  executeBatch,
  getLatestValue,
};
