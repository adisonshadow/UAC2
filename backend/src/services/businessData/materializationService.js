const { Op } = require('sequelize');
const {
  BizdataEntity,
  BizdataEntityField,
  BizdataMaterializationRun,
  BizdataMaterializationEntity,
  BizdataDatabaseConnection,
  sequelize
} = require('../../models');
const businessDataService = require('./businessDataService');
const databaseConnectionService = require('./databaseConnectionService');
const { resolveEntityTableName } = require('./entityTableName');
const { getDialect } = require('./materialization/dialects');
const { checkTargetExists, ensureTarget, executeSql } = require('./materialization/connectionRunner');
const { MaterializationTargetNotFoundError } = require('./materialization/targetError');

function generateEntityTsCode(entity) {
  const className = resolveEntityTableName(entity.code, entity.tableName || entity.table_name)
    .replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())
    .replace(/_/g, '');
  const tableName = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
  const fields = entity.fields || [];

  const fieldLines = fields.map((f) => {
    const key = f.fieldKey || f.field_key;
    const label = f.columnInfo?.label || key;
    const cfg = f.typeormConfig || {};
    const tsType = cfg.type === 'int' || cfg.type === 'integer' ? 'number'
      : cfg.type === 'boolean' ? 'boolean' : 'string';
    return `  /** ${label} */\n  ${key}!: ${tsType};`;
  }).join('\n\n');

  return `import 'reflect-metadata';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { EntityInfo, ColumnInfo } from 'adb-typeorm';

@Entity('${tableName}')
@EntityInfo({
  id: '${entity.id}',
  code: '${entity.code}',
  label: '${entity.label}',
  description: '${entity.entityInfo?.description || entity.label}'
})
export class ${className} {
${fieldLines || '  @PrimaryGeneratedColumn(\'uuid\')\n  id!: string;'}
}
`;
}

async function loadErEntities(entityIds) {
  const where = { entity_kind: 'er_table' };
  if (entityIds?.length) {
    const ids = entityIds.filter(
      (id) =>
        typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    );
    if (!ids.length) return [];
    where.id = { [Op.in]: ids };
  }

  const entities = await BizdataEntity.findAll({
    where,
    include: [{ model: BizdataEntityField, as: 'fields', required: false }],
    order: [['code', 'ASC']]
  });

  return entities.map((e) => businessDataService.formatEntity(e));
}

async function resolveContext({ connectionId, targetSchema }) {
  const connRow = await databaseConnectionService.resolveConnectionRecord(connectionId);
  const runtime = databaseConnectionService.buildRuntimeConfig(connRow);
  const schema = targetSchema || connRow.target_schema || await businessDataService.getDefaultMaterializationSchema();
  const dialect = getDialect(runtime.dbType);
  return { connRow, runtime, schema, dialect };
}

async function buildPreview({ entityIds, targetSchema, connectionId }) {
  const { runtime, schema, dialect } = await resolveContext({ connectionId, targetSchema });
  const entities = await loadErEntities(entityIds);
  const generatedCode = {};

  entities.forEach((entity) => {
    generatedCode[entity.id] = generateEntityTsCode(entity);
  });

  return {
    connectionId: runtime.id,
    connectionName: runtime.name,
    dbType: runtime.dbType,
    targetSchema: schema,
    entities: entities.map((e) => ({ id: e.id, code: e.code, version: e.version, tableName: e.tableName })),
    sql: dialect.buildPreviewSql(entities, schema),
    generatedCode
  };
}

