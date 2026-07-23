const { Op } = require('sequelize');
const {
  BizdataCollectionPipeline,
  BizdataCollectionPipelineApplication,
  BizdataCollectionPipelineRun,
  BizdataEntity,
  BizdataDatabaseConnection,
  BizdataMaterializationEntity,
  BizdataMaterializationRun,
  sequelize,
} = require('../../models');
const businessDataService = require('../businessData/businessDataService');
const databaseConnectionService = require('../businessData/databaseConnectionService');
const { resolveEntityTableName } = require('../businessData/entityTableName');
const { resolveConnection } = require('../apiService/apiServiceConnectionResolveService');
const {
  validateCode,
  validateScopeCode,
  buildCodeFromScopeAndSlug,
  parseServiceSlugFromCode,
  codeToRoutePath,
} = require('../apiService/apiServiceDomainUtils');

const PROTOCOL_TYPES = ['serial', 'modbus_rtu', 'modbus_tcp'];
const INGEST_BASE = '/api/v1/ingest';

function resolvePayloadCode(payload) {
  if (payload.code) return validateCode(payload.code);
  const scopeCode = payload.scopeCode || payload.scope_code;
  const pipelineSlug = payload.pipelineSlug || payload.pipeline_slug || payload.serviceSlug || payload.service_slug;
  if (scopeCode && pipelineSlug) {
    return buildCodeFromScopeAndSlug(scopeCode, pipelineSlug);
  }
  throw Object.assign(new Error('请提供 code 或 scopeCode + pipelineSlug'), { status: 400 });
}

function resolveScopeCode(payload, code) {
  if (payload.scopeCode || payload.scope_code) {
    return validateScopeCode(payload.scopeCode || payload.scope_code);
  }
  if (code && code.includes(':')) {
    const parts = code.split(':');
    return parts.slice(0, -1).join(':');
  }
  return null;
}

function normalizeProtocolType(value) {
  const v = String(value || 'serial').trim();
  if (!PROTOCOL_TYPES.includes(v)) {
    throw Object.assign(new Error(`protocolType 须为 ${PROTOCOL_TYPES.join(' / ')}`), { status: 400 });
  }
  return v;
}

function formatPipeline(row, options = {}) {
  if (!row) return null;
  const data = row.toJSON ? row.toJSON() : row;
  const scopeCode = data.scope_code || (data.code?.includes(':')
    ? data.code.split(':').slice(0, -1).join(':')
    : null);

  const result = {
    id: data.id,
    code: data.code,
    routePath: data.route_path,
    name: data.name,
    description: data.description,
    status: data.status,
    protocolType: data.protocol_type,
    restrictSources: data.restrict_sources,
    sampleData: data.sample_data,
    targetStructure: data.target_structure,
    parseScript: data.parse_script,
    storeScript: data.store_script,
    entityId: data.entity_id,
    entityCode: data.entity_code,
    connectionId: data.connection_id,
    tableName: data.table_name,
    targetSchema: data.target_schema,
    basePath: data.base_path || `${INGEST_BASE}/${data.route_path}`,
    version: data.version,
    publishedAt: data.published_at,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    scopeCode,
    entity: data.entity
      ? { id: data.entity.id, code: data.entity.code, label: data.entity.label }
      : undefined,
    connection: data.connection
      ? { id: data.connection.id, name: data.connection.name, dbType: data.connection.db_type }
      : undefined,
  };

  if (scopeCode && result.code) {
    result.pipelineSlug = parseServiceSlugFromCode(result.code, scopeCode);
  }

  if (options.includeApplications && data.applications) {
    result.applicationIds = data.applications.map((a) => a.application_id);
  }

  return result;
}

async function assertEntityMaterialized(entityId, connectionId) {
  const mat = await BizdataMaterializationEntity.findOne({
    where: { entity_id: entityId, ddl_applied: true },
    include: [{
      model: BizdataMaterializationRun,
      as: 'run',
      required: true,
      where: { connection_id: connectionId, status: 'success' },
    }],
    order: [['created_at', 'DESC']],
  });

  if (!mat) {
    throw Object.assign(
      new Error('所选实体在该数据库连接下尚未成功物化，请先在「执行物化」中完成物化'),
      { status: 409 },
    );
  }
  return mat;
}

