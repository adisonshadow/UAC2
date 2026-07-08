const { BizdataDatabaseConnection } = require('../../models');
const materializationService = require('../businessData/materializationService');

function entityMatchesScope(code, scopePrefix) {
  if (!code || !scopePrefix) return false;
  return code === scopePrefix || code.startsWith(`${scopePrefix}:`);
}

function scoreConnections(statusItems, { scopeCode, entityId, entityCodes }) {
  const scores = new Map();
  const scopePrefix = scopeCode?.trim();
  const entityIdSet = entityId ? new Set([String(entityId)]) : null;
  const entityCodeSet = Array.isArray(entityCodes) && entityCodes.length
    ? new Set(entityCodes.map(String))
    : null;

  statusItems.forEach((item) => {
    if (!item.connectionId || item.staleStatus === 'not_materialized') return;
    if (entityIdSet && !entityIdSet.has(String(item.entityId))) return;
    if (entityCodeSet && item.code && !entityCodeSet.has(item.code) && !entityMatchesScope(item.code, scopePrefix)) {
      return;
    }
    if (scopePrefix && item.code && !entityMatchesScope(item.code, scopePrefix)) return;
    scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
  });
  return scores;
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
  entityCodes,
} = {}) {
  const explicitId = connectionId?.trim();
  const connections = await BizdataDatabaseConnection.findAll({ order: [['name', 'ASC']] });
  if (!connections.length) {
    throw Object.assign(new Error('系统未配置任何数据库连接，请先在业务数据模块添加连接'), { status: 400 });
  }

  if (explicitId) {
    const conn = connections.find((c) => c.id === explicitId);
    if (!conn) {
      throw Object.assign(new Error(`数据库连接 ${explicitId} 不存在`), { status: 400 });
    }
    return {
      connectionId: conn.id,
      connectionName: conn.name,
      dbType: conn.db_type,
      targetSchema: conn.target_schema,
      reason: 'explicit_connection_id',
    };
  }

  if (connections.length === 1) {
    const conn = connections[0];
    return {
      connectionId: conn.id,
      connectionName: conn.name,
      dbType: conn.db_type,
      targetSchema: conn.target_schema,
      reason: 'single_available_connection',
    };
  }

  const statusItems = await materializationService.getMaterializationStatus({});
  const scores = scoreConnections(statusItems, { scopeCode, entityId, entityCodes });
  const best = pickBestConnection(connections, scores);
  if (!best?.id) {
    throw Object.assign(new Error('无法根据 Scope/物化记录推断数据库连接'), { status: 400 });
  }

  const matchedEntityCount = scores.get(best.id) || 0;
  let reason = 'default_or_fallback_connection';
  if (matchedEntityCount > 0) {
    reason = scopeCode ? 'materialized_entities_in_scope' : 'materialized_entities_matched';
  } else if (best.is_default) {
    reason = 'default_connection';
  } else if (best.db_type === 'postgresql') {
    reason = 'postgresql_fallback';
  }

  return {
    connectionId: best.id,
    connectionName: best.name,
    dbType: best.db_type,
    targetSchema: best.target_schema,
    reason,
    matchedEntityCount,
  };
}

module.exports = {
  resolveConnection,
  formatConnectionRow,
};
