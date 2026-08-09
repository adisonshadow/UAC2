const CODE_SEGMENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** 主操作 → 服务短名 REST 后缀（首字母大写驼峰） */
export const API_SERVICE_OPERATION_SUFFIX: Record<string, string> = {
  find: 'Find',
  findOne: 'FindOne',
  findById: 'FindById',
  create: 'Create',
  insertOne: 'Create',
  updateOne: 'Update',
  updateMany: 'UpdateMany',
  deleteOne: 'Delete',
  deleteMany: 'DeleteMany',
  count: 'Count',
  aggregate: 'Aggregate',
};

export function operationToServiceSuffix(operation?: string): string {
  const op = String(operation || '').trim();
  if (!op) return 'Api';
  if (API_SERVICE_OPERATION_SUFFIX[op]) return API_SERVICE_OPERATION_SUFFIX[op];
  return op.charAt(0).toUpperCase() + op.slice(1);
}

/** 实体 code 最后一段，如 IPS:analytics:Foo → Foo */
export function entityCodeLastSegment(entityCode?: string): string {
  const parts = String(entityCode || '')
    .split(':')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || '';
}

/** 实体 code 去掉最后一段作为 Scope，如 IPS:analytics:Foo → IPS:analytics */
export function scopeCodeFromEntityCode(entityCode?: string): string | undefined {
  const parts = String(entityCode || '')
    .split(':')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return parts[0] || undefined;
  return parts.slice(0, -1).join(':');
}

/**
 * 默认服务短名 = 实体最后一段 + REST 动作后缀
 * 例：entity=IPS:analytics:ActualHoursStats, operation=create → ActualHoursStatsCreate
 */
export function suggestServiceSlugFromEntity(entityCode?: string, operation?: string): string {
  const last = entityCodeLastSegment(entityCode);
  if (!last || !CODE_SEGMENT_RE.test(last)) return '';
  return `${last}${operationToServiceSuffix(operation)}`;
}

/** 与后端 apiServiceDomainUtils.suggestServiceCodeFromEntity 保持一致 */
export function suggestApiServiceCodeFromEntity(entityCode: string, suffix = 'Api'): string {
  const trimmed = String(entityCode || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(':').filter(Boolean);
  if (parts.length < 2) return `${parts[0] || trimmed}:${suffix}`;
  const next = [...parts];
  next[next.length - 1] = `${next[next.length - 1]}${suffix}`;
  return next.join(':');
}

export function normalizeApiServiceCode(
  code: string | undefined,
  options?: { entityCode?: string; scopeCode?: string; fallbackName?: string },
): string {
  const trimmed = String(code || '').trim();
  const segments = trimmed ? trimmed.split(':').filter(Boolean) : [];

  const isValid =
    segments.length >= 2 && segments.every((segment) => CODE_SEGMENT_RE.test(segment));
  if (isValid) return trimmed;

  if (options?.entityCode) {
    const suggested = suggestApiServiceCodeFromEntity(options.entityCode);
    if (suggested && suggested.split(':').length >= 2) return suggested;
  }

  if (segments.length === 1 && CODE_SEGMENT_RE.test(segments[0])) {
    const serviceSegment = options?.fallbackName
      ? toCodeSegment(options.fallbackName)
      : 'Api';
    return `${segments[0]}:${serviceSegment}`;
  }

  if (options?.scopeCode) {
    const scope = String(options.scopeCode).trim();
    const serviceSegment = options?.fallbackName
      ? toCodeSegment(options.fallbackName)
      : 'Api';
    if (scope && CODE_SEGMENT_RE.test(scope.split(':')[0])) {
      return `${scope.split(':')[0]}:${serviceSegment}`;
    }
  }

  throw new Error(
    'code 至少包含两段（域:服务名），例如 equipment:DeviceApi。请基于实体 code 生成，勿直接使用单段 Scope code。',
  );
}

function toCodeSegment(name: string): string {
  const ascii = String(name || '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (ascii && CODE_SEGMENT_RE.test(ascii)) return ascii;
  return 'Api';
}

export function validateApiServiceCode(code: string): void {
  const segments = String(code || '').trim().split(':');
  if (segments.length < 2) {
    throw new Error('code 至少包含两段：域:服务名');
  }
  segments.forEach((segment) => {
    if (!CODE_SEGMENT_RE.test(segment)) {
      throw new Error(`code 段 "${segment}" 格式无效，须为字母开头且仅含字母数字下划线`);
    }
  });
}
