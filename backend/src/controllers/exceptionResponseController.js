const service = require('../services/apiService/exceptionResponseService');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error) {
  const formatted = formatApiError(error);
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class ExceptionResponseController {
  static async list(ctx) {
    try {
      const { isEnabled, page, size } = ctx.query;
      const result = await service.listExceptionResponses({
        isEnabled,
        page: parseInt(page) || 1,
        size: parseInt(size) || 100,
      });
      ctx.body = { code: 200, message: 'success', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async getById(ctx) {
    try {
      const row = await service.getExceptionResponseById(ctx.params.id);
      if (!row) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '异常响应不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: 'success', data: service.formatExceptionResponse(row) };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async create(ctx) {
    try {
      const row = await service.createExceptionResponse(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建成功', data: service.formatExceptionResponse(row) };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async update(ctx) {
    try {
      const row = await service.updateExceptionResponse(ctx.params.id, ctx.request.body);
      ctx.body = { code: 200, message: '更新成功', data: service.formatExceptionResponse(row) };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async remove(ctx) {
    try {
      const deleted = await service.deleteExceptionResponse(ctx.params.id);
      if (!deleted) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '异常响应不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除成功', data: null };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = ExceptionResponseController;
