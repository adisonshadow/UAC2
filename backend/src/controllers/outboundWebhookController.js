const service = require('../services/outboundWebhook/outboundWebhookService');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error) {
  const formatted = formatApiError(error);
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class OutboundWebhookController {
  static async list(ctx) {
    try {
      const { codePrefix, status, page, size } = ctx.query;
      const result = await service.listWebhooks({
        codePrefix, status,
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
      const row = await service.getWebhookById(ctx.params.id, { includeRuns: true });
      if (!row) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Webhook 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: 'success', data: service.formatWebhook(row) };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async create(ctx) {
    try {
      const webhook = await service.createWebhook(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建成功', data: webhook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async update(ctx) {
    try {
      const webhook = await service.updateWebhook(ctx.params.id, ctx.request.body);
      ctx.body = { code: 200, message: '更新成功', data: webhook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async publish(ctx) {
    try {
      const webhook = await service.setWebhookStatus(ctx.params.id, 'published');
      ctx.status = 200;
      ctx.body = { code: 200, message: '发布成功', data: webhook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async disable(ctx) {
    try {
      const webhook = await service.setWebhookStatus(ctx.params.id, 'disabled');
      ctx.status = 200;
      ctx.body = { code: 200, message: '已禁用', data: webhook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async remove(ctx) {
    try {
      await service.deleteWebhook(ctx.params.id);
      ctx.body = { code: 200, message: '已删除', data: null };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async getTestProfile(ctx) {
    try {
      const profile = await service.getTestProfile(ctx.params.id);
      ctx.body = { code: 200, message: 'success', data: profile };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async test(ctx) {
    try {
      const { mockData, mock_data } = ctx.request.body || {};
      const result = await service.testWebhook(ctx.params.id, {
        mockData: mockData ?? mock_data,
      });
      ctx.body = { code: 200, message: '测试完成', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async listRuns(ctx) {
    try {
      const { page, size } = ctx.query;
      const result = await service.listRuns(ctx.params.id, {
        page: parseInt(page) || 1,
        size: parseInt(size) || 20,
      });
      ctx.body = { code: 200, message: 'success', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = OutboundWebhookController;
