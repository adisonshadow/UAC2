const { Op } = require('sequelize');
const {
  BizdataEntity,
  BizdataEntityField,
  BizdataRelation,
  BizdataMetadataTable,
  BizdataApiService,
  BizdataCollectionPipeline,
  BizdataMaterializationEntity,
  BizdataMaterializationRun,
  BizdataMetric,
} = require('../../models');
const { codeToRoutePath } = require('../apiService/apiServiceDomainUtils');

const INGEST_BASE = '/api/v1/ingest';

function deriveScopeFromEntityCode(code) {
  const parts = String(code || '').trim().split(':');
  if (parts.length <= 1) return parts[0] || code;
  return parts.slice(0, -1).join(':');
}

function buildReplacementPairs(oldCode, newCode, oldTableName, newTableName) {
  const pairs = [[String(oldCode || '').trim(), String(newCode || '').trim()]];
  const oldTable = String(oldTableName || '').trim();
  const newTable = String(newTableName || '').trim();
  if (oldTable && newTable && oldTable !== newTable) {
    pairs.push([oldTable, newTable]);
  }
  return pairs.filter(([from]) => from);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 仅替换完整 code 片段，避免 fmms:WorkCard 误伤 fmms:WorkCardPart */
function replaceCodeLiteral(text, oldCode, newCode) {
  if (!text || !oldCode || oldCode === newCode) return text;
  const re = new RegExp(`${escapeRegExp(oldCode)}(?![A-Za-z0-9_])`, 'g');
  return String(text).replace(re, newCode);
}

function replaceTableLiteral(text, oldTable, newTable) {
  if (!text || !oldTable || oldTable === newTable) return text;
  const re = new RegExp(`${escapeRegExp(oldTable)}(?![A-Za-z0-9_])`, 'g');
  return String(text).replace(re, newTable);
}

function replaceServiceCode(code, oldCode, newCode) {
  const value = String(code || '');
  if (!value || !oldCode) return value;
  if (value === oldCode) return newCode;
  if (value.startsWith(oldCode)) {
    return `${newCode}${value.slice(oldCode.length)}`;
  }
  return value;
}

function replaceInValue(value, pairs) {
  if (value == null) return value;
  const [codePair, tablePair] = pairs;
  const [oldCode, newCode] = codePair || [];
  const [oldTable, newTable] = tablePair || [];

  if (typeof value === 'string') {
    if (oldCode && value === oldCode) return newCode;
    if (oldTable && value === oldTable) return newTable;
    let result = value;
    if (oldCode) result = replaceCodeLiteral(result, oldCode, newCode);
    if (oldTable) result = replaceTableLiteral(result, oldTable, newTable);
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceInValue(item, pairs));
  }
  if (typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, nested]) => {
      next[key] = replaceInValue(nested, pairs);
    });
    return next;
  }
  return value;
}

function jsonChanged(before, after) {
  return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
}

async function assertUniqueCodes(model, items, { codeField = 'code', routeField = 'route_path', label, transaction }) {
  const nextCodes = items.map((item) => item.nextCode).filter(Boolean);
  const dup = nextCodes.find((code, index) => nextCodes.indexOf(code) !== index);
  if (dup) {
    throw new Error(`${label} code 冲突：批量更新后出现重复「${dup}」`);
  }

  for (const item of items) {
    const where = { [codeField]: item.nextCode, id: { [Op.ne]: item.id } };
    const existing = await model.findOne({ where, transaction });
    if (existing) {
      throw new Error(`${label} code「${item.nextCode}」已被「${existing.name || existing.code}」占用，无法同步更新实体 Code`);
    }
    if (routeField && item.nextRoutePath) {
      const routeConflict = await model.findOne({
        where: { [routeField]: item.nextRoutePath, id: { [Op.ne]: item.id } },
        transaction,
      });
      if (routeConflict) {
        throw new Error(`${label} 路由「${item.nextRoutePath}」已被占用，无法同步更新实体 Code`);
      }
    }
  }
}

function buildApiServiceUpdates(service, pairs, entityId, newCode, newTableName, newScopeCode) {
  const oldCode = pairs[0][0];
  const linkedToEntity = service.entity_id === entityId || service.entity_code === oldCode;
  const nextCode = linkedToEntity
    ? replaceServiceCode(service.code, oldCode, newCode)
    : replaceInValue(service.code, pairs);
  const nextRoutePath = codeToRoutePath(nextCode);
  return {
    id: service.id,
    nextCode,
    nextRoutePath,
    updates: {
      code: nextCode,
      route_path: nextRoutePath,
      base_path: `/api/v1/data/${nextRoutePath}`,
      entity_code: linkedToEntity ? newCode : replaceInValue(service.entity_code, pairs),
      entity_id: linkedToEntity ? entityId : service.entity_id,
      table_name: linkedToEntity ? (newTableName || service.table_name) : replaceInValue(service.table_name, pairs),
      scope_code: linkedToEntity ? newScopeCode : replaceInValue(service.scope_code, pairs),
      definition_script: service.definition_script ? replaceInValue(service.definition_script, pairs) : service.definition_script,
      handler_script: service.handler_script ? replaceInValue(service.handler_script, pairs) : service.handler_script,
      request_parameter_interface: service.request_parameter_interface
        ? replaceInValue(service.request_parameter_interface, pairs)
        : service.request_parameter_interface,
      tags: replaceInValue(service.tags || [], pairs),
      script_overrides: replaceInValue(service.script_overrides || {}, pairs),
      security_config: replaceInValue(service.security_config || {}, pairs),
    },
  };
}

