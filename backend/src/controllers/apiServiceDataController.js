const apiServiceInvokeService = require('../services/apiService/apiServiceInvokeService');
const { formatApiError } = require('../utils/formatApiError');
const logger = require('../utils/logger');

function sendError(ctx, error) {
  const formatted = formatApiError(error);
  logger.error(formatted.message, { errorType: error?.name, stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class ApiServiceDataController {
  static async invokeHttp(ctx) {
    try {
      const routePath = ctx.params.routePath;
      const data = await apiServiceInvokeService.invokePublished(routePath, ctx, 'http');
      ctx.body = { code: 200, message: '调用成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async streamSse(ctx) {
    try {
      const routePath = ctx.params.routePath;
      await apiServiceInvokeService.streamPublishedSse(routePath, ctx);
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = ApiServiceDataController;
