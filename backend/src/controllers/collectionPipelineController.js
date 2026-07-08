const collectionPipelineService = require('../services/collectionPipeline/collectionPipelineService');
const collectionPipelineExecutionService = require('../services/collectionPipeline/collectionPipelineExecutionService');
const collectionPipelineTestProfileService = require('../services/collectionPipeline/collectionPipelineTestProfileService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, options = {}) {
  const formatted = formatApiError(error, options);
  logger.error(formatted.message, { errorType: error?.name, stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class CollectionPipelineController {
  static async list(ctx) {
    try {
      const data = await collectionPipelineService.listPipelines({
        codePrefix: ctx.query.codePrefix,
        status: ctx.query.status,
        protocolType: ctx.query.protocolType,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 100,
      });
      ctx.body = { code: 200, message: '获取采集管道列表成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getById(ctx) {
    try {
      const data = await collectionPipelineService.getPipelineById(ctx.params.id, {
        includeApplications: true,
      });
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取采集管道成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async create(ctx) {
    try {
      const data = await collectionPipelineService.createPipeline(
        ctx.request.body || {},
        ctx.state.user?.user_id,
      );
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建采集管道成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async update(ctx) {
    try {
      const data = await collectionPipelineService.updatePipeline(ctx.params.id, ctx.request.body || {});
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新采集管道成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async publish(ctx) {
    try {
      const data = await collectionPipelineService.setPipelineStatus(ctx.params.id, 'published');
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '发布采集管道成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async disable(ctx) {
    try {
      const data = await collectionPipelineService.setPipelineStatus(ctx.params.id, 'disabled');
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '禁用采集管道成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async remove(ctx) {
    try {
      const ok = await collectionPipelineService.deletePipeline(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除采集管道成功', data: null };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async listRuns(ctx) {
    try {
      const data = await collectionPipelineService.listRuns(ctx.params.id, {
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
      });
      ctx.body = { code: 200, message: '获取运行记录成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getTestProfile(ctx) {
    try {
      const data = await collectionPipelineTestProfileService.getTestProfile(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取测试配置成功', data };
    } catch (error) {
      sendError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async test(ctx) {
    try {
      const body = ctx.request.body || {};
      const data = await collectionPipelineExecutionService.testPipeline(ctx.params.id, {
        rawInput: body.rawInput ?? body.raw_input ?? body.sampleData ?? body.sample_data,
        runType: body.runType || body.run_type || 'test',
        executedBy: ctx.state.user?.user_id,
      });
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '采集管道不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '采集管道测试成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = CollectionPipelineController;
