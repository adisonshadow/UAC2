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
    // 主实体 ID 精确匹配时优先，不再用 Scope 二次过滤
    if (entityIdSet) {
      if (!entityIdSet.has(String(item.entityId))) return;
      scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
      return;
    }
    if (entityCodeSet) {
      if (!item.code || (!entityCodeSet.has(item.code) && !entityMatchesScope(item.code, scopePrefix))) {
        return;
      }
      scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
      return;
    }
    if (scopePrefix && item.code && !entityMatchesScope(item.code, scopePrefix)) return;
    scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
  });
  return scores;
}

function pickTargetSchema(best, statusItems, { entityId, entityCodes, scopeCode } = {}) {
  const connectionId = best?.id;
  if (!connectionId) return undefined;
  const idSet = entityId ? new Set([String(entityId)]) : null;
  const codeSet = Array.isArray(entityCodes) && entityCodes.length
    ? new Set(entityCodes.map(String))
    : null;
  const scopePrefix = scopeCode?.trim() || '';
  const hasEntityHint = Boolean(idSet || codeSet);
  const matched = (statusItems || []).find((item) => {
    if (String(item.connectionId) !== String(connectionId)) return false;
    if (!item.targetSchema) return false;
    if (item.staleStatus === 'not_materialized') return false;
    if (idSet) return idSet.has(String(item.entityId));
    if (codeSet) return item.code && codeSet.has(item.code);
    if (scopePrefix) return entityMatchesScope(item.code, scopePrefix);
    return Boolean(item.targetSchema);
  });
  if (matched?.targetSchema) return matched.targetSchema;
  // 有主实体/Scope 时禁止回落到连接默认 schema（常为过时的 bizdata_mat）
  if (hasEntityHint || scopePrefix) return undefined;
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
  entityCodes,
} = {}) {
  const explicitId = connectionId?.trim();
  const connections = await BizdataDatabaseConnection.findAll({ order: [['name', 'ASC']] });
  if (!connections.length) {
    throw Object.assign(new Error('系统未配置任何数据库连接，请先在业务数据模块添加连接'), { status: 400 });
  }

  // 物化状态用于推断 targetSchema（即使只有一个连接，也不能直接用连接默认 schema）
  const statusItems = await materializationService.getMaterializationStatus({});
  const pickOpts = { entityId, entityCodes, scopeCode };

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
    let reason = 'single_available_connection';
    let matchedEntityCount = 0;
    if (entityId || (Array.isArray(entityCodes) && entityCodes.length)) {
      const hit = statusItems.some((item) => {
        if (String(item.connectionId) !== String(conn.id) || !item.targetSchema) return false;
        if (item.staleStatus === 'not_materialized') return false;
        if (entityId) return String(item.entityId) === String(entityId);
        return item.code && entityCodes.includes(item.code);
      });
      if (hit) {
        reason = 'materialized_primary_entity';
        matchedEntityCount = 1;
      }
    } else if (scopeCode?.trim()) {
      const hit = statusItems.some((item) => (
        String(item.connectionId) === String(conn.id)
        && item.targetSchema
        && item.staleStatus !== 'not_materialized'
        && entityMatchesScope(item.code, scopeCode.trim())
      ));
      if (hit) {
        reason = 'materialized_entities_in_scope';
        matchedEntityCount = 1;
      }
    }
    return {
      connectionId: conn.id,
      connectionName: conn.name,
      dbType: conn.db_type,
      targetSchema,
      reason,
      matchedEntityCount,
    };
  }

  const scores = scoreConnections(statusItems, { scopeCode, entityId, entityCodes });
  const best = pickBestConnection(connections, scores);
  if (!best?.id) {
    throw Object.assign(new Error('无法根据主实体/Scope 物化记录推断数据库连接'), { status: 400 });
  }

  const matchedEntityCount = scores.get(best.id) || 0;
  let reason = 'default_or_fallback_connection';
  if (matchedEntityCount > 0) {
    if (entityId || (Array.isArray(entityCodes) && entityCodes.length)) {
      reason = 'materialized_primary_entity';
    } else if (scopeCode) {
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
    targetSchema: pickTargetSchema(best, statusItems, pickOpts),
    reason,
    matchedEntityCount,
  };
}

module.exports = {
  resolveConnection,
  formatConnectionRow,
};