async function syncApplications(pipelineId, applicationIds, restrictSources, transaction) {
  await BizdataCollectionPipelineApplication.destroy({
    where: { pipeline_id: pipelineId },
    transaction,
  });

  if (!restrictSources || !applicationIds?.length) return;

  const rows = applicationIds.map((applicationId) => ({
    pipeline_id: pipelineId,
    application_id: applicationId,
  }));
  await BizdataCollectionPipelineApplication.bulkCreate(rows, { transaction });
}

async function listPipelines({
  codePrefix,
  status,
  protocolType,
  page = 1,
  size = 20,
} = {}) {
  const where = { status: { [Op.ne]: 'deleted' } };
  if (status) where.status = status;
  if (protocolType) where.protocol_type = protocolType;
  if (codePrefix) {
    where[Op.or] = [
      { code: { [Op.iLike]: `${codePrefix}%` } },
      { code: { [Op.iLike]: `${codePrefix}:%` } },
    ];
  }

  const limit = size === -1 ? undefined : Math.min(Math.max(Number(size) || 20, 1), 200);
  const offset = limit ? (Math.max(Number(page) || 1, 1) - 1) * limit : undefined;

  const { rows, count } = await BizdataCollectionPipeline.findAndCountAll({
    where,
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
    ],
    order: [['updated_at', 'DESC']],
    limit,
    offset,
  });

  return {
    items: rows.map((r) => formatPipeline(r)),
    total: count,
    page: Number(page) || 1,
    size: limit ?? count,
  };
}

async function getPipelineById(id, options = {}) {
  const row = await BizdataCollectionPipeline.findByPk(id, {
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
      ...(options.includeApplications
        ? [{ model: BizdataCollectionPipelineApplication, as: 'applications', required: false }]
        : []),
    ],
  });
  return formatPipeline(row, options);
}

async function getPipelineByRoutePath(routePath, options = {}) {
  const row = await BizdataCollectionPipeline.findOne({
    where: { route_path: routePath, status: { [Op.ne]: 'deleted' } },
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
      ...(options.includeApplications
        ? [{ model: BizdataCollectionPipelineApplication, as: 'applications', required: false }]
        : []),
    ],
  });
  return formatPipeline(row, options);
}

async function createPipeline(payload, createdBy) {
  const code = resolvePayloadCode(payload);
  const routePath = codeToRoutePath(code);
  const scopeCode = resolveScopeCode(payload, code);
  const entityId = payload.entityId || payload.entity_id || null;
  let connectionId = payload.connectionId || payload.connection_id || null;

  if (!connectionId) {
    const resolved = await resolveConnection({
      scopeCode,
      entityId,
      entityCodes: payload.entityCodes || payload.entity_codes,
    });
    connectionId = resolved.connectionId;
  }

  const connRow = await databaseConnectionService.resolveConnectionRecord(connectionId);
  const targetSchema = payload.targetSchema
    || payload.target_schema
    || connRow.target_schema
    || await businessDataService.getDefaultMaterializationSchema();

  let entityCode = null;
  let tableName = null;

  if (entityId) {
    const entity = await BizdataEntity.findByPk(entityId);
    if (!entity || entity.entity_kind !== 'er_table') {
      throw Object.assign(new Error('绑定实体须为 ER 表类型'), { status: 400 });
    }
    await assertEntityMaterialized(entityId, connectionId);
    entityCode = entity.code;
    tableName = resolveEntityTableName(entity.code, entity.table_name);
  }

  const existing = await BizdataCollectionPipeline.findOne({ where: { code } });
  if (existing) {
    throw Object.assign(new Error(`code "${code}" 已存在`), { status: 409 });
  }

  const restrictSources = Boolean(payload.restrictSources ?? payload.restrict_sources);
  const applicationIds = Array.isArray(payload.applicationIds || payload.application_ids)
    ? (payload.applicationIds || payload.application_ids)
    : [];

  return sequelize.transaction(async (transaction) => {
    const pipeline = await BizdataCollectionPipeline.create({
      code,
      route_path: routePath,
      name: String(payload.name || '').trim() || code.split(':').pop(),
      description: payload.description || null,
      status: 'draft',
      protocol_type: normalizeProtocolType(payload.protocolType || payload.protocol_type),
      restrict_sources: restrictSources,
      sample_data: payload.sampleData || payload.sample_data || null,
      target_structure: payload.targetStructure || payload.target_structure || null,
      parse_script: payload.parseScript || payload.parse_script || null,
      store_script: payload.storeScript || payload.store_script || null,
      entity_id: entityId,
      entity_code: entityCode,
      connection_id: connectionId,
      table_name: tableName,
      target_schema: targetSchema,
      base_path: `${INGEST_BASE}/${routePath}`,
      created_by: createdBy || null,
    }, { transaction });

    await syncApplications(pipeline.id, applicationIds, restrictSources, transaction);
    return getPipelineById(pipeline.id, { includeApplications: true });
  });
}

