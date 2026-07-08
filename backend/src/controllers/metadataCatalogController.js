const metadataCatalogService = require('../services/businessData/metadataCatalogService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, fallbackStatus = 500) {
  const formatted = formatApiError(error, { fallbackStatus });
  logger.error(formatted.message, { stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

class MetadataCatalogController {
  static async listTables(ctx) {
    try {
      const data = await metadataCatalogService.listMetadataTables({
        keyword: ctx.query.keyword,
        targetType: ctx.query.targetType || ctx.query.target_type,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 50,
      });
      ctx.body = { code: 200, message: '获取元数据表列表成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async getTable(ctx) {
    try {
      const data = await metadataCatalogService.getMetadataTableById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '元数据表不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取元数据表成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async getByTarget(ctx) {
    try {
      const targetType = ctx.query.targetType || ctx.query.target_type;
      const targetId = ctx.query.targetId || ctx.query.target_id;
      const fieldKey = ctx.query.fieldKey || ctx.query.field_key;
      if (!targetType || !targetId) {
        ctx.status = 400;
        ctx.body = { code: 400, message: 'targetType 与 targetId 不能为空', data: null };
        return;
      }
      const data = await metadataCatalogService.getMetadataByTarget(targetType, targetId, fieldKey);
      ctx.body = { code: 200, message: '获取元数据成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }

  static async upsertTable(ctx) {
    try {
      const data = await metadataCatalogService.upsertMetadataTable(ctx.request.body);
      ctx.body = { code: 200, message: '保存元数据表成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async updateTable(ctx) {
    try {
      const data = await metadataCatalogService.updateMetadataTable(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '元数据表不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新元数据表成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async updateFields(ctx) {
    try {
      const fields = ctx.request.body?.fields || [];
      const data = await metadataCatalogService.bulkUpdateMetadataFields(ctx.params.id, fields);
      ctx.body = { code: 200, message: '更新元数据字段成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async upsertField(ctx) {
    try {
      const data = await metadataCatalogService.upsertMetadataField(ctx.params.id, ctx.request.body);
      ctx.body = { code: 200, message: '保存元数据字段成功', data };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async deleteTable(ctx) {
    try {
      const ok = await metadataCatalogService.deleteMetadataTable(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '元数据表不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除元数据表成功', data: null };
    } catch (error) {
      sendError(ctx, error, 400);
    }
  }

  static async syncFromSchema(ctx) {
    try {
      const data = await metadataCatalogService.syncFromSchema();
      ctx.body = { code: 200, message: '同步元数据目录成功', data };
    } catch (error) {
      sendError(ctx, error);
    }
  }
}

module.exports = MetadataCatalogController;
