const { Op } = require('sequelize');
const {
  BizdataMetric,
  BizdataMetricCard,
  BizdataMetricRun,
  BizdataMetricValue,
} = require('../../models');
const { deriveScopePrefix } = require('./metricCodeUtils');

const VIZ_TYPES = new Set(['statistic_trend', 'line', 'bar', 'ring']);
const TIME_RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function formatCard(row) {
  const d = row.toJSON ? row.toJSON() : row;
  const metricRow = d.metric || null;
  return {
    id: d.id,
    code: d.code,
    title: d.title,
    description: d.description,
    domainCode: d.domain_code,
    metricId: d.metric_id,
    vizType: d.viz_type,
    config: d.config || {},
    sortOrder: d.sort_order,
    status: d.status,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    metric: metricRow
      ? {
          id: metricRow.id,
          code: metricRow.code,
          label: metricRow.label,
          unit: metricRow.unit,
          lastValue: metricRow.last_value != null ? Number(metricRow.last_value) : null,
          lastComputedAt: metricRow.last_computed_at,
        }
      : undefined,
  };
}

function parseTimeRange(config = {}) {
  const key = String(config.timeRange || config.time_range || '30d');
  const days = TIME_RANGE_DAYS[key] || 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, key };
}

async function resolveMetricId(payload) {
  if (payload.metricId || payload.metric_id) {
    return String(payload.metricId || payload.metric_id);
  }
  const code = String(payload.metricCode || payload.metric_code || '').trim();
  if (!code) return null;
  const row = await BizdataMetric.findOne({ where: { code } });
  return row?.id || null;
}

function normalizeCardPayload(payload = {}, { partial = false } = {}) {
  const out = {};
  if (payload.code != null) out.code = String(payload.code).trim();
  if (payload.title != null) out.title = String(payload.title).trim();
  if (payload.description !== undefined) out.description = payload.description;
  if (payload.domainCode != null || payload.domain_code != null) {
    out.domain_code = String(payload.domainCode || payload.domain_code).trim();
  }
  if (payload.vizType != null || payload.viz_type != null) {
    out.viz_type = String(payload.vizType || payload.viz_type).trim();
  }
  if (payload.config != null) out.config = payload.config || {};
  if (payload.sortOrder != null || payload.sort_order != null) {
    out.sort_order = Number(payload.sortOrder ?? payload.sort_order) || 0;
  }
  if (payload.status != null) out.status = String(payload.status).trim();

  if (!partial) {
    if (!out.code) throw new Error('code 必填');
    if (!out.title) throw new Error('title 必填');
    if (!out.domain_code) throw new Error('domainCode 必填');
    if (!out.viz_type || !VIZ_TYPES.has(out.viz_type)) {
      throw new Error('vizType 须为 statistic_trend | line | bar | ring');
    }
    if (out.status && !['enabled', 'disabled'].includes(out.status)) {
      throw new Error('status 须为 enabled | disabled');
    }
  } else if (out.viz_type && !VIZ_TYPES.has(out.viz_type)) {
    throw new Error('vizType 须为 statistic_trend | line | bar | ring');
  }

  return out;
}

async function listCards({ domainCode, status, page = 1, size = 50 } = {}) {
  const where = {};
  if (domainCode) where.domain_code = domainCode;
  if (status) where.status = status;
  const offset = (Math.max(page, 1) - 1) * size;
  const { rows, count } = await BizdataMetricCard.findAndCountAll({
    where,
    include: [{ model: BizdataMetric, as: 'metric', required: false }],
    order: [['domain_code', 'ASC'], ['sort_order', 'DESC'], ['created_at', 'DESC']],
    limit: size,
    offset,
  });
  return { total: count, items: rows.map(formatCard) };
}

async function getCardById(id) {
  const row = await BizdataMetricCard.findByPk(id, {
    include: [{ model: BizdataMetric, as: 'metric', required: false }],
  });
  return row ? formatCard(row) : null;
}

async function getCardByCode(code) {
  const row = await BizdataMetricCard.findOne({
    where: { code },
    include: [{ model: BizdataMetric, as: 'metric', required: false }],
  });
  return row ? formatCard(row) : null;
}

async function createCard(payload) {
  const fields = normalizeCardPayload(payload, { partial: false });
  const metricId = await resolveMetricId(payload);
  if (!metricId) throw new Error('请提供 metricId 或 metricCode');
  const metric = await BizdataMetric.findByPk(metricId);
  if (!metric) throw new Error('绑定的指标不存在');

  if (!fields.domain_code) {
    fields.domain_code = deriveScopePrefix(metric.code) || 'default';
  }
  fields.metric_id = metricId;
  if (!fields.status) fields.status = 'enabled';
  if (fields.config == null) fields.config = {};

  const existing = await BizdataMetricCard.findOne({ where: { code: fields.code } });
  if (existing) throw new Error(`卡片 code 已存在: ${fields.code}`);

  const row = await BizdataMetricCard.create(fields);
  return getCardById(row.id);
}