async function updatePipeline(id, payload) {
  const pipeline = await BizdataCollectionPipeline.findByPk(id);
  if (!pipeline || pipeline.status === 'deleted') return null;

  const updates = {};
  if (payload.name !== undefined) updates.name = String(payload.name || '').trim();
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.protocolType !== undefined || payload.protocol_type !== undefined) {
    updates.protocol_type = normalizeProtocolType(payload.protocolType || payload.protocol_type);
  }
  if (payload.sampleData !== undefined || payload.sample_data !== undefined) {
    updates.sample_data = payload.sampleData ?? payload.sample_data;
  }
  if (payload.targetStructure !== undefined || payload.target_structure !== undefined) {
    updates.target_structure = payload.targetStructure ?? payload.target_structure;
  }
  if (payload.parseScript !== undefined || payload.parse_script !== undefined) {
    updates.parse_script = payload.parseScript ?? payload.parse_script;
  }
  if (payload.storeScript !== undefined || payload.store_script !== undefined) {
    updates.store_script = payload.storeScript ?? payload.store_script;
  }

  // 允许修改 Scope / 管道短名 → 同步 code、route_path、base_path
  const wantsCodeChange = Boolean(
    payload.code
    || payload.scopeCode || payload.scope_code
    || payload.pipelineSlug || payload.pipeline_slug
    || payload.serviceSlug || payload.service_slug,
  );
  if (wantsCodeChange) {
    let nextCode;
    try {
      if (payload.code) {
        nextCode = validateCode(payload.code);
      } else {
        const scopeCode = payload.scopeCode || payload.scope_code
          || resolveScopeCode({}, pipeline.code);
        const pipelineSlug = payload.pipelineSlug || payload.pipeline_slug
          || payload.serviceSlug || payload.service_slug
          || parseServiceSlugFromCode(pipeline.code, scopeCode);
        if (!scopeCode || !pipelineSlug) {
          throw Object.assign(new Error('修改编码须提供 scopeCode 与 pipelineSlug'), { status: 400 });
        }
        nextCode = buildCodeFromScopeAndSlug(scopeCode, pipelineSlug);
      }
    } catch (err) {
      if (err.status) throw err;
      throw Object.assign(new Error(err.message || '编码无效'), { status: 400 });
    }

    if (nextCode !== pipeline.code) {
      const dupCode = await BizdataCollectionPipeline.findOne({
        where: { code: nextCode, id: { [Op.ne]: id }, status: { [Op.ne]: 'deleted' } },
      });
      if (dupCode) {
        throw Object.assign(new Error(`code "${nextCode}" 已存在`), { status: 409 });
      }
      const nextRoute = codeToRoutePath(nextCode);
      const dupRoute = await BizdataCollectionPipeline.findOne({
        where: { route_path: nextRoute, id: { [Op.ne]: id }, status: { [Op.ne]: 'deleted' } },
      });
      if (dupRoute) {
        throw Object.assign(new Error(`routePath "${nextRoute}" 已存在`), { status: 409 });
      }
      updates.code = nextCode;
      updates.route_path = nextRoute;
      updates.base_path = `${INGEST_BASE}/${nextRoute}`;
    }
  }

  const entityId = payload.entityId ?? payload.entity_id;
  if (entityId !== undefined) {
    if (entityId) {
      const entity = await BizdataEntity.findByPk(entityId);
      if (!entity || entity.entity_kind !== 'er_table') {
        throw Object.assign(new Error('绑定实体须为 ER 表类型'), { status: 400 });
      }
      const connectionId = payload.connectionId || payload.connection_id || pipeline.connection_id;
      await assertEntityMaterialized(entityId, connectionId);
      updates.entity_id = entityId;
      updates.entity_code = entity.code;
      updates.table_name = resolveEntityTableName(entity.code, entity.table_name);
    } else {
      updates.entity_id = null;
      updates.entity_code = null;
      updates.table_name = null;
    }
  }

  if (payload.connectionId || payload.connection_id) {
    updates.connection_id = payload.connectionId || payload.connection_id;
  }

  const restrictSources = payload.restrictSources ?? payload.restrict_sources;
  const applicationIds = payload.applicationIds ?? payload.application_ids;

  return sequelize.transaction(async (transaction) => {
    if (Object.keys(updates).length) {
      await pipeline.update(updates, { transaction });
    }
    if (restrictSources !== undefined || applicationIds !== undefined) {
      const rs = restrictSources !== undefined ? Boolean(restrictSources) : pipeline.restrict_sources;
      if (restrictSources !== undefined) {
        await pipeline.update({ restrict_sources: rs }, { transaction });
      }
      await syncApplications(
        pipeline.id,
        applicationIds || [],
        rs,
        transaction,
      );
    }
    return getPipelineById(id, { includeApplications: true });
  });
}