async function getMaterializationStatus({ connectionId, entityCodes, entityIds } = {}) {
  const codeFilter = normalizeStringList(entityCodes);
  const idFilter = normalizeStringList(entityIds);

  const entityWhere = { entity_kind: 'er_table' };
  if (codeFilter.length) {
    entityWhere.code = { [Op.in]: codeFilter };
  }
  if (idFilter.length) {
    entityWhere.id = { [Op.in]: idFilter };
  }

  const entities = await BizdataEntity.findAll({
    where: entityWhere,
    order: [['code', 'ASC']]
  });

  const runWhere = { status: 'success' };
  if (connectionId) {
    runWhere.connection_id = connectionId;
  }

  const successRuns = await BizdataMaterializationRun.findAll({
    where: runWhere,
    include: [{
      model: BizdataDatabaseConnection,
      as: 'connection',
      required: false
    }],
    order: [['created_at', 'DESC']]
  });

  const runIds = successRuns.map((r) => r.id);
  const matEntityWhere = { ddl_applied: true, run_id: { [Op.in]: runIds } };
  if (entities.length && (codeFilter.length || idFilter.length)) {
    matEntityWhere.entity_id = { [Op.in]: entities.map((e) => e.id) };
  }
  const matRecords = runIds.length
    ? await BizdataMaterializationEntity.findAll({
      where: matEntityWhere,
      include: [{
        model: BizdataMaterializationRun,
        as: 'run',
        required: true,
        include: [{ model: BizdataDatabaseConnection, as: 'connection', required: false }]
      }],
      order: [['created_at', 'DESC']]
    })
    : [];

  const latestByKey = new Map();
  matRecords.forEach((rec) => {
    const connId = rec.run?.connection_id || 'default';
    const key = `${rec.entity_id}:${connId}`;
    if (!latestByKey.has(key)) {
      latestByKey.set(key, rec);
    }
  });

  if (!connectionId) {
    const connections = await BizdataDatabaseConnection.findAll();
    const results = [];
    for (const conn of connections) {
      for (const entity of entities) {
        const key = `${entity.id}:${conn.id}`;
        const latest = latestByKey.get(key);
        results.push(formatStatusItem(entity, latest, conn));
      }
    }
    return results;
  }

  const conn = await BizdataDatabaseConnection.findByPk(connectionId);
  return entities.map((entity) => {
    const key = `${entity.id}:${connectionId}`;
    const latest = latestByKey.get(key);
    return formatStatusItem(entity, latest, conn);
  });
}

function normalizeStringList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function formatStatusItem(entity, latest, conn) {
  const materializedVersion = latest ? latest.entity_version : null;
  const currentVersion = entity.version;
  let staleStatus = 'not_materialized';
  if (materializedVersion != null) {
    staleStatus = currentVersion > materializedVersion ? 'stale' : 'latest';
  }
  return {
    entityId: entity.id,
    code: entity.code,
    entityCode: entity.code,
    label: entity.label,
    tableName: entity.table_name,
    currentVersion,
    materializedVersion,
    isStale: staleStatus === 'stale',
    staleStatus,
    lastMaterializedAt: latest?.created_at || null,
    connectionId: conn?.id || latest?.run?.connection_id || null,
    connectionName: conn?.name || latest?.run?.connection?.name || null,
    dbType: conn?.db_type || latest?.run?.connection?.db_type || null,
    targetSchema: latest?.run?.target_schema || null
  };
}

