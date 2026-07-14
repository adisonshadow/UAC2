const apiServiceService = require('../services/apiService/apiServiceService');
const apiServiceExecutionService = require('../services/apiService/apiServiceExecutionService');
const apiServiceTestProfileService = require('../services/apiService/apiServiceTestProfileService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, options = {}) {
  const formatted = formatApiError(error, options);
  logger.error(formatted.message, { errorType: error?.name, stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class ApiServiceController {
  static async list(ctx) {
    try {
      const rawSize = ctx.query.size;
      const parsedSize = Number.parseInt(String(rawSize ?? ''), 10);
      const size =
        rawSize === '-1' || rawSize === -1 || parsedSize === -1
          ? -1
          : Number.isFinite(parsedSize) && parsedSize > 0
            ? parsedSize
            : 100;

      const data = await apiServiceService.listServices({
        codePrefix: ctx.query.codePrefix,
        status: ctx.query.status,
        tag: ctx.query.tag,
        entityId: ctx.query.entityId,
        connectionId: ctx.query.connectionId,
        page: parseInt(ctx.query.page, 10) || 1,
        size,
      });
      ctx.body = { code: 200, message: '获取 API 服务列表成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async tree(ctx) {
    try {
      const data = await apiServiceService.getServiceTree({ codePrefix: ctx.query.codePrefix });
      ctx.body = { code: 200, message: '获取 API 服务域树成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async operationCatalog(ctx) {
    try {
      ctx.body = {
        code: 200,
        message: '获取 operation 目录成功',
        data: apiServiceService.getOperationCatalog(),
      };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getById(ctx) {
    try {
      const data = await apiServiceService.getServiceById(ctx.params.id, {
        includeOperations: true,
        includePermissions: true,
      });
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getByCode(ctx) {
    try {
      const code = decodeURIComponent(ctx.params.code || '');
      const data = await apiServiceService.getServiceByCode(code, { includeOperations: true });
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async resolveConnection(ctx) {
    try {
      const body = ctx.request.body || {};
      const data = await apiServiceService.resolveConnection({
        connectionId: body.connectionId || body.connection_id,
        scopeCode: body.scopeCode || body.scope_code,
        entityId: body.entityId || body.entity_id,
        entityCodes: body.entityCodes || body.entity_codes,
      });
      ctx.body = { code: 200, message: '推断数据库连接成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async create(ctx) {
    try {
      const createdBy = ctx.state.user?.user_id || ctx.state.user?.userId || null;
      const data = await apiServiceService.createService(ctx.request.body, createdBy);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error, { resourceLabel: 'API 服务' });
    }
  }

  static async update(ctx) {
    try {
      const data = await apiServiceService.updateService(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async publish(ctx) {
    try {
      const data = await apiServiceService.setServiceStatus(ctx.params.id, 'published');
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '发布 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async disable(ctx) {
    try {
      const data = await apiServiceService.setServiceStatus(ctx.params.id, 'disabled');
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '禁用 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async enable(ctx) {
    try {
      const data = await apiServiceService.setServiceStatus(ctx.params.id, 'published');
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '启用 API 服务成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async remove(ctx) {
    try {
      const ok = await apiServiceService.deleteService(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除 API 服务成功', data: null };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async test(ctx) {
    try {
      const body = ctx.request.body || {};
      const data = await apiServiceExecutionService.testService(ctx.params.id, body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }

      const operation = data.operation || body.operation;
      const parameters = body.parameters;
      if (
        data.executable !== false
        && operation
        && parameters
        && typeof parameters === 'object'
        && !Array.isArray(parameters)
      ) {
        await apiServiceTestProfileService.saveTestMockParameters(ctx.params.id, operation, parameters);
        data.mockParametersSaved = true;
        data.savedMockParameters = parameters;
      }

      ctx.body = { code: 200, message: '测试请求成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async testProfile(ctx) {
    try {
      const data = await apiServiceTestProfileService.getTestProfile(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取测试上下文成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async suggestTestParams(ctx) {
    try {
      const data = await apiServiceTestProfileService.suggestTestParams(ctx.params.id, ctx.request.body || {});
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '生成模拟参数成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async saveTestMockParams(ctx) {
    try {
      const { operation, mockParameters, parameters } = ctx.request.body || {};
      const resolved = mockParameters || parameters;
      const data = await apiServiceTestProfileService.saveTestMockParameters(
        ctx.params.id,
        operation,
        resolved,
      );
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'API 服务不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '保存模拟参数成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = ApiServiceController;
