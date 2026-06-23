const { Op } = require('sequelize');
const {
  BizdataEntity,
  BizdataEntityField,
  BizdataMaterializationRun,
  BizdataMaterializationEntity,
  sequelize
} = require('../../models');
const businessDataService = require('./businessDataService');

function mapSqlType(typeormConfig = {}) {
  const type = (typeormConfig.type || 'varchar').toLowerCase();
  const length = typeormConfig.length;
  const precision = typeormConfig.precision;
  const scale = typeormConfig.scale;

  switch (type) {
    case 'int':
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'boolean':
    case 'bool':
      return 'BOOLEAN';
    case 'text':
      return 'TEXT';
    case 'json':
    case 'jsonb':
      return 'JSONB';
    case 'decimal':
    case 'numeric':
      return precision ? `NUMERIC(${precision}${scale != null ? `,${scale}` : ''})` : 'NUMERIC';
    case 'timestamp':
    case 'timestamptz':
      return 'TIMESTAMPTZ';
    case 'uuid':
      return 'UUID';
    case 'varchar':
    case 'string':
    default:
      return length ? `VARCHAR(${length})` : 'VARCHAR(255)';
  }
}

function generateColumnDef(field) {
  const cfg = field.typeormConfig || field.typeorm_config || {};
  const colInfo = field.columnInfo || field.column_info || {};
  const parts = [`"${field.fieldKey || field.field_key}"`, mapSqlType(cfg)];

  if (cfg.primary || colInfo.extendType?.includes('id')) {
    parts.push('PRIMARY KEY');
  }
  if (cfg.unique) parts.push('UNIQUE');
  if (cfg.nullable === false) parts.push('NOT NULL');
  if (cfg.default !== undefined && cfg.default !== null) {
    const def = typeof cfg.default === 'string' ? `'${cfg.default.replace(/'/g, "''")}'` : cfg.default;
    parts.push(`DEFAULT ${def}`);
  }
  return parts.join(' ');
}

