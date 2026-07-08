const dataStandardService = require('../services/businessData/dataStandardService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, fallbackStatus = 500) {
  const formatted = formatApiError(error, { fallbackStatus });
  logger.error(formatted.message, { stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class DataStandardController {
  static async list(ctx) {
    try {
      const data = await dataStandardService.listDataStandards({
        keyword: ctx.query.keyword,
        status: ctx.query.status,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
      });
      ctx.body = { code: 200, message: '获取数据标准列表成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async get(ctx) {
    try {
      const data = await dataStandardService.getDataStandardById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '数据标准不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取数据标准成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async create(ctx) {
    try {
      const data = await dataStandardService.createDataStandard(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建数据标准成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async update(ctx) {
    try {
      const data = await dataStandardService.updateDataStandard(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '数据标准不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新数据标准成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async delete(ctx) {
    try {
      const ok = await dataStandardService.deleteDataStandard(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '数据标准不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除数据标准成功', data: null };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }
}

module.exports = DataStandardController;