function buildPipelineUpdates(pipeline, pairs, entityId, newCode, newTableName) {
  const oldCode = pairs[0][0];
  const linkedToEntity = pipeline.entity_id === entityId || pipeline.entity_code === oldCode;
  const nextCode = linkedToEntity
    ? replaceServiceCode(pipeline.code, oldCode, newCode)
    : replaceInValue(pipeline.code, pairs);
  const nextRoutePath = codeToRoutePath(nextCode);
  return {
    id: pipeline.id,
    nextCode,
    nextRoutePath,
    updates: {
      code: nextCode,
      route_path: nextRoutePath,
      base_path: `${INGEST_BASE}/${nextRoutePath}`,
      entity_code: linkedToEntity ? newCode : replaceInValue(pipeline.entity_code, pairs),
      entity_id: linkedToEntity ? entityId : pipeline.entity_id,
      table_name: linkedToEntity ? (newTableName || pipeline.table_name) : replaceInValue(pipeline.table_name, pairs),
      description: pipeline.description ? replaceInValue(pipeline.description, pairs) : pipeline.description,
      sample_data: pipeline.sample_data ? replaceInValue(pipeline.sample_data, pairs) : pipeline.sample_data,
      target_structure: pipeline.target_structure ? replaceInValue(pipeline.target_structure, pairs) : pipeline.target_structure,
      parse_script: pipeline.parse_script ? replaceInValue(pipeline.parse_script, pairs) : pipeline.parse_script,
      store_script: pipeline.store_script ? replaceInValue(pipeline.store_script, pairs) : pipeline.store_script,
    },
  };
}

/**
 * 实体 Code 变更时，在同一事务内级联更新所有引用；任一步失败则整体回滚。
 */