async function setPipelineStatus(id, status) {
  const pipeline = await BizdataCollectionPipeline.findByPk(id);
  if (!pipeline || pipeline.status === 'deleted') return null;

  if (status === 'published') {
    if (!pipeline.parse_script?.trim()) {
      throw Object.assign(new Error('发布前须配置解析脚本'), { status: 400 });
    }
    if (!pipeline.store_script?.trim()) {
      throw Object.assign(new Error('发布前须配置存储脚本'), { status: 400 });
    }
    if (!pipeline.entity_id) {
      throw Object.assign(new Error('发布前须绑定目标实体'), { status: 400 });
    }
    await assertEntityMaterialized(pipeline.entity_id, pipeline.connection_id);
  }

  const updates = { status };
  if (status === 'published') {
    updates.published_at = new Date();
    updates.version = (pipeline.version || 0) + 1;
  }

  await pipeline.update(updates);
  return getPipelineById(id, { includeApplications: true });
}

async function deletePipeline(id) {
  const pipeline = await BizdataCollectionPipeline.findByPk(id);
  if (!pipeline) return false;
  await pipeline.update({ status: 'deleted' });
  return true;
}

async function listRuns(pipelineId, { page = 1, size = 20 } = {}) {
  const limit = Math.min(Math.max(Number(size) || 20, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const { rows, count } = await BizdataCollectionPipelineRun.findAndCountAll({
    where: { pipeline_id: pipelineId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    items: rows.map((r) => {
      const data = r.toJSON();
      return {
        id: data.id,
        pipelineId: data.pipeline_id,
        runType: data.run_type,
        inputRaw: data.input_raw,
        parseOutput: data.parse_output,
        storeOutput: data.store_output,
        status: data.status,
        errorMessage: data.error_message,
        durationMs: data.duration_ms,
        executedBy: data.executed_by,
        sourceApplicationId: data.source_application_id,
        createdAt: data.created_at,
      };
    }),
    total: count,
    page: Number(page) || 1,
    size: limit,
  };
}

async function assertApplicationAllowed(pipeline, applicationId) {
  if (!pipeline.restrictSources) return;
  const allowed = pipeline.applicationIds || [];
  if (!allowed.length) return;
  if (!allowed.includes(applicationId)) {
    throw Object.assign(new Error('当前业务系统无权向该采集管道提交数据'), { status: 403 });
  }
}

module.exports = {
  INGEST_BASE,
  listPipelines,
  getPipelineById,
  getPipelineByRoutePath,
  createPipeline,
  updatePipeline,
  setPipelineStatus,
  deletePipeline,
  listRuns,
  assertEntityMaterialized,
  assertApplicationAllowed,
};
