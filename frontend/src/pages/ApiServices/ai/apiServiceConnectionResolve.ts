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

function normalizeCodes(options: ResolveApiServiceConnectionOptions): string[] {
  const codes = new Set<string>();
  options.entityCodes?.forEach((code) => {
    const trimmed = String(code).trim();
    if (trimmed) codes.add(trimmed);
  });
  const scope = options.scopeCode?.trim();
  if (scope) codes.add(scope);
  return [...codes];
}

function entityMatchesScope(code: string | undefined, scopePrefixes: string[]): boolean {
  if (!code) return false;
  return scopePrefixes.some((prefix) => code === prefix || code.startsWith(`${prefix}:`));
}

function entityMatchesFilter(
  item: API.MaterializationStatusItem,
  options: ResolveApiServiceConnectionOptions,
  scopePrefixes: string[],
): boolean {
  if (options.entityIds?.length) {
    return options.entityIds.includes(String(item.entityId));
  }
  if (scopePrefixes.length || options.entityCodes?.length) {
    return entityMatchesScope(item.code, scopePrefixes) || (item.code ? scopePrefixes.includes(item.code) : false);
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

  if (explicitId) {
    const conn = connections.find((c) => c.id === explicitId);
    if (!conn) throw new Error(`数据库连接 ${explicitId} 不存在`);
    return {
      connectionId: conn.id!,
      connectionName: conn.name,
      dbType: conn.dbType,
      targetSchema: conn.targetSchema,
      reason: 'explicit_connection_id',
    };
  }

  if (connections.length === 1) {
    const conn = connections[0];
    return {
      connectionId: conn.id!,
      connectionName: conn.name,
      dbType: conn.dbType,
      targetSchema: conn.targetSchema,
      reason: 'single_available_connection',
    };
  }

  const scopePrefixes = normalizeCodes(options);
  const statusItems = getApiData<API.MaterializationStatusItem[]>(statusRes) || [];
  const scores = scoreConnections(statusItems, options, scopePrefixes);
  const best = pickBestConnection(connections, scores);

  if (!best?.id) {
    throw new Error('无法推断数据库连接');
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
    reason = scopePrefixes.length
      ? 'materialized_entities_in_scope'
      : 'materialized_entities_matched';
  } else if (best.isDefault) {
    reason = 'default_connection';
  } else if (best.dbType === 'postgresql') {
    reason = 'postgresql_fallback';
  }

  return {
    connectionId: best.id,
    connectionName: best.name,
    dbType: best.dbType,
    targetSchema: best.targetSchema,
    reason,
    matchedEntityCount,
    alternatives: alternatives.length ? alternatives : undefined,
  };
}
