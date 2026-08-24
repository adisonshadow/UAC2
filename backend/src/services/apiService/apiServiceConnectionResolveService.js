const { BizdataDatabaseConnection } = require('../../models');
const materializationService = require('../businessData/materializationService');

function scopeCodeFromEntityCode(entityCode) {
  const parts = String(entityCode || '')
    .split(':')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return undefined;
  if (parts.length < 2) return parts[0];
  return parts.slice(0, -1).join(':');
}

function entityMatchesScope(code, scopePrefixes) {
  if (!code || !scopePrefixes?.length) return false;
  return scopePrefixes.some((prefix) => code === prefix || code.startsWith(`${prefix}:`));
}

function deriveScopePrefixes({ scopeCode, entityCodes } = {}) {
  const prefixes = [];
  const explicit = typeof scopeCode === 'string' ? scopeCode.trim() : '';
  if (explicit) prefixes.push(explicit);
  if (Array.isArray(entityCodes)) {
    entityCodes.forEach((code) => {
      const derived = scopeCodeFromEntityCode(code);
      if (derived && !prefixes.includes(derived)) prefixes.push(derived);
    });
  }
  return prefixes;
}

function isUsableMaterialization(item, connectionId) {
  if (!item.targetSchema || item.staleStatus === 'not_materialized') return false;
  if (connectionId && String(item.connectionId) !== String(connectionId)) return false;
  return true;
}

function normalizeEntityIds({ entityId, entityIds } = {}) {
  const ids = [];
  if (entityId) ids.push(String(entityId));
  if (Array.isArray(entityIds)) {
    entityIds.forEach((id) => {
      if (id) ids.push(String(id));
    });
  }
  return [...new Set(ids)];
}

function matchesExactEntity(item, { entityIds, entityCodes }) {
  if (entityIds?.length && entityIds.includes(String(item.entityId))) return true;
  if (Array.isArray(entityCodes) && entityCodes.length && item.code && entityCodes.includes(item.code)) {
    return true;
  }
  return false;
}

function scoreBy(statusItems, predicate) {
  const scores = new Map();
  statusItems.forEach((item) => {
    if (!item.connectionId || !isUsableMaterialization(item)) return;
    if (!predicate(item)) return;
    scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
  });
  return scores;
}

function scoreConnections(statusItems, { scopeCode, entityId, entityIds, entityCodes }) {
  const ids = normalizeEntityIds({ entityId, entityIds });
  const scopePrefixes = deriveScopePrefixes({ scopeCode, entityCodes });
  if (ids.length || (Array.isArray(entityCodes) && entityCodes.length)) {
    const exact = scoreBy(statusItems, (item) => matchesExactEntity(item, { entityIds: ids, entityCodes }));
    if (exact.size) return exact;
  }
  if (scopePrefixes.length) {
    return scoreBy(statusItems, (item) => entityMatchesScope(item.code, scopePrefixes));
  }
  return new Map();
}

function pickTargetSchema(best, statusItems, { entityId, entityIds, entityCodes, scopeCode } = {}) {
  const connectionId = best?.id;
  if (!connectionId) return undefined;
  const ids = normalizeEntityIds({ entityId, entityIds });
  const scopePrefixes = deriveScopePrefixes({ scopeCode, entityCodes });
  const usable = (statusItems || []).filter((item) => isUsableMaterialization(item, connectionId));

  if (ids.length) {
    const hit = usable.find((item) => ids.includes(String(item.entityId)));
    if (hit?.targetSchema) return hit.targetSchema;
  }
  if (Array.isArray(entityCodes) && entityCodes.length) {
    const codeSet = new Set(entityCodes.map(String));
    const hit = usable.find((item) => item.code && codeSet.has(item.code));
    if (hit?.targetSchema) return hit.targetSchema;
  }
  if (scopePrefixes.length) {
    const hit = usable.find((item) => entityMatchesScope(item.code, scopePrefixes));
    if (hit?.targetSchema) return hit.targetSchema;
  }

  const hasEntityHint = Boolean(ids.length || (Array.isArray(entityCodes) && entityCodes.length));
  if (hasEntityHint || scopePrefixes.length) return undefined;
  return best.target_schema;
}

