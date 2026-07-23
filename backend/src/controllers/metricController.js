const metricService = require('../services/metrics/metricService');
const metricCardService = require('../services/metrics/metricCardService');
const metricExecutor = require('../services/metrics/metricExecutor');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendMetricError(ctx, error, options = {}) {
  const formatted = formatApiError(error, options);
  logger.error(formatted.message, {
    errorType: error?.name,
    details: formatted.data,
    stack: error?.stack,
  });
  ctx.status = formatted.status;
  ctx.body = {
    code: formatted.code,
    message: formatted.message,
    data: formatted.data,
  };
}

class MetricController {
  static async listMetrics(ctx) {
    try {
      const data = await metricService.listMetrics({
        codePrefix: ctx.query.codePrefix || ctx.query.code_prefix || ctx.query.scopeCode || ctx.query.scope_code,
        status: ctx.query.status,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
      });
      ctx.body = { code: 200, message: '获取指标列表成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getMetric(ctx) {
    try {
      const data = await metricService.getMetricById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取指标成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async createMetric(ctx) {
    try {
      const data = await metricService.createMetric(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建指标成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 400 });
    }
  }

  static async updateMetric(ctx) {
    try {
      const data = await metricService.updateMetric(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新指标成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 400 });
    }
  }

  static async deleteMetric(ctx) {
    try {
      const ok = await metricService.deleteMetric(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除指标成功', data: null };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async executeMetric(ctx) {
    try {
      const data = await metricExecutor.execute(ctx.params.id, { triggeredBy: 'manual' });
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '指标执行成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async executeBatch(ctx) {
    try {
      const { codePrefix, code_prefix, scopeCode, scope_code } = ctx.request.body || {};
      const data = await metricExecutor.executeBatch({
        codePrefix: codePrefix || code_prefix || scopeCode || scope_code,
        triggeredBy: 'manual',
      });
      ctx.body = { code: 200, message: '批量执行完成', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async listRuns(ctx) {
    try {
      const data = await metricService.listRuns(ctx.params.id, {
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
      });
      ctx.body = { code: 200, message: '获取执行记录成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async listValues(ctx) {
    try {
      const data = await metricService.listValues(ctx.params.id, {
        from: ctx.query.from,
        to: ctx.query.to,
        dimensionKey: ctx.query.dimensionKey || ctx.query.dimension_key,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 50,
      });
      ctx.body = { code: 200, message: '获取指标历史值成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getValue(ctx) {
    try {
      const refresh = ctx.query.refresh === '1' || ctx.query.refresh === 'true';
      const data = await metricExecutor.getLatestValue(ctx.params.id, { refresh });
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取指标最新值成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getDashboard(ctx) {
    try {
      const refresh = ctx.query.refresh === '1' || ctx.query.refresh === 'true';
      const data = await metricService.getDashboard({
        codePrefix: ctx.query.codePrefix || ctx.query.code_prefix || ctx.query.scopeCode || ctx.query.scope_code,
        domainCode: ctx.query.domainCode || ctx.query.domain_code,
        refresh,
      });
      ctx.body = { code: 200, message: '获取指标看板成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async listCards(ctx) {
    try {
      const data = await metricCardService.listCards({
        domainCode: ctx.query.domainCode || ctx.query.domain_code,
        status: ctx.query.status,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 50,
      });
      ctx.body = { code: 200, message: '获取指标卡片列表成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getCard(ctx) {
    try {
      const data = await metricCardService.getCardById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标卡片不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取指标卡片成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async createCard(ctx) {
    try {
      const data = await metricCardService.createCard(ctx.request.body || {});
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建指标卡片成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 400 });
    }
  }

  static async updateCard(ctx) {
    try {
      const data = await metricCardService.updateCard(ctx.params.id, ctx.request.body || {});
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标卡片不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新指标卡片成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 400 });
    }
  }

  static async deleteCard(ctx) {
    try {
      const ok = await metricCardService.deleteCard(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '指标卡片不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除指标卡片成功', data: null };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async suggestCard(ctx) {
    try {
      const metricId = ctx.query.metricId || ctx.query.metric_id || ctx.request.body?.metricId;
      const metricCode = ctx.query.metricCode || ctx.query.metric_code || ctx.request.body?.metricCode || ctx.request.body?.code;
      const data = await metricCardService.suggestCardFromMetric(metricId || metricCode);
      ctx.body = { code: 200, message: '建议指标卡片成功', data };
    } catch (error) {
      sendMetricError(ctx, error, { fallbackStatus: 400 });
    }
  }
}

module.exports = MetricController;
