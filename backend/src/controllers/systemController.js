const systemService = require('../services/system/systemService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, fallbackStatus = 500) {
  const formatted = formatApiError(error, { fallbackStatus });
  logger.error(formatted.message, { stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class SystemController {
  static async getFeatures(ctx) {
    try {
      const data = await systemService.getSystemFeatures();
      ctx.body = { code: 200, message: '获取系统功能开关成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async updateFeatures(ctx) {
    try {
      const data = await systemService.updateSystemFeatures(ctx.request.body || {});
      ctx.body = { code: 200, message: '更新系统功能开关成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async listBackups(ctx) {
    try {
      const data = await systemService.listBackups();
      ctx.body = { code: 200, message: '获取备份列表成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async runBackup(ctx) {
    try {
      const data = await systemService.runBackup();
      ctx.body = { code: 200, message: '备份任务已执行', data };
    } catch (error) {
      sendError(ctx, error, 500);
    }
  }
}

module.exports = SystemController;
