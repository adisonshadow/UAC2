import { getDatabaseConnections, getMaterializationStatus } from '@/services/UAC/api/businessData';
import { getApiData } from '@/utils/apiResponse';

export interface ResolveApiServiceConnectionOptions {
  connectionId?: string;
  scopeCode?: string;
  entityCodes?: string[];
  entityIds?: string[];
}

export interface ResolvedApiServiceConnection {
  connectionId: string;
  connectionName?: string;
  dbType?: string;
  targetSchema?: string;
  reason: string;
  matchedEntityCount?: number;
  alternatives?: Array<{ connectionId: string; connectionName?: string; matchedEntityCount: number }>;
}

function entityMatchesScope(code: string | undefined, scopePrefixes: string[]): boolean {
  if (!code || !scopePrefixes.length) return false;
  return scopePrefixes.some((prefix) => code === prefix || code.startsWith(`${prefix}:`));
}

function entityMatchesFilter(
  item: API.MaterializationStatusItem,
  options: ResolveApiServiceConnectionOptions,
  scopePrefixes: string[],
): boolean {
  // 主实体 ID 精确匹配优先
  if (options.entityIds?.length) {
    return options.entityIds.includes(String(item.entityId));
  }
  if (options.entityCodes?.length) {
    const codes = new Set(options.entityCodes.map(String));
    return Boolean(item.code && (codes.has(item.code) || entityMatchesScope(item.code, scopePrefixes)));
  }
  if (scopePrefixes.length) {
    return entityMatchesScope(item.code, scopePrefixes);
  }
  return true;
}

function scoreConnections(
  statusItems: API.MaterializationStatusItem[],
  options: ResolveApiServiceConnectionOptions,
  scopePrefixes: string[],
): Map<string, number> {
  const scores = new Map<string, number>();
  statusItems.forEach((item) => {
    if (!item.connectionId || item.staleStatus === 'not_materialized') return;
    if (!entityMatchesFilter(item, options, scopePrefixes)) return;
    scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
  });
  return scores;
}

function pickBestConnection(
  connections: API.DatabaseConnection[],
  scores: Map<string, number>,
): API.DatabaseConnection | undefined {
  if (!connections.length) return undefined;

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return (
      connections.find((c) => c.isDefault && c.dbType === 'postgresql') ||
      connections.find((c) => c.isDefault) ||
      connections.find((c) => c.dbType === 'postgresql') ||
      connections[0]
    );
  }

  const topScore = ranked[0][1];
  const candidates = ranked.filter(([, score]) => score === topScore).map(([id]) => id);
  const connById = new Map(connections.map((c) => [c.id!, c]));

  return (
    candidates
      .map((id) => connById.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.isDefault !== b!.isDefault) return a!.isDefault ? -1 : 1;
        if (a!.dbType === 'postgresql' && b!.dbType !== 'postgresql') return -1;
        if (b!.dbType === 'postgresql' && a!.dbType !== 'postgresql') return 1;
        return 0;
      })[0] || connById.get(ranked[0][0])
  );
}

function pickTargetSchema(
  best: API.DatabaseConnection,
  statusItems: API.MaterializationStatusItem[],
  options: ResolveApiServiceConnectionOptions,
): string | undefined {
  const scopePrefixes = options.scopeCode?.trim() ? [options.scopeCode.trim()] : [];
  const hasEntityHint = Boolean(options.entityIds?.length || options.entityCodes?.length);
  const matched = statusItems.find((item) => {
    if (String(item.connectionId) !== String(best.id) || !item.targetSchema) return false;
    if (item.staleStatus === 'not_materialized') return false;
    if (options.entityIds?.length) {
      return options.entityIds.includes(String(item.entityId));
    }
    if (options.entityCodes?.length) {
      return Boolean(item.code && options.entityCodes.includes(item.code));
    }
    if (scopePrefixes.length) {
      return entityMatchesScope(item.code, scopePrefixes);
    }
    return true;
  });
  if (matched?.targetSchema) return matched.targetSchema;
  // 有主实体/Scope 时禁止回落到连接默认 schema（常为过时的 bizdata_mat）
  if (hasEntityHint || scopePrefixes.length) return undefined;
  return best.targetSchema;
}

