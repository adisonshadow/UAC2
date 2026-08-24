import { scopeCodeFromEntityCode } from './apiServiceCodeUtils';

export interface ConnectionResolveHints {
  connectionId?: string;
  scopeCode?: string;
  entityCodes?: string[];
  entityIds?: string[];
}

export interface ConnectionLike {
  id?: string;
  name?: string;
  dbType?: string;
  targetSchema?: string;
  isDefault?: boolean;
}

export interface MaterializationLike {
  connectionId?: string;
  entityId?: string;
  code?: string;
  targetSchema?: string;
  staleStatus?: string;
}

export function entityMatchesScope(code: string | undefined, scopePrefixes: string[]): boolean {
  if (!code || !scopePrefixes.length) return false;
  return scopePrefixes.some((prefix) => code === prefix || code.startsWith(`${prefix}:`));
}

/** 显式 scopeCode + 从 entityCodes 推导的域前缀（去重） */
export function deriveScopePrefixes(options: ConnectionResolveHints = {}): string[] {
  const prefixes: string[] = [];
  const explicit = options.scopeCode?.trim();
  if (explicit) prefixes.push(explicit);
  for (const code of options.entityCodes || []) {
    const derived = scopeCodeFromEntityCode(code);
    if (derived && !prefixes.includes(derived)) prefixes.push(derived);
  }
  return prefixes;
}

function isUsableMaterialization(item: MaterializationLike, connectionId?: string): boolean {
  if (!item.targetSchema || item.staleStatus === 'not_materialized') return false;
  if (connectionId && String(item.connectionId) !== String(connectionId)) return false;
  return true;
}

function scoreBy(
  statusItems: MaterializationLike[],
  predicate: (item: MaterializationLike) => boolean,
): Map<string, number> {
  const scores = new Map<string, number>();
  statusItems.forEach((item) => {
    if (!item.connectionId || !isUsableMaterialization(item)) return;
    if (!predicate(item)) return;
    scores.set(item.connectionId, (scores.get(item.connectionId) || 0) + 1);
  });
  return scores;
}

function hasExactEntityPredicate(options: ConnectionResolveHints): boolean {
  return Boolean(options.entityIds?.length || options.entityCodes?.length);
}

function matchesExactEntity(item: MaterializationLike, options: ConnectionResolveHints): boolean {
  if (options.entityIds?.length && options.entityIds.includes(String(item.entityId))) return true;
  if (options.entityCodes?.length && item.code && options.entityCodes.includes(item.code)) return true;
  return false;
}

/**
 * 精确实体命中优先；若新实体尚未物化，再按同 Scope 已物化兄弟计分。
 */
export function scoreConnections(
  statusItems: MaterializationLike[],
  options: ConnectionResolveHints,
  scopePrefixes: string[] = deriveScopePrefixes(options),
): Map<string, number> {
  if (hasExactEntityPredicate(options)) {
    const exact = scoreBy(statusItems, (item) => matchesExactEntity(item, options));
    if (exact.size) return exact;
  }
  if (scopePrefixes.length) {
    return scoreBy(statusItems, (item) => entityMatchesScope(item.code, scopePrefixes));
  }
  return new Map();
}

export function pickBestConnection<T extends ConnectionLike>(
  connections: T[],
  scores: Map<string, number>,
): T | undefined {
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

export type SchemaMatchKind = 'exact' | 'scope' | 'connection_default' | 'none';

export interface SchemaMatch {
  targetSchema?: string;
  match: SchemaMatchKind;
}

/**
 * 取 targetSchema：精确实体 → 同域已物化兄弟 →（无实体/Scope 提示时）连接默认。
 * 有实体或 Scope 时禁止回落到连接默认 schema（常为过时的 bizdata_mat）。
 */
export function matchTargetSchema(
  best: ConnectionLike,
  statusItems: MaterializationLike[],
  options: ConnectionResolveHints = {},
): SchemaMatch {
  const connectionId = best?.id;
  if (!connectionId) return { match: 'none' };

  const scopePrefixes = deriveScopePrefixes(options);
  const usable = (statusItems || []).filter((item) => isUsableMaterialization(item, connectionId));

  if (options.entityIds?.length) {
    const hit = usable.find((item) => options.entityIds!.includes(String(item.entityId)));
    if (hit?.targetSchema) return { targetSchema: hit.targetSchema, match: 'exact' };
  }
  if (options.entityCodes?.length) {
    const codes = new Set(options.entityCodes.map(String));
    const hit = usable.find((item) => item.code && codes.has(item.code));
    if (hit?.targetSchema) return { targetSchema: hit.targetSchema, match: 'exact' };
  }
  if (scopePrefixes.length) {
    const hit = usable.find((item) => entityMatchesScope(item.code, scopePrefixes));
    if (hit?.targetSchema) return { targetSchema: hit.targetSchema, match: 'scope' };
  }

  const hasEntityHint = Boolean(options.entityIds?.length || options.entityCodes?.length);
  if (hasEntityHint || scopePrefixes.length) return { match: 'none' };
  if (best.targetSchema) return { targetSchema: best.targetSchema, match: 'connection_default' };
  return { match: 'none' };
}

export function pickTargetSchema(
  best: ConnectionLike,
  statusItems: MaterializationLike[],
  options: ConnectionResolveHints = {},
): string | undefined {
  return matchTargetSchema(best, statusItems, options).targetSchema;
}

export function schemaMatchToReason(
  match: SchemaMatchKind,
  options: ConnectionResolveHints,
  fallback: string,
): string {
  if (match === 'exact') return 'materialized_primary_entity';
  if (match === 'scope') return 'materialized_entities_in_scope';
  if (match === 'connection_default') return fallback;
  return fallback;
}
