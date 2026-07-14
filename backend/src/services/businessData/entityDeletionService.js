const { Op } = require('sequelize');
const {
  BizdataEntity,
  BizdataRelation,
  BizdataApiService,
  BizdataApiServiceOperation,
  BizdataApiServicePermission,
  BizdataCollectionPipeline,
  BizdataMetric,
  BizdataMetadataTable,
  BizdataMetadataField,
  BizdataMaterializationEntity,
  BizdataMaterializationRun,
  BizdataDatabaseConnection,
  sequelize,
} = require('../../models');
const { resolveEntityTableName } = require('./entityTableName');
const { deriveScopeFromEntityCode } = require('./entityCodeCascadeService');
const {
  collectPhysicalDropTargets,
  dropMaterializedPhysicalTables,
} = require('./materializedTableDropService');

function formatRelation(row) {
  const data = row.toJSON ? row.toJSON() : row;
  return {
    id: data.id,
    type: data.type,
    name: data.name,
    inverseName: data.inverse_name,
    fromEntityId: data.from_entity_id,
    toEntityId: data.to_entity_id,
    config: data.config || {},
  };
}

function formatEntityBrief(entity) {
  const data = entity.toJSON ? entity.toJSON() : entity;
  return {
    id: data.id,
    code: data.code,
    label: data.label,
    entityKind: data.entity_kind,
    tableName: data.table_name,
    isLocked: !!data.is_locked,
    status: data.status,
    version: data.version,
  };
}

