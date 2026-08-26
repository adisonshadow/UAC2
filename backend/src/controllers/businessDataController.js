const businessDataService = require('../services/businessData/businessDataService');
const materializationService = require('../services/businessData/materializationService');
const materializedTableBrowseService = require('../services/businessData/materializedTableBrowseService');
const databaseConnectionService = require('../services/businessData/databaseConnectionService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendBizDataError(ctx, error, options = {}) {
  const formatted = formatApiError(error, options);
  logger.error(formatted.message, {
    errorType: error?.name,
    details: formatted.data,
    stack: error?.stack,
  });
  ctx.status = formatted.status;
  ctx.body = {
    code: formatted.code,
    message: formatted.message,
    data: formatted.data,
  };
}

class BusinessDataController {
  static async getSchema(ctx) {
    try {
      const data = await businessDataService.getFullSchema();
      ctx.body = { code: 200, message: '获取业务数据模型成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async listEntities(ctx) {
    try {
      const summary = ctx.query.summary === 'true' || ctx.query.summary === '1';
      const params = {
        codePrefix: ctx.query.codePrefix,
        entityKind: ctx.query.entityKind,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || (summary ? 500 : 100),
      };
      const data = summary
        ? await businessDataService.listEntitySummaries(params)
        : await businessDataService.listEntities(params);
      ctx.body = { code: 200, message: '获取实体列表成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
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
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async existsEntity(ctx) {
    try {
      const code = String(ctx.query.code || '').trim();
      if (!code) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '缺少 query 参数 code', data: null };
        return;
      }
      const data = await businessDataService.existsEntityByCode(code);
      ctx.body = { code: 200, message: '查询实体是否存在成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async existsEnum(ctx) {
    try {
      const code = String(ctx.query.code || '').trim();
      if (!code) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '缺少 query 参数 code', data: null };
        return;
      }
      const data = await businessDataService.existsEnumByCode(code);
      ctx.body = { code: 200, message: '查询枚举是否存在成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async existsScope(ctx) {
    try {
      const code = String(ctx.query.code || '').trim();
      if (!code) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '缺少 query 参数 code', data: null };
        return;
      }
      const data = await businessDataService.existsScopeByCode(code);
      ctx.body = { code: 200, message: '查询 Scope 是否存在成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async createEntity(ctx) {
    try {
      const data = await businessDataService.createEntity(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建实体成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { resourceLabel: '实体' });
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
      sendBizDataError(ctx, error);
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
      sendBizDataError(ctx, error);
    }
  }

  static async analyzeEntityDeletion(ctx) {
    try {
      const entityDeletionService = require('../services/businessData/entityDeletionService');
      const data = await entityDeletionService.analyzeEntityDeletion(ctx.params.id);
      ctx.body = { code: 200, message: '获取实体删除影响分析成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: error?.status === 404 ? 404 : 400 });
    }
  }

  static async executeEntityDeletion(ctx) {
    try {
      const entityDeletionService = require('../services/businessData/entityDeletionService');
      const body = ctx.request.body || {};
      const data = await entityDeletionService.executeEntityDeletion({
        deleteEntityIds: body.deleteEntityIds || [],
        dropPhysicalTables: !!body.dropPhysicalTables,
      });
      ctx.body = { code: 200, message: '实体级联删除成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
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
      sendBizDataError(ctx, error);
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
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async createEnum(ctx) {
    try {
      const data = await businessDataService.createEnum(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建枚举成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { resourceLabel: '枚举' });
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
      sendBizDataError(ctx, error);
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
      sendBizDataError(ctx, error);
    }
  }

  static async listRelations(ctx) {
    try {
      const data = await businessDataService.listRelations({
        entityId: ctx.query.entityId,
        entityCode: ctx.query.entityCode,
      });
      ctx.body = { code: 200, message: '获取关系列表成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async createRelation(ctx) {
    try {
      const data = await businessDataService.createRelation(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建关系成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
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
      sendBizDataError(ctx, error);
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
      sendBizDataError(ctx, error);
    }
  }

  static async previewMaterialization(ctx) {
    try {
      const { entityIds, targetSchema, connectionId } = ctx.request.body;
      const data = await materializationService.buildPreview({ entityIds, targetSchema, connectionId });
      ctx.body = { code: 200, message: '物化预览成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async executeMaterialization(ctx) {
    try {
      const { entityIds, targetSchema, connectionId, dryRun, expectedVersions, createTargetIfMissing } = ctx.request.body;
      const data = await materializationService.executeMaterialization({
        entityIds,
        targetSchema,
        connectionId,
        dryRun: !!dryRun,
        expectedVersions: expectedVersions || {},
        createTargetIfMissing: !!createTargetIfMissing,
        createdBy: ctx.state.user?.user_id
      });
      ctx.body = { code: 200, message: dryRun ? '物化预览已记录' : '物化执行成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async getMaterializationStatus(ctx) {
    try {
      const data = await materializationService.getMaterializationStatus({
        connectionId: ctx.query.connectionId
      });
      ctx.body = { code: 200, message: '获取物化状态成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async listMaterializationRuns(ctx) {
    try {
      const data = await materializationService.listRuns({
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 10,
        connectionId: ctx.query.connectionId
      });
      ctx.body = { code: 200, message: '获取物化历史成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
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
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getMaterializedTableSchema(ctx) {
    try {
      const data = await materializedTableBrowseService.getTableSchema({
        entityId: ctx.params.entityId,
        connectionId: ctx.query.connectionId,
      });
      ctx.body = { code: 200, message: '获取物化表结构成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async getMaterializedTableRows(ctx) {
    try {
      const data = await materializedTableBrowseService.queryTableRows({
        entityId: ctx.params.entityId,
        connectionId: ctx.query.connectionId,
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
      });
      ctx.body = { code: 200, message: '获取物化表数据成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async insertMaterializedMockData(ctx) {
    try {
      const { rows, rowCount } = ctx.request.body || {};
      const data = await materializedTableBrowseService.insertMockData({
        entityId: ctx.params.entityId,
        connectionId: ctx.query.connectionId || ctx.request.body?.connectionId,
        rows,
        rowCount,
      });
      ctx.body = { code: 200, message: 'MOCK 数据插入成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async listDatabaseConnections(ctx) {
    try {
      const data = await databaseConnectionService.listConnections();
      ctx.body = { code: 200, message: '获取数据库连接列表成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async createDatabaseConnection(ctx) {
    try {
      const data = await databaseConnectionService.createConnection(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建数据库连接成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async updateDatabaseConnection(ctx) {
    try {
      const data = await databaseConnectionService.updateConnection(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '数据库连接不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新数据库连接成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async deleteDatabaseConnection(ctx) {
    try {
      const ok = await databaseConnectionService.deleteConnection(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '数据库连接不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除数据库连接成功', data: null };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async testDatabaseConnection(ctx) {
    try {
      const data = await databaseConnectionService.testConnectionById(ctx.params.id);
      ctx.body = { code: 200, message: '连接测试成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async listScopes(ctx) {
    try {
      const data = await businessDataService.listScopes();
      ctx.body = { code: 200, message: '获取 Scope 列表成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async listScopeDocs(ctx) {
    try {
      const codesRaw = ctx.query.codes;
      let codes;
      if (typeof codesRaw === 'string' && codesRaw.trim()) {
        codes = codesRaw.split(',').map((c) => c.trim()).filter(Boolean);
      } else if (Array.isArray(codesRaw)) {
        codes = codesRaw.map(String).map((c) => c.trim()).filter(Boolean);
      }
      const data = await businessDataService.listScopeDocs({ codes });
      ctx.body = { code: 200, message: '获取 Scope 业务说明列表成功', data };
    } catch (error) {
      sendBizDataError(ctx, error, { fallbackStatus: 500 });
    }
  }

  static async getScopeDoc(ctx) {
    try {
      const code = ctx.query.code;
      if (!code || !String(code).trim()) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '缺少 query 参数 code' };
        return;
      }
      const includeAncestors =
        ctx.query.includeAncestors === '1'
        || ctx.query.includeAncestors === 'true'
        || ctx.query.includeAncestors === true;
      const data = includeAncestors
        ? await businessDataService.getScopeDocWithAncestors(code)
        : await businessDataService.getScopeDoc(code);
      ctx.body = { code: 200, message: '获取 Scope 业务说明成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }

  static async upsertScopeDoc(ctx) {
    try {
      const { code, contentMarkdown } = ctx.request.body || {};
      if (!code || !String(code).trim()) {
        ctx.status = 400;
        ctx.body = { code: 400, message: 'code 不能为空' };
        return;
      }
      const data = await businessDataService.upsertScopeDoc(code, contentMarkdown);
      ctx.body = { code: 200, message: '保存 Scope 业务说明成功', data };
    } catch (error) {
      sendBizDataError(ctx, error);
    }
  }
}

module.exports = BusinessDataController;
