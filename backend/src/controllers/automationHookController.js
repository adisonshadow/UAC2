const service = require('../services/automation/hookService');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error) {
  const formatted = formatApiError(error);
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class AutomationHookController {
  static async list(ctx) {
    try {
      const { status, eventType, page, size } = ctx.query;
      const result = await service.listHooks({
        status,
        eventType,
        page: parseInt(page) || 1,
        size: parseInt(size) || 20,
      });
      ctx.body = { code: 200, message: 'success', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async getById(ctx) {
    try {
      const hook = await service.getHookById(ctx.params.id, { includeRuns: true });
      if (!hook) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '钩子不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: 'success', data: hook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async create(ctx) {
    try {
      const hook = await service.createHook(ctx.request.body, ctx.state?.user);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建成功', data: hook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async update(ctx) {
    try {
      const hook = await service.updateHook(ctx.params.id, ctx.request.body, ctx.state?.user);
      ctx.body = { code: 200, message: '更新成功', data: hook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async remove(ctx) {
    try {
      const result = await service.deleteHook(ctx.params.id);
      ctx.body = { code: 200, message: '删除成功', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async enable(ctx) {
    try {
      const hook = await service.setHookStatus(ctx.params.id, 'enabled', ctx.state?.user);
      ctx.body = { code: 200, message: '已启用', data: hook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async disable(ctx) {
    try {
      const hook = await service.setHookStatus(ctx.params.id, 'disabled', ctx.state?.user);
      ctx.body = { code: 200, message: '已禁用', data: hook };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async test(ctx) {
    try {
      const body = ctx.request.body || {};
      const result = await service.testHook(ctx.params.id, {
        mockPayload: body.mockPayload,
        sourceRunId: body.sourceRunId,
      });
      ctx.body = { code: 200, message: '测试完成', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async listRuns(ctx) {
    try {
      const { status, triggerSource, page, size } = ctx.query;
      const result = await service.listRuns(ctx.params.id, {
        status,
        triggerSource,
        page: parseInt(page) || 1,
        size: parseInt(size) || 20,
      });
      ctx.body = { code: 200, message: 'success', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async retryRun(ctx) {
    try {
      const result = await service.retryRun(ctx.params.runId);
      ctx.body = { code: 200, message: '重放已执行', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async eventTypes(ctx) {
    try {
      ctx.body = { code: 200, message: 'success', data: service.getEventTypes() };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async validateScript(ctx) {
    try {
      const result = service.validateScript(ctx.request.body?.source);
      ctx.body = { code: 200, message: result.ok ? '检查通过' : '检查未通过', data: result };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = AutomationHookController;