async function updateCard(id, payload) {
  const row = await BizdataMetricCard.findByPk(id);
  if (!row) return null;
  const fields = normalizeCardPayload(payload, { partial: true });
  const metricId = await resolveMetricId(payload);
  if (metricId) {
    const metric = await BizdataMetric.findByPk(metricId);
    if (!metric) throw new Error('绑定的指标不存在');
    fields.metric_id = metricId;
  }
  if (fields.code && fields.code !== row.code) {
    const dup = await BizdataMetricCard.findOne({ where: { code: fields.code } });
    if (dup) throw new Error(`卡片 code 已存在: ${fields.code}`);
  }
  await row.update(fields);
  return getCardById(id);
}

async function deleteCard(id) {
  const row = await BizdataMetricCard.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

async function loadScalarSeries(metricId, { from, to, dimensionKey = '' }) {
  const rows = await BizdataMetricValue.findAll({
    where: {
      metric_id: metricId,
      dimension_key: dimensionKey == null ? '' : String(dimensionKey),
      computed_at: { [Op.gte]: from, [Op.lte]: to },
    },
    order: [['computed_at', 'ASC']],
    limit: 500,
  });
  return rows.map((r) => ({
    x: r.computed_at?.toISOString?.() || String(r.computed_at),
    value: Number(r.value),
    computedAt: r.computed_at,
  }));
}

async function loadLatestRunDimensions(metricId) {
  const run = await BizdataMetricRun.findOne({
    where: { metric_id: metricId, status: 'success' },
    order: [['created_at', 'DESC']],
  });
  if (!run) return { run: null, items: [] };
  const rows = await BizdataMetricValue.findAll({
    where: { run_id: run.id },
    order: [['dimension_key', 'ASC']],
  });
  return {
    run,
    items: rows.map((r) => ({
      category: r.dimension_key || '(空)',
      value: Number(r.value),
      computedAt: r.computed_at,
    })),
  };
}

async function loadSumByDimension(metricId, { from, to }) {
  const rows = await BizdataMetricValue.findAll({
    where: {
      metric_id: metricId,
      computed_at: { [Op.gte]: from, [Op.lte]: to },
      dimension_key: { [Op.ne]: '' },
    },
    order: [['computed_at', 'ASC']],
    limit: 2000,
  });
  const map = new Map();
  for (const r of rows) {
    const key = r.dimension_key || '(空)';
    map.set(key, (map.get(key) || 0) + Number(r.value));
  }
  return Array.from(map.entries()).map(([category, value]) => ({ category, value }));
}

async function hydrateCard(cardRow) {
  const card = formatCard(cardRow);
  const metric = cardRow.metric;
  const unit = metric?.unit || undefined;
  const base = {
    ...card,
    unit,
    metric: metric
      ? {
          id: metric.id,
          code: metric.code,
          label: metric.label,
        }
      : card.metric,
    value: null,
    trend: undefined,
    series: undefined,
    lastComputedAt: metric?.last_computed_at || undefined,
    emptyReason: undefined,
  };

  if (!metric) {
    return { ...base, emptyReason: '绑定指标不存在' };
  }

  const config = card.config || {};
  const { from, to } = parseTimeRange(config);
  const aggregate = String(config.aggregate || 'latest');
  const dimensionKey = config.dimensionKey != null ? String(config.dimensionKey) : '';

  if (card.vizType === 'statistic_trend' || card.vizType === 'line') {
    const series = await loadScalarSeries(metric.id, { from, to, dimensionKey });
    if (!series.length) {
      const fallback = metric.last_value != null ? Number(metric.last_value) : null;
      if (fallback == null) {
        return { ...base, emptyReason: '请先执行指标以产生历史数据' };
      }
      return {
        ...base,
        value: fallback,
        lastComputedAt: metric.last_computed_at,
        series: card.vizType === 'line' ? [] : undefined,
        emptyReason: card.vizType === 'line' ? '请先执行指标以产生历史数据' : undefined,
      };
    }

    const last = series[series.length - 1];
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    let trend;
    if (prev && prev.value !== 0) {
      const percent = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
      const direction = percent > 0.0001 ? 'up' : percent < -0.0001 ? 'down' : 'flat';
      trend = { direction, percent: Math.round(percent * 100) / 100 };
    } else if (prev && prev.value === 0 && last.value !== 0) {
      trend = { direction: last.value > 0 ? 'up' : 'down', percent: 100 };
    } else {
      trend = { direction: 'flat', percent: 0 };
    }

    return {
      ...base,
      value: last.value,
      trend: card.vizType === 'statistic_trend' ? trend : undefined,
      series: series.map((p) => ({ x: p.x, value: p.value })),
      lastComputedAt: last.computedAt,
    };
  }

  if (card.vizType === 'bar' || card.vizType === 'ring') {
    let items = [];
    let lastComputedAt = metric.last_computed_at;
    if (aggregate === 'sum') {
      items = await loadSumByDimension(metric.id, { from, to });
    } else {
      const { run, items: dimItems } = await loadLatestRunDimensions(metric.id);
      items = dimItems;
      if (run?.finished_at) lastComputedAt = run.finished_at;
      else if (items[0]?.computedAt) lastComputedAt = items[0].computedAt;
    }

    // 若最新 run 只有空维标量，退回窗内所有非空维
    if (!items.length || (items.length === 1 && items[0].category === '(空)')) {
      const summed = await loadSumByDimension(metric.id, { from, to });
      if (summed.length) items = summed;
    }

    if (!items.length) {
      return { ...base, emptyReason: '暂无多维数据，请确认 SQL 返回 dimension_key 并已执行' };
    }

    const total = items.reduce((s, i) => s + i.value, 0);
    return {
      ...base,
      value: total,
      series: items.map((i) => ({ category: i.category, value: i.value })),
      lastComputedAt,
    };
  }

  return { ...base, emptyReason: `不支持的 vizType: ${card.vizType}` };
}

async function getDashboard({ domainCode, codePrefix, refresh } = {}) {
  const where = { status: 'enabled' };
  if (domainCode) where.domain_code = domainCode;

  const cards = await BizdataMetricCard.findAll({
    where,
    include: [{ model: BizdataMetric, as: 'metric', required: false }],
    order: [['domain_code', 'ASC'], ['sort_order', 'DESC'], ['created_at', 'DESC']],
  });

  let filtered = cards;
  if (codePrefix) {
    const prefix = String(codePrefix);
    filtered = cards.filter((c) => {
      const metricCode = c.metric?.code || '';
      return metricCode.startsWith(prefix) || c.domain_code.startsWith(prefix) || c.code.startsWith(prefix);
    });
  }

  if (refresh) {
    const metricExecutor = require('./metricExecutor');
    const seen = new Set();
    for (const c of filtered) {
      const metric = c.metric;
      if (!metric || seen.has(metric.id)) continue;
      seen.add(metric.id);
      if (['on_demand', 'both'].includes(metric.compute_mode)) {
        try {
          await metricExecutor.executeOnDemand(metric.id);
          const updated = await BizdataMetric.findByPk(metric.id);
          if (updated) c.metric = updated;
        } catch {
          // 单个失败不阻断看板
        }
      }
    }
  }

  const hydrated = [];
  for (const c of filtered) {
    hydrated.push(await hydrateCard(c));
  }

  const grouped = {};
  for (const card of hydrated) {
    const key = card.domainCode || '未分类';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(card);
  }

  return {
    domains: Object.keys(grouped).map((name) => ({
      name,
      cards: grouped[name],
    })),
  };
}

async function suggestCardFromMetric(metricIdOrCode) {
  let metric;
  if (String(metricIdOrCode || '').includes(':') || !/^[0-9a-f-]{36}$/i.test(String(metricIdOrCode || ''))) {
    metric = await BizdataMetric.findOne({ where: { code: String(metricIdOrCode).trim() } });
  } else {
    metric = await BizdataMetric.findByPk(metricIdOrCode);
  }
  if (!metric) throw new Error('指标不存在');

  const recent = await BizdataMetricValue.findAll({
    where: { metric_id: metric.id },
    order: [['computed_at', 'DESC']],
    limit: 100,
  });
  const dims = new Set(recent.map((r) => r.dimension_key).filter((k) => k && k !== ''));
  const scalarPoints = recent.filter((r) => !r.dimension_key || r.dimension_key === '');

  let vizType = 'statistic_trend';
  if (dims.size >= 2) vizType = 'bar';
  else if (scalarPoints.length >= 3) vizType = 'line';
  else if (dims.size === 1) vizType = 'ring';

  const domainCode = deriveScopePrefix(metric.code) || 'default';
  const suffix = vizType === 'statistic_trend' ? 'trend' : vizType;
  return {
    code: `${metric.code}:${suffix}`,
    title: metric.label,
    domainCode,
    metricId: metric.id,
    metricCode: metric.code,
    vizType,
    config: {
      timeRange: '30d',
      aggregate: vizType === 'bar' || vizType === 'ring' ? 'latest' : undefined,
      chartPlacement: 'bottom',
    },
    status: 'enabled',
    hint:
      dims.size >= 2
        ? '检测到多维 dimension_key，建议柱状图；合计占比可用 ring'
        : scalarPoints.length >= 3
          ? '检测到时序点，建议折线图；单值涨跌可用 statistic_trend'
          : '历史点较少，建议先执行指标再创建卡片',
  };
}

module.exports = {
  VIZ_TYPES,
  formatCard,
  listCards,
  getCardById,
  getCardByCode,
  createCard,
  updateCard,
  deleteCard,
  getDashboard,
  suggestCardFromMetric,
  hydrateCard,
};