export async function resolveApiServiceConnection(
  options: ResolveApiServiceConnectionOptions = {},
): Promise<ResolvedApiServiceConnection> {
  const explicitId = options.connectionId?.trim();
  const [connRes, statusRes] = await Promise.all([
    getDatabaseConnections(),
    getMaterializationStatus(),
  ]);

  const connections = getApiData<API.DatabaseConnection[]>(connRes) || [];
  if (!Array.isArray(connections) || !connections.length) {
    throw new Error('系统未配置任何数据库连接，请先在业务数据模块添加连接');
  }

  const scopePrefixes = options.scopeCode?.trim() ? [options.scopeCode.trim()] : [];
  const statusItems = getApiData<API.MaterializationStatusItem[]>(statusRes) || [];

  if (explicitId) {
    const conn = connections.find((c) => c.id === explicitId);
    if (!conn) throw new Error(`数据库连接 ${explicitId} 不存在`);
    return {
      connectionId: conn.id!,
      connectionName: conn.name,
      dbType: conn.dbType,
      // 显式连接仍按主实体物化记录取 schema，避免回落到连接默认 bizdata_mat
      targetSchema: pickTargetSchema(conn, statusItems, options),
      reason: 'explicit_connection_id',
    };
  }

  if (connections.length === 1) {
    const conn = connections[0];
    const targetSchema = pickTargetSchema(conn, statusItems, options);
    let reason = 'single_available_connection';
    let matchedEntityCount = 0;
    if (options.entityIds?.length || options.entityCodes?.length) {
      const hit = statusItems.some((item) => {
        if (String(item.connectionId) !== String(conn.id) || !item.targetSchema) return false;
        if (item.staleStatus === 'not_materialized') return false;
        if (options.entityIds?.length) return options.entityIds.includes(String(item.entityId));
        return Boolean(item.code && options.entityCodes!.includes(item.code));
      });
      if (hit) {
        reason = 'materialized_primary_entity';
        matchedEntityCount = 1;
      }
    } else if (scopePrefixes.length) {
      const hit = statusItems.some(
        (item) =>
          String(item.connectionId) === String(conn.id) &&
          item.targetSchema &&
          item.staleStatus !== 'not_materialized' &&
          entityMatchesScope(item.code, scopePrefixes),
      );
      if (hit) {
        reason = 'materialized_entities_in_scope';
        matchedEntityCount = 1;
      }
    }
    return {
      connectionId: conn.id!,
      connectionName: conn.name,
      dbType: conn.dbType,
      targetSchema,
      reason,
      matchedEntityCount,
    };
  }

  const scores = scoreConnections(statusItems, options, scopePrefixes);
  const best = pickBestConnection(connections, scores);

  if (!best?.id) {
    throw new Error('无法根据主实体/Scope 物化记录推断数据库连接');
  }

  const matchedEntityCount = scores.get(best.id) || 0;
  const alternatives = [...scores.entries()]
    .filter(([id]) => id !== best.id)
    .map(([connectionId, count]) => {
      const conn = connections.find((c) => c.id === connectionId);
      return { connectionId, connectionName: conn?.name, matchedEntityCount: count };
    })
    .sort((a, b) => b.matchedEntityCount - a.matchedEntityCount);

  let reason = 'default_or_fallback_connection';
  if (matchedEntityCount > 0) {
    if (options.entityIds?.length || options.entityCodes?.length) {
      reason = 'materialized_primary_entity';
    } else if (scopePrefixes.length) {
      reason = 'materialized_entities_in_scope';
    } else {
      reason = 'materialized_entities_matched';
    }
  } else if (best.isDefault) {
    reason = 'default_connection';
  } else if (best.dbType === 'postgresql') {
    reason = 'postgresql_fallback';
  }

  return {
    connectionId: best.id,
    connectionName: best.name,
    dbType: best.dbType,
    targetSchema: pickTargetSchema(best, statusItems, options),
    reason,
    matchedEntityCount,
    alternatives: alternatives.length ? alternatives : undefined,
  };
}
