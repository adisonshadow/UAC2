/** 关系图谱查询：供 AI Tool 与页面共用的纯数据构建 */

export function firstLevelScope(code?: string): string {
  const parts = String(code || '')
    .split(':')
    .filter(Boolean);
  return parts[0] || '';
}

export function relationCardinalityLabel(type?: string): string {
  const raw = String(type || '').trim();
  if (!raw) return '?';
  const normalized = raw
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();

  switch (normalized) {
    case 'one_to_one':
    case 'onetoone':
    case 'has_one':
    case 'hasone':
      return '1:1';
    case 'one_to_many':
    case 'onetomany':
    case 'has_many':
    case 'hasmany':
      return '1:N';
    case 'many_to_one':
    case 'manytoone':
    case 'belongs_to':
    case 'belongsto':
      return 'N:1';
    case 'many_to_many':
    case 'manytomany':
      return 'N:N';
    case 'self_referencing':
    case 'selfreferencing':
      return '1:N';
    default:
      return raw;
  }
}

export type RelationGraphNode = {
  entityId: string;
  entityCode: string;
  label: string;
  scope: string;
};

export type RelationGraphEdge = {
  relationId?: string;
  type?: string;
  cardinality: string;
  name?: string;
  fromEntityId?: string;
  toEntityId?: string;
  fromEntityCode?: string;
  toEntityCode?: string;
  directionSummary: string;
};

export type RelationGraphQueryResult = {
  scope: string | null;
  codePrefix: string | null;
  availableScopes: string[];
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  /** 无任何关系边的实体（便于发现建模缺口） */
  orphanNodes: RelationGraphNode[];
};

function entityShortLabel(entity: API.BusinessDataEntity): string {
  if (entity.label) return entity.label;
  const parts = String(entity.code || '').split(':');
  return parts[parts.length - 1] || entity.code || entity.id || '';
}

/**
 * @param scope 一级 Scope（code 第一段），与关系图谱页一致；如 IPS
 * @param codePrefix 可选更细前缀，如 IPS:bom；与 scope 同时传时取交集
 */
export function buildRelationGraphQuery(
  entities: API.BusinessDataEntity[],
  relations: API.BusinessDataRelation[],
  options?: { scope?: string; codePrefix?: string },
): RelationGraphQueryResult {
  const scopeFilter = options?.scope?.trim() || null;
  const codePrefix = options?.codePrefix?.trim() || null;

  const erEntities = entities.filter((e) => e.entityKind !== 'json_schema' && e.id && e.code);

  const availableScopes = [
    ...new Set(erEntities.map((e) => firstLevelScope(e.code)).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  let filtered = erEntities;
  if (scopeFilter) {
    filtered = filtered.filter((e) => firstLevelScope(e.code) === scopeFilter);
  }
  if (codePrefix) {
    filtered = filtered.filter((e) => String(e.code).startsWith(codePrefix));
  }

  const idSet = new Set(filtered.map((e) => e.id!));
  const codeById = new Map(filtered.map((e) => [e.id!, e.code!]));

  const nodes: RelationGraphNode[] = filtered.map((e) => ({
    entityId: e.id!,
    entityCode: e.code!,
    label: entityShortLabel(e),
    scope: firstLevelScope(e.code),
  }));

  const edges: RelationGraphEdge[] = relations
    .filter(
      (r) =>
        r.fromEntityId &&
        r.toEntityId &&
        idSet.has(r.fromEntityId) &&
        idSet.has(r.toEntityId) &&
        r.fromEntityId !== r.toEntityId,
    )
    .map((r) => {
      const fromEntityCode =
        r.fromEntityCode || r.fromEntity?.code || codeById.get(r.fromEntityId!) || r.fromEntityId!;
      const toEntityCode =
        r.toEntityCode || r.toEntity?.code || codeById.get(r.toEntityId!) || r.toEntityId!;
      const type = r.type;
      const cardinality = relationCardinalityLabel(type);
      return {
        relationId: r.id,
        type,
        cardinality,
        name: r.name,
        fromEntityId: r.fromEntityId,
        toEntityId: r.toEntityId,
        fromEntityCode,
        toEntityCode,
        directionSummary:
          r.directionSummary ||
          `${fromEntityCode} --${type}--> ${toEntityCode} (name=${r.name})`,
      };
    });

  const connected = new Set<string>();
  edges.forEach((e) => {
    if (e.fromEntityId) connected.add(e.fromEntityId);
    if (e.toEntityId) connected.add(e.toEntityId);
  });
  const orphanNodes = nodes.filter((n) => !connected.has(n.entityId));

  return {
    scope: scopeFilter,
    codePrefix,
    availableScopes,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    orphanCount: orphanNodes.length,
    nodes,
    edges,
    orphanNodes,
  };
}