async function findConnectedComponent(rootEntityId) {
  const allRelations = await BizdataRelation.findAll();
  const adj = new Map();
  const relationList = [];

  for (const rel of allRelations) {
    const formatted = formatRelation(rel);
    relationList.push(formatted);
    const a = formatted.fromEntityId;
    const b = formatted.toEntityId;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }

  const visited = new Set();
  const queue = [rootEntityId];
  visited.add(rootEntityId);
  while (queue.length) {
    const cur = queue.shift();
    const neighbors = adj.get(cur) || new Set();
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  const entityIds = [...visited];
  const entities = await BizdataEntity.findAll({
    where: { id: { [Op.in]: entityIds } },
  });
  const entityById = new Map(entities.map((e) => [e.id, e]));

  // Keep only entities still present + relations within the component
  const componentRelations = relationList.filter(
    (r) => visited.has(r.fromEntityId) && visited.has(r.toEntityId),
  );

  return { entityIds, entityById, entities, componentRelations };
}

async function loadMaterializationForEntity(entityId, entity) {
  const records = await BizdataMaterializationEntity.findAll({
    where: { entity_id: entityId, ddl_applied: true },
    include: [{
      model: BizdataMaterializationRun,
      as: 'run',
      required: true,
      where: { status: 'success' },
      include: [{ model: BizdataDatabaseConnection, as: 'connection', required: true }],
    }],
    order: [['created_at', 'DESC']],
  });

  const byConnection = new Map();
  records.forEach((rec) => {
    const connId = rec.run.connection_id;
    if (byConnection.has(connId)) return;
    byConnection.set(connId, {
      connectionId: connId,
      connectionName: rec.run.connection?.name || null,
      dbType: rec.run.connection?.db_type || null,
      targetSchema: rec.run.target_schema || rec.run.connection?.target_schema || null,
      tableName: rec.table_name
        || resolveEntityTableName(entity.code, entity.table_name),
      entityVersion: rec.entity_version,
      materializationEntityId: rec.id,
      runId: rec.run_id,
    });
  });
  return [...byConnection.values()];
}

async function loadMetricsForEntity(entity) {
  const scopeCode = deriveScopeFromEntityCode(entity.code);
  const tableName = resolveEntityTableName(entity.code, entity.table_name);
  const orConditions = [
    { code: entity.code },
    { code: { [Op.like]: `${entity.code}:%` } },
  ];
  if (scopeCode) {
    orConditions.push({ scope_code: scopeCode });
  }
  if (entity.code) {
    orConditions.push({ query_script: { [Op.iLike]: `%${entity.code}%` } });
  }
  if (tableName) {
    orConditions.push({ query_script: { [Op.iLike]: `%${tableName}%` } });
  }

  const rows = await BizdataMetric.findAll({
    where: { [Op.or]: orConditions },
  });

  // Prefer metrics that clearly reference this entity (code prefix / table / exact)
  // Keep scope-matched ones as candidates (weak association).
  return rows.map((m) => {
    const data = m.toJSON();
    const script = data.query_script || '';
    const strong = data.code === entity.code
      || (data.code || '').startsWith(`${entity.code}:`)
      || (tableName && script.includes(tableName))
      || (entity.code && script.includes(entity.code));
    return {
      id: data.id,
      code: data.code,
      name: data.label || data.name,
      scopeCode: data.scope_code,
      metricType: data.metric_type,
      matchStrength: strong ? 'strong' : 'weak',
    };
  });
}

async function loadMetadataTables({ targetType, targetIds = [], codes = [] }) {
  const or = [];
  if (targetIds.length) {
    or.push({ target_type: targetType, target_id: { [Op.in]: targetIds } });
  }
  if (codes.length) {
    or.push({ target_type: targetType, code: { [Op.in]: codes } });
  }
  if (!or.length) return [];

  const rows = await BizdataMetadataTable.findAll({
    where: { [Op.or]: or },
    include: [{ model: BizdataMetadataField, as: 'fields', attributes: ['id'] }],
  });

  const seen = new Set();
  return rows
    .map((row) => {
      const data = row.toJSON();
      if (seen.has(data.id)) return null;
      seen.add(data.id);
      return {
        id: data.id,
        code: data.code,
        targetType: data.target_type,
        targetId: data.target_id,
        metadataCode: data.metadata_code,
        businessMeaning: data.business_meaning,
        fieldCount: (data.fields || []).length,
      };
    })
    .filter(Boolean);
}

async function analyzeEntityDeletion(rootEntityId) {
  const root = await BizdataEntity.findByPk(rootEntityId);
  if (!root) {
    const err = new Error('实体不存在');
    err.status = 404;
    throw err;
  }

  const { entityById, entities, componentRelations } = await findConnectedComponent(rootEntityId);

  const entityItems = [];
  for (const entity of entities) {
    const brief = formatEntityBrief(entity);
    const referencingRelations = componentRelations
      .filter((r) => r.toEntityId === entity.id || r.fromEntityId === entity.id)
      .map((r) => {
        const otherId = r.fromEntityId === entity.id ? r.toEntityId : r.fromEntityId;
        const other = entityById.get(otherId);
        return {
          relationId: r.id,
          relationType: r.type,
          relationName: r.name,
          direction: r.fromEntityId === entity.id ? 'outgoing' : 'incoming',
          otherEntityId: otherId,
          otherEntityCode: other?.code || null,
          otherEntityLabel: other?.label || null,
        };
      });

    const [apiServices, pipelines, materialization, metrics, metadataTables] = await Promise.all([
      BizdataApiService.findAll({ where: { entity_id: entity.id } }),
      BizdataCollectionPipeline.findAll({
        where: {
          entity_id: entity.id,
          status: { [Op.ne]: 'deleted' },
        },
      }),
      loadMaterializationForEntity(entity.id, entity),
      loadMetricsForEntity(entity),
      loadMetadataTables({
        targetType: 'entity',
        targetIds: [entity.id],
        codes: [entity.code],
      }),
    ]);

    entityItems.push({
      ...brief,
      isRoot: entity.id === rootEntityId,
      referencingRelations,
      apiServices: apiServices.map((s) => {
        const d = s.toJSON();
        return {
          id: d.id,
          code: d.code,
          name: d.name,
          routePath: d.route_path,
          status: d.status,
        };
      }),
      collectionPipelines: pipelines.map((p) => {
        const d = p.toJSON();
        return {
          id: d.id,
          code: d.code,
          name: d.name,
          routePath: d.route_path,
          protocolType: d.protocol_type,
          status: d.status,
        };
      }),
      materialization,
      metrics,
      metadataTables,
    });
  }

  // Aggregate metric metadata for all metrics appearing in analysis
  const allMetricIds = [...new Set(entityItems.flatMap((e) => e.metrics.map((m) => m.id)))];
  const allMetricCodes = [...new Set(entityItems.flatMap((e) => e.metrics.map((m) => m.code)).filter(Boolean))];
  const metricMetadataTables = await loadMetadataTables({
    targetType: 'metric',
    targetIds: allMetricIds,
    codes: allMetricCodes,
  });

  return {
    rootEntityId,
    rootEntity: formatEntityBrief(root),
    entities: entityItems,
    relations: componentRelations,
    metricMetadataTables,
  };
}

function collectMetricsForEntities(entityRows, analysisLikeMetrics) {
  // Prefer recomputed list passed in (from DB query during execute)
  return analysisLikeMetrics;
}

async function findMetricsForEntities(entities) {
  const byId = new Map();
  for (const entity of entities) {
    // eslint-disable-next-line no-await-in-loop
    const metrics = await loadMetricsForEntity(entity);
    for (const m of metrics) {
      byId.set(m.id, m);
    }
  }
  return [...byId.values()];
}

async function destroyMetadataTables({ targetType, targetIds, codes, transaction }) {
  const or = [];
  if (targetIds?.length) {
    or.push({ target_type: targetType, target_id: { [Op.in]: targetIds } });
  }
  if (codes?.length) {
    or.push({ target_type: targetType, code: { [Op.in]: codes } });
  }
  if (!or.length) return { tables: 0, fields: 0 };

  const rows = await BizdataMetadataTable.findAll({
    where: { [Op.or]: or },
    include: [{ model: BizdataMetadataField, as: 'fields', attributes: ['id'] }],
    transaction,
  });
  const ids = [...new Set(rows.map((r) => r.id))];
  let fieldCount = 0;
  rows.forEach((r) => {
    fieldCount += (r.fields || []).length;
  });
  if (ids.length) {
    await BizdataMetadataTable.destroy({ where: { id: { [Op.in]: ids } }, transaction });
  }
  return { tables: ids.length, fields: fieldCount };
}

async function executeEntityDeletion({ deleteEntityIds, dropPhysicalTables = false }) {
  const ids = [...new Set((deleteEntityIds || []).filter(Boolean))];
  if (!ids.length) {
    throw new Error('deleteEntityIds 不能为空');
  }

  const entities = await BizdataEntity.findAll({ where: { id: { [Op.in]: ids } } });
  if (entities.length !== ids.length) {
    const found = new Set(entities.map((e) => e.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new Error(`实体不存在：${missing.join(', ')}`);
  }

  const locked = entities.filter((e) => e.is_locked);
  if (locked.length) {
    throw new Error(
      `以下实体已锁定，无法删除：${locked.map((e) => e.label || e.code).join('、')}`,
    );
  }

  const codes = entities.map((e) => e.code).filter(Boolean);

  // Collect physical drop targets BEFORE metadata/CASCADE deletes wipe materialization_entities
  let physicalTargets = [];
  if (dropPhysicalTables) {
    physicalTargets = await collectPhysicalDropTargets(entities);
  }

  // Pre-collect metrics + downstream for summary / deletion (仅强关联，避免误删同 Scope 无关指标)
  const metrics = (await findMetricsForEntities(entities)).filter(
    (m) => m.matchStrength === 'strong',
  );
  const metricIds = metrics.map((m) => m.id);
  const metricCodes = metrics.map((m) => m.code).filter(Boolean);

  const apiServices = await BizdataApiService.findAll({
    where: { entity_id: { [Op.in]: ids } },
  });
  const pipelines = await BizdataCollectionPipeline.findAll({
    where: {
      entity_id: { [Op.in]: ids },
      status: { [Op.ne]: 'deleted' },
    },
  });

  // Count relations that will CASCADE
  const relationCount = await BizdataRelation.count({
    where: {
      [Op.or]: [
        { from_entity_id: { [Op.in]: ids } },
        { to_entity_id: { [Op.in]: ids } },
      ],
    },
  });

  const summary = {
    deletedEntities: 0,
    deletedRelations: relationCount,
    deletedApiServices: 0,
    deletedCollectionPipelines: 0,
    deletedMetrics: 0,
    deletedMetadataTables: 0,
    deletedMetadataFields: 0,
    physicalTableDrops: [],
  };

  await sequelize.transaction(async (transaction) => {
    // 1. API services (hard delete to clear RESTRICT)
    for (const service of apiServices) {
      // eslint-disable-next-line no-await-in-loop
      await BizdataApiServiceOperation.destroy({
        where: { api_service_id: service.id },
        transaction,
      });
      // eslint-disable-next-line no-await-in-loop
      await BizdataApiServicePermission.destroy({
        where: { api_service_id: service.id },
        transaction,
      });
      // eslint-disable-next-line no-await-in-loop
      await service.destroy({ transaction });
      summary.deletedApiServices += 1;
    }

    // 2. Collection pipelines — null entity_id then soft-delete to clear RESTRICT
    //    while preserving soft-delete product semantics / run history.
    for (const pipeline of pipelines) {
      // eslint-disable-next-line no-await-in-loop
      await pipeline.update(
        {
          entity_id: null,
          entity_code: null,
          status: 'deleted',
        },
        { transaction },
      );
      summary.deletedCollectionPipelines += 1;
    }

    // 3. Metric metadata then metrics
    const metricMeta = await destroyMetadataTables({
      targetType: 'metric',
      targetIds: metricIds,
      codes: metricCodes,
      transaction,
    });
    summary.deletedMetadataTables += metricMeta.tables;
    summary.deletedMetadataFields += metricMeta.fields;

    if (metricIds.length) {
      await BizdataMetric.destroy({
        where: { id: { [Op.in]: metricIds } },
        transaction,
      });
      summary.deletedMetrics = metricIds.length;
    }

    // 4. Entity metadata catalog (must be explicit — no FK)
    const entityMeta = await destroyMetadataTables({
      targetType: 'entity',
      targetIds: ids,
      codes,
      transaction,
    });
    summary.deletedMetadataTables += entityMeta.tables;
    summary.deletedMetadataFields += entityMeta.fields;

    // 5. Destroy entities (fields / relations / materialization_entities CASCADE)
    for (const entity of entities) {
      // eslint-disable-next-line no-await-in-loop
      await entity.destroy({ transaction });
      summary.deletedEntities += 1;
    }
  });

  // Best-effort physical DROP after metadata commit
  if (dropPhysicalTables && physicalTargets.length) {
    const dropResult = await dropMaterializedPhysicalTables(physicalTargets);
    summary.physicalTableDrops = dropResult.items.map((item) => ({
      entityId: item.entityId,
      entityCode: item.entityCode,
      connectionId: item.connectionId,
      connectionName: item.connectionName,
      dbType: item.dbType,
      targetSchema: item.targetSchema,
      tableName: item.tableName,
      status: item.status,
      ok: item.ok,
      error: item.error || null,
      keysDeleted: item.keysDeleted,
    }));
  }

  if (summary.deletedMetrics > 0) {
    try {
      // eslint-disable-next-line global-require
      const { registerCronJobs } = require('../metrics/metricScheduler');
      registerCronJobs().catch(() => {});
    } catch {
      // scheduler refresh is best-effort
    }
  }

  return {
    deleteEntityIds: ids,
    dropPhysicalTables: !!dropPhysicalTables,
    summary,
    deletedEntities: entities.map(formatEntityBrief),
    deletedApiServices: apiServices.map((s) => {
      const d = s.toJSON();
      return { id: d.id, code: d.code, name: d.name };
    }),
    deletedCollectionPipelines: pipelines.map((p) => {
      const d = p.toJSON();
      return { id: d.id, code: d.code, name: d.name };
    }),
    deletedMetrics: metrics,
  };
}

module.exports = {
  analyzeEntityDeletion,
  executeEntityDeletion,
  findConnectedComponent,
  collectMetricsForEntities,
};
