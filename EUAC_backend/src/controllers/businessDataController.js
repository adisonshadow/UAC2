const businessDataService = require('../services/businessData/businessDataService');
const materializationService = require('../services/businessData/materializationService');
const logger = require('../utils/logger');

class BusinessDataController {
  static async getSchema(ctx) {
    try {
      const data = await businessDataService.getFullSchema();
      ctx.body = { code: 200, message: '获取业务数据模型成功', data };
    } catch (error) {
      logger.error('获取业务数据模型失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async listEntities(ctx) {
    try {
      const data = await businessDataService.listEntities({
        codePrefix: ctx.query.codePrefix,
        entityKind: ctx.query.entityKind,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 100
      });
      ctx.body = { code: 200, message: '获取实体列表成功', data };
    } catch (error) {
      logger.error('获取实体列表失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async getEntity(ctx) {
    try {
      const data = await businessDataService.getEntityById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '实体不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取实体成功', data };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async createEntity(ctx) {
    try {
      const data = await businessDataService.createEntity(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建实体成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async updateEntity(ctx) {
    try {
      const data = await businessDataService.updateEntity(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '实体不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新实体成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async deleteEntity(ctx) {
    try {
      const ok = await businessDataService.deleteEntity(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '实体不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除实体成功', data: null };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async upsertFields(ctx) {
    try {
      const data = await businessDataService.upsertEntityFields(ctx.params.id, ctx.request.body.fields || []);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '实体不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '保存字段成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async listEnums(ctx) {
    try {
      const data = await businessDataService.listEnums({
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 100
      });
      ctx.body = { code: 200, message: '获取枚举列表成功', data };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async createEnum(ctx) {
    try {
      const data = await businessDataService.createEnum(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建枚举成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async updateEnum(ctx) {
    try {
      const data = await businessDataService.updateEnum(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '枚举不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新枚举成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async deleteEnum(ctx) {
    try {
      const ok = await businessDataService.deleteEnum(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '枚举不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除枚举成功', data: null };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async listRelations(ctx) {
    try {
      const data = await businessDataService.listRelations();
      ctx.body = { code: 200, message: '获取关系列表成功', data };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async createRelation(ctx) {
    try {
      const data = await businessDataService.createRelation(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建关系成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async updateRelation(ctx) {
    try {
      const data = await businessDataService.updateRelation(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '关系不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新关系成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async deleteRelation(ctx) {
    try {
      const ok = await businessDataService.deleteRelation(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '关系不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除关系成功', data: null };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async previewMaterialization(ctx) {
    try {
      const { entityIds, targetSchema } = ctx.request.body;
      const data = await materializationService.buildPreview({ entityIds, targetSchema });
      ctx.body = { code: 200, message: '物化预览成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async executeMaterialization(ctx) {
    try {
      const { entityIds, targetSchema, dryRun, expectedVersions } = ctx.request.body;
      const data = await materializationService.executeMaterialization({
        entityIds,
        targetSchema,
        dryRun: !!dryRun,
        expectedVersions: expectedVersions || {},
        createdBy: ctx.state.user?.user_id
      });
      ctx.body = { code: 200, message: dryRun ? '物化预览已记录' : '物化执行成功', data };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { code: 400, message: error.message, data: null };
    }
  }

  static async getMaterializationStatus(ctx) {
    try {
      const data = await materializationService.getMaterializationStatus();
      ctx.body = { code: 200, message: '获取物化状态成功', data };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async listMaterializationRuns(ctx) {
    try {
      const data = await materializationService.listRuns({
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 10
      });
      ctx.body = { code: 200, message: '获取物化历史成功', data };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }

  static async getMaterializationRun(ctx) {
    try {
      const data = await materializationService.getRunById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '物化记录不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取物化记录成功', data };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { code: 500, message: error.message, data: null };
    }
  }
}

module.exports = BusinessDataController;