function pickBestConnection(connections, scores) {
  if (!connections.length) return undefined;

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return (
      connections.find((c) => c.is_default && c.db_type === 'postgresql')
      || connections.find((c) => c.is_default)
      || connections.find((c) => c.db_type === 'postgresql')
      || connections[0]
    );
  }

  const topScore = ranked[0][1];
  const candidates = ranked.filter(([, score]) => score === topScore).map(([id]) => id);
  const connById = new Map(connections.map((c) => [c.id, c]));

  return (
    candidates
      .map((id) => connById.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        if (a.db_type === 'postgresql' && b.db_type !== 'postgresql') return -1;
        if (b.db_type === 'postgresql' && a.db_type !== 'postgresql') return 1;
        return 0;
      })[0] || connById.get(ranked[0][0])
  );
}

function formatConnectionRow(conn) {
  if (!conn) return null;
  const row = conn.toJSON ? conn.toJSON() : conn;
  return {
    id: row.id,
    name: row.name,
    dbType: row.db_type,
    targetSchema: row.target_schema,
    isDefault: row.is_default,
  };
}

async function resolveConnection({
  connectionId,
  scopeCode,
  entityId,
  entityIds,
  entityCodes,
} = {}) {
  const explicitId = connectionId?.trim();
  const connections = await BizdataDatabaseConnection.findAll({ order: [['name', 'ASC']] });
  if (!connections.length) {
    throw Object.assign(new Error('系统未配置任何数据库连接，请先在业务数据模块添加连接'), { status: 400 });
  }

  const statusItems = await materializationService.getMaterializationStatus({});
  const pickOpts = { entityId, entityIds, entityCodes, scopeCode };
  const scopePrefixes = deriveScopePrefixes(pickOpts);

  if (explicitId) {
    const conn = connections.find((c) => c.id === explicitId);
    if (!conn) {
      throw Object.assign(new Error(`数据库连接 ${explicitId} 不存在`), { status: 400 });
    }
    return {
      connectionId: conn.id,
      connectionName: conn.name,
      dbType: conn.db_type,
      targetSchema: pickTargetSchema(conn, statusItems, pickOpts),
      reason: 'explicit_connection_id',
    };
  }

  if (connections.length === 1) {
    const conn = connections[0];
    const targetSchema = pickTargetSchema(conn, statusItems, pickOpts);
    const scores = scoreConnections(statusItems, pickOpts);
    let reason = 'single_available_connection';
    if (targetSchema && (entityId || (Array.isArray(entityCodes) && entityCodes.length) || (Array.isArray(entityIds) && entityIds.length))) {
      const exactHit = statusItems.some((item) => (
        isUsableMaterialization(item, conn.id)
        && matchesExactEntity(item, { entityIds: normalizeEntityIds({ entityId, entityIds }), entityCodes })
      ));
      reason = exactHit ? 'materialized_primary_entity' : (scopePrefixes.length ? 'materialized_entities_in_scope' : reason);
    } else if (scopePrefixes.length && targetSchema) {
      reason = 'materialized_entities_in_scope';
    }
    return {
      connectionId: conn.id,
      connectionName: conn.name,
      dbType: conn.db_type,
      targetSchema,
      reason,
      matchedEntityCount: scores.get(conn.id) || (targetSchema ? 1 : 0),
    };
  }

  const scores = scoreConnections(statusItems, pickOpts);
  const best = pickBestConnection(connections, scores);
  if (!best?.id) {
    throw Object.assign(new Error('无法根据主实体/Scope 物化记录推断数据库连接'), { status: 400 });
  }

  const matchedEntityCount = scores.get(best.id) || 0;
  const targetSchema = pickTargetSchema(best, statusItems, pickOpts);
  let reason = 'default_or_fallback_connection';
  if (matchedEntityCount > 0) {
    const exactHit = statusItems.some((item) => (
      isUsableMaterialization(item, best.id)
      && matchesExactEntity(item, { entityIds: normalizeEntityIds({ entityId, entityIds }), entityCodes })
    ));
    if (exactHit) {
      reason = 'materialized_primary_entity';
    } else if (scopePrefixes.length) {
      reason = 'materialized_entities_in_scope';
    } else {
      reason = 'materialized_entities_matched';
    }
  } else if (best.is_default) {
    reason = 'default_connection';
  } else if (best.db_type === 'postgresql') {
    reason = 'postgresql_fallback';
  }

  return {
    connectionId: best.id,
    connectionName: best.name,
    dbType: best.db_type,
    targetSchema,
    reason,
    matchedEntityCount,
  };
}

module.exports = {
  resolveConnection,
  formatConnectionRow,
  pickTargetSchema,
  deriveScopePrefixes,
};