async function executeMaterialization({
  entityIds,
  targetSchema,
  connectionId,
  dryRun = false,
  expectedVersions = {},
  createTargetIfMissing = false,
  createdBy
}) {
  const preview = await buildPreview({ entityIds, targetSchema, connectionId });
  const { runtime, dialect } = await resolveContext({ connectionId, targetSchema: preview.targetSchema });

  if (Object.keys(expectedVersions).length) {
    for (const ent of preview.entities) {
      const expected = expectedVersions[ent.id];
      if (expected != null && expected !== ent.version) {
        throw new Error(`实体 ${ent.code} 版本冲突：期望 v${expected}，当前 v${ent.version}`);
      }
    }
  }

  if (!dryRun) {
    const targetExists = await checkTargetExists(runtime, preview.targetSchema);
    if (!targetExists && !createTargetIfMissing) {
      throw new MaterializationTargetNotFoundError({
        targetSchema: preview.targetSchema,
        dbType: runtime.dbType,
        connectionId: preview.connectionId
      });
    }
    if (!targetExists && createTargetIfMissing) {
      await ensureTarget(runtime, preview.targetSchema);
    }
  }

  const run = await BizdataMaterializationRun.create({
    connection_id: preview.connectionId,
    target_schema: preview.targetSchema,
    status: dryRun ? 'preview' : 'running',
    sql_preview: preview.sql,
    generated_code: preview.generatedCode,
    created_by: createdBy || null
  });

  if (dryRun) {
    return { run: await formatRunWithConnection(run), preview, executed: false };
  }

  try {
    const fullEntities = await loadErEntities(
      entityIds?.length ? entityIds : preview.entities.map((e) => e.id)
    );
    await executeSql(runtime, preview.sql, dialect, {
      entities: fullEntities,
      targetSchema: preview.targetSchema
    });

    const entityRows = await BizdataEntity.findAll({
      where: { id: { [Op.in]: preview.entities.map((e) => e.id) } }
    });
    const versionMap = new Map(entityRows.map((e) => [e.id, e.version]));

    await BizdataMaterializationEntity.bulkCreate(
      preview.entities.map((e) => ({
        run_id: run.id,
        entity_id: e.id,
        entity_version: versionMap.get(e.id) ?? e.version,
        table_name: e.tableName,
        ddl_applied: true
      }))
    );

    await run.update({
      status: 'success',
      executed_at: new Date()
    });

    const fullRun = await getRunById(run.id);
    return { run: fullRun, preview, executed: true };
  } catch (err) {
    await run.update({ status: 'failed', error_message: err.message });
    throw err;
  }
}

async function formatRunWithConnection(run, includeEntities = false) {
  const row = run.toJSON ? run.toJSON() : run;
  let connection = null;
  if (row.connection_id) {
    const conn = await BizdataDatabaseConnection.findByPk(row.connection_id);
    if (conn) connection = databaseConnectionService.formatConnection(conn);
  }
  const result = formatRun(run, includeEntities);
  if (connection) {
    result.connectionId = connection.id;
    result.connectionName = connection.name;
    result.dbType = connection.dbType;
  }
  return result;
}

function formatRun(run, includeEntities = false) {
  const d = run.toJSON ? run.toJSON() : run;
  const result = {
    id: d.id,
    connectionId: d.connection_id,
    connectionName: d.connection?.name,
    dbType: d.connection?.db_type,
    targetSchema: d.target_schema,
    status: d.status,
    sqlPreview: d.sql_preview,
    generatedCode: d.generated_code || {},
    executedAt: d.executed_at,
    errorMessage: d.error_message,
    createdBy: d.created_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
  if (includeEntities && d.entities) {
    result.entities = d.entities.map((e) => ({
      id: e.id,
      entityId: e.entity_id,
      entityVersion: e.entity_version,
      tableName: e.table_name,
      ddlApplied: e.ddl_applied,
      createdAt: e.created_at,
      entity: e.entity ? {
        id: e.entity.id,
        code: e.entity.code,
        label: e.entity.label,
        version: e.entity.version
      } : undefined
    }));
  }
  return result;
}

async function listRuns({ page = 1, size = 10, connectionId } = {}) {
  const limit = Math.min(Math.max(size, 1), 100);
  const where = {};
  if (connectionId) where.connection_id = connectionId;

  const { count, rows } = await BizdataMaterializationRun.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [['created_at', 'DESC']],
    include: [{ model: BizdataDatabaseConnection, as: 'connection', required: false }]
  });
  return {
    total: count,
    items: rows.map((r) => formatRun(r)),
    page,
    size: limit
  };
}

async function getRunById(id) {
  const run = await BizdataMaterializationRun.findByPk(id, {
    include: [
      { model: BizdataDatabaseConnection, as: 'connection', required: false },
      {
        model: BizdataMaterializationEntity,
        as: 'entities',
        include: [{ model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label', 'version'] }]
      }
    ]
  });
  if (!run) return null;
  return formatRun(run, true);
}

module.exports = {
  buildPreview,
  getMaterializationStatus,
  executeMaterialization,
  listRuns,
  getRunById,
  generateEntityTsCode
};