async function cascadeEntityCodeChange({
  entityId,
  oldCode,
  newCode,
  oldTableName,
  newTableName,
  transaction,
}) {
  const pairs = buildReplacementPairs(oldCode, newCode, oldTableName, newTableName);
  const newScopeCode = deriveScopeFromEntityCode(newCode);
  const summary = {
    metadataTables: 0,
    apiServices: 0,
    collectionPipelines: 0,
    materializationEntities: 0,
    materializationRuns: 0,
    relations: 0,
    entityFields: 0,
    entities: 0,
    metrics: 0,
  };

  const metadataRows = await BizdataMetadataTable.findAll({
    where: {
      [Op.or]: [
        { target_type: 'entity', target_id: entityId },
        { code: oldCode },
      ],
    },
    transaction,
  });
  for (const row of metadataRows) {
    if (row.code === newCode) continue;
    const conflict = await BizdataMetadataTable.findOne({
      where: { code: newCode, id: { [Op.ne]: row.id } },
      transaction,
    });
    if (conflict) {
      throw new Error(`元数据 code「${newCode}」已被占用，无法同步更新实体 Code`);
    }
    await row.update({ code: newCode }, { transaction });
    summary.metadataTables += 1;
  }

  const apiServices = await BizdataApiService.findAll({
    where: {
      [Op.or]: [
        { entity_id: entityId },
        { entity_code: oldCode },
      ],
    },
    transaction,
  });
  const apiUpdates = apiServices.map((service) =>
    buildApiServiceUpdates(service, pairs, entityId, newCode, newTableName, newScopeCode),
  );
  await assertUniqueCodes(BizdataApiService, apiUpdates, { label: 'API 服务', transaction });
  for (const item of apiUpdates) {
    await BizdataApiService.update(item.updates, { where: { id: item.id }, transaction });
    summary.apiServices += 1;
  }

  const pipelines = await BizdataCollectionPipeline.findAll({
    where: {
      [Op.or]: [
        { entity_id: entityId },
        { entity_code: oldCode },
      ],
    },
    transaction,
  });
  const pipelineUpdates = pipelines.map((pipeline) =>
    buildPipelineUpdates(pipeline, pairs, entityId, newCode, newTableName),
  );
  await assertUniqueCodes(BizdataCollectionPipeline, pipelineUpdates, { label: '采集管道', transaction });
  for (const item of pipelineUpdates) {
    await BizdataCollectionPipeline.update(item.updates, { where: { id: item.id }, transaction });
    summary.collectionPipelines += 1;
  }

  if (newTableName && oldTableName !== newTableName) {
    const [matCount] = await BizdataMaterializationEntity.update(
      { table_name: newTableName },
      { where: { entity_id: entityId }, transaction },
    );
    summary.materializationEntities = matCount;
  }

  const matRunRows = await BizdataMaterializationEntity.findAll({
    where: { entity_id: entityId },
    attributes: ['run_id'],
    transaction,
  });
  const runIds = [...new Set(matRunRows.map((row) => row.run_id).filter(Boolean))];
  if (runIds.length) {
    const runs = await BizdataMaterializationRun.findAll({
      where: { id: { [Op.in]: runIds } },
      transaction,
    });
    for (const run of runs) {
      const generatedCode = { ...(run.generated_code || {}) };
      let runChanged = false;
      if (generatedCode[entityId]) {
        const nextSnippet = replaceInValue(generatedCode[entityId], pairs);
        if (nextSnippet !== generatedCode[entityId]) {
          generatedCode[entityId] = nextSnippet;
          runChanged = true;
        }
      }
      const nextSqlPreview = run.sql_preview ? replaceInValue(run.sql_preview, pairs) : run.sql_preview;
      if (nextSqlPreview !== run.sql_preview) runChanged = true;
      if (runChanged) {
        await run.update({
          generated_code: generatedCode,
          sql_preview: nextSqlPreview,
        }, { transaction });
        summary.materializationRuns += 1;
      }
    }
  }

  const relations = await BizdataRelation.findAll({ transaction });
  for (const relation of relations) {
    const nextConfig = replaceInValue(relation.config || {}, pairs);
    const nextMetadata = replaceInValue(relation.metadata || {}, pairs);
    const nextJoinTable = relation.join_table != null ? replaceInValue(relation.join_table, pairs) : relation.join_table;
    if (
      jsonChanged(relation.config || {}, nextConfig)
      || jsonChanged(relation.metadata || {}, nextMetadata)
      || jsonChanged(relation.join_table, nextJoinTable)
    ) {
      await relation.update({
        config: nextConfig,
        metadata: nextMetadata,
        join_table: nextJoinTable,
      }, { transaction });
      summary.relations += 1;
    }
  }

  const allFields = await BizdataEntityField.findAll({ transaction });
  for (const field of allFields) {
    const nextColumnInfo = replaceInValue(field.column_info || {}, pairs);
    const nextTypeorm = replaceInValue(field.typeorm_config || {}, pairs);
    if (
      jsonChanged(field.column_info || {}, nextColumnInfo)
      || jsonChanged(field.typeorm_config || {}, nextTypeorm)
    ) {
      await field.update({
        column_info: nextColumnInfo,
        typeorm_config: nextTypeorm,
      }, { transaction });
      summary.entityFields += 1;
    }
  }

  const allEntities = await BizdataEntity.findAll({ transaction });
  for (const ent of allEntities) {
    if (ent.id === entityId) continue;
    const entityUpdates = {};
    if (ent.json_schema) {
      const nextJsonSchema = replaceInValue(ent.json_schema, pairs);
      if (jsonChanged(ent.json_schema, nextJsonSchema)) entityUpdates.json_schema = nextJsonSchema;
    }
    if (ent.layout) {
      const nextLayout = replaceInValue(ent.layout, pairs);
      if (jsonChanged(ent.layout, nextLayout)) entityUpdates.layout = nextLayout;
    }
    if (ent.entity_info) {
      const nextInfo = replaceInValue(ent.entity_info, pairs);
      if (jsonChanged(ent.entity_info, nextInfo)) entityUpdates.entity_info = nextInfo;
    }
    if (Object.keys(entityUpdates).length) {
      await ent.update(entityUpdates, { transaction });
      summary.entities += 1;
    }
  }

  const metrics = await BizdataMetric.findAll({
    where: {
      [Op.or]: [
        { code: oldCode },
        { scope_code: deriveScopeFromEntityCode(oldCode) },
        { query_script: { [Op.iLike]: `%${oldCode}%` } },
      ],
    },
    transaction,
  });
  for (const metric of metrics) {
    const metricUpdates = {};
    if (metric.code === oldCode) metricUpdates.code = newCode;
    if (metric.scope_code === deriveScopeFromEntityCode(oldCode)) {
      metricUpdates.scope_code = newScopeCode;
    }
    if (metric.query_script) {
      const nextScript = replaceInValue(metric.query_script, pairs);
      if (nextScript !== metric.query_script) metricUpdates.query_script = nextScript;
    }
    const nextFormula = replaceInValue(metric.formula_config || {}, pairs);
    if (jsonChanged(metric.formula_config || {}, nextFormula)) {
      metricUpdates.formula_config = nextFormula;
    }
    if (Object.keys(metricUpdates).length) {
      if (metricUpdates.code && metricUpdates.code !== metric.code) {
        const conflict = await BizdataMetric.findOne({
          where: { code: metricUpdates.code, id: { [Op.ne]: metric.id } },
          transaction,
        });
        if (conflict) {
          throw new Error(`指标 code「${metricUpdates.code}」已被占用，无法同步更新实体 Code`);
        }
      }
      await metric.update(metricUpdates, { transaction });
      summary.metrics += 1;
    }
  }

  return summary;
}

module.exports = {
  buildReplacementPairs,
  replaceInValue,
  replaceCodeLiteral,
  deriveScopeFromEntityCode,
  cascadeEntityCodeChange,
};
