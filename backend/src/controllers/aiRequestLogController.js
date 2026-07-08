const { ApiRequestLog } = require('../models');
const logger = require('../utils/logger');

function formatLog(log) {
  const data = log.toJSON ? log.toJSON() : log;
  return {
    id: data.id,
    traceId: data.trace_id,
    slug: data.slug,
    statusCode: data.status_code,
    durationMs: data.duration_ms,
    errorCode: data.error_code,
    createdAt: data.created_at
  };
}

class AiRequestLogController {
  static async list(ctx) {
    try {
      const page = Math.max(parseInt(ctx.query.page, 10) || 1, 1);
      const size = Math.min(Math.max(parseInt(ctx.query.size, 10) || 20, 1), 100);
      const where = {};

      if (ctx.query.slug) {
        where.slug = ctx.query.slug;
      }
      if (ctx.query.traceId) {
        where.trace_id = ctx.query.traceId;
      }

      const { count, rows } = await ApiRequestLog.findAndCountAll({
        where,
        limit: size,
        offset: (page - 1) * size,
        order: [['created_at', 'DESC']]
      });

      ctx.body = {
        code: 200,
        message: '获取 AI 请求日志成功',
        data: { total: count, items: rows.map(formatLog), page, size }
      };
    } catch (error) {
      logger.error('获取 AI 请求日志失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 AI 请求日志失败', data: null };
    }
  }

  static async getById(ctx) {
    try {
      const log = await ApiRequestLog.findByPk(ctx.params.id);
      if (!log) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '日志不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取日志详情成功', data: formatLog(log) };
    } catch (error) {
      logger.error('获取日志详情失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取日志详情失败', data: null };
    }
  }
}

module.exports = AiRequestLogController;