function generateEntityDDL(entity, targetSchema) {
  const tableName = entity.tableName || entity.table_name || entity.code.split(':').pop();
  const fields = entity.fields || [];
  const lines = fields.length
    ? fields.map((f) => `  ${generateColumnDef(f)}`)
    : ['  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'];

  const hasPk = fields.some((f) => {
    const cfg = f.typeormConfig || f.typeorm_config || {};
    return cfg.primary;
  });
  if (!hasPk && !fields.some((f) => (f.fieldKey || f.field_key) === 'id')) {
    lines.unshift('  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  }

  lines.push('  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
  lines.push('  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');

  return `CREATE TABLE IF NOT EXISTS "${targetSchema}"."${tableName}" (\n${lines.join(',\n')}\n);`;
}

function generateEntityTsCode(entity) {
  const className = (entity.tableName || entity.code.split(':').pop())
    .replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())
    .replace(/_/g, '');
  const tableName = entity.tableName || entity.code.split(':').pop();
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
    where.id = { [Op.in]: entityIds };
  }

  const entities = await BizdataEntity.findAll({
    where,
    include: [{ model: BizdataEntityField, as: 'fields', required: false }],
    order: [['code', 'ASC']]
  });

  return entities.map((e) => businessDataService.formatEntity(e));
}

async function buildPreview({ entityIds, targetSchema }) {
  const schema = targetSchema || await businessDataService.getDefaultMaterializationSchema();
  const entities = await loadErEntities(entityIds);

  const sqlParts = [`CREATE SCHEMA IF NOT EXISTS "${schema}";`];
  const generatedCode = {};

  entities.forEach((entity) => {
    sqlParts.push(generateEntityDDL(entity, schema));
    generatedCode[entity.id] = generateEntityTsCode(entity);
  });

  return {
    targetSchema: schema,
    entities: entities.map((e) => ({ id: e.id, code: e.code, version: e.version, tableName: e.tableName })),
    sql: sqlParts.join('\n\n'),
    generatedCode
  };
}

async function getMaterializationStatus() {
  const entities = await BizdataEntity.findAll({
    where: { entity_kind: 'er_table' },
    order: [['code', 'ASC']]
  });

  const matRecords = await BizdataMaterializationEntity.findAll({
    where: { ddl_applied: true },
    include: [{ model: BizdataMaterializationRun, as: 'run', required: true }],
    order: [['created_at', 'DESC']]
  });

  const latestByEntity = new Map();
  matRecords.forEach((rec) => {
    const eid = rec.entity_id;
    if (!latestByEntity.has(eid)) {
      latestByEntity.set(eid, rec);
    }
  });

  return entities.map((entity) => {
    const latest = latestByEntity.get(entity.id);
    const materializedVersion = latest ? latest.entity_version : null;
    const currentVersion = entity.version;
    let staleStatus = 'not_materialized';
    if (materializedVersion != null) {
      staleStatus = currentVersion > materializedVersion ? 'stale' : 'latest';
    }
    return {
      entityId: entity.id,
      code: entity.code,
      label: entity.label,
      tableName: entity.table_name,
      currentVersion,
      materializedVersion,
      isStale: staleStatus === 'stale',
      staleStatus,
      lastMaterializedAt: latest?.created_at || null
    };
  });
}

async function executeMaterialization({ entityIds, targetSchema, dryRun = false, expectedVersions = {}, createdBy }) {
  const preview = await buildPreview({ entityIds, targetSchema });

  if (Object.keys(expectedVersions).length) {
    for (const ent of preview.entities) {
      const expected = expectedVersions[ent.id];
      if (expected != null && expected !== ent.version) {
        throw new Error(`实体 ${ent.code} 版本冲突：期望 v${expected}，当前 v${ent.version}`);
      }
    }
  }

  const run = await BizdataMaterializationRun.create({
    target_schema: preview.targetSchema,
    status: dryRun ? 'preview' : 'running',
    sql_preview: preview.sql,
    generated_code: preview.generatedCode,
    created_by: createdBy || null
  });

  if (dryRun) {
    return { run: formatRun(run), preview, executed: false };
  }

  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${preview.targetSchema}";`, { transaction });

    for (const stmt of preview.sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      if (stmt.startsWith('CREATE SCHEMA')) continue;
      await sequelize.query(`${stmt};`, { transaction });
    }

    const entityRows = await BizdataEntity.findAll({
      where: { id: { [Op.in]: preview.entities.map((e) => e.id) } },
      transaction
    });
    const versionMap = new Map(entityRows.map((e) => [e.id, e.version]));

    await BizdataMaterializationEntity.bulkCreate(
      preview.entities.map((e) => ({
        run_id: run.id,
        entity_id: e.id,
        entity_version: versionMap.get(e.id) ?? e.version,
        table_name: e.tableName,
        ddl_applied: true
      })),
      { transaction }
    );

    await run.update({
      status: 'success',
      executed_at: new Date()
    }, { transaction });

    await transaction.commit();

    const fullRun = await getRunById(run.id);
    return { run: fullRun, preview, executed: true };
  } catch (err) {
    await transaction.rollback();
    await run.update({ status: 'failed', error_message: err.message });
    throw err;
  }
}

function formatRun(run, includeEntities = false) {
  const d = run.toJSON ? run.toJSON() : run;
  const result = {
    id: d.id,
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

async function listRuns({ page = 1, size = 10 } = {}) {
  const limit = Math.min(Math.max(size, 1), 100);
  const { count, rows } = await BizdataMaterializationRun.findAndCountAll({
    limit,
    offset: (page - 1) * limit,
    order: [['created_at', 'DESC']]
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
    include: [{
      model: BizdataMaterializationEntity,
      as: 'entities',
      include: [{ model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label', 'version'] }]
    }]
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
  generateEntityDDL,
  generateEntityTsCode
};
