const collectionIngestService = require('../services/collectionPipeline/collectionIngestService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, options = {}) {
  const formatted = formatApiError(error, options);
  logger.error(formatted.message, { errorType: error?.name, stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class CollectionIngestController {
  static async ingest(ctx) {
    try {
      const authContext = ctx.state.authContext;
      if (!authContext || authContext.kind !== 'application') {
        ctx.status = 401;
        ctx.body = { code: 401, message: '须使用业务系统 JWT 认证', data: null };
        return;
      }

      const routePath = decodeURIComponent(ctx.params.routePath || '');
      const rawBuffer = ctx.request.rawBody || Buffer.alloc(0);
      const contentType = ctx.headers['content-type'];

      const data = await collectionIngestService.ingestByRoutePath(routePath, {
        rawBuffer,
        contentType,
        applicationId: authContext.applicationId,
      });

      ctx.body = { code: 200, message: '数据采集成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = CollectionIngestController;
