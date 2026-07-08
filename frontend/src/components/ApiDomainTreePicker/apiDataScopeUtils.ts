import type { APIDataScopePayload } from './types';

/** 从 api_data_scope 解析出 Tree 勾选 keys（域 code + 可选 API service code） */
export function parseApiDataScopeValue(scope: unknown): string[] {
  if (!scope) return [];
  if (Array.isArray(scope)) {
    return scope.map(String).filter(Boolean);
  }
  if (typeof scope === 'object') {
    const record = scope as Record<string, unknown>;
    const domainCodes = Array.isArray(record.domainCodes)
      ? record.domainCodes.map(String).filter(Boolean)
      : [];
    const serviceCodes = Array.isArray(record.serviceCodes)
      ? record.serviceCodes.map(String).filter(Boolean)
      : [];
    if (domainCodes.length || serviceCodes.length) {
      return [...domainCodes, ...serviceCodes];
    }
    // 兼容旧版 { "apiCode": true | permission } 结构
    return Object.keys(record).filter((key) => record[key] != null && record[key] !== false);
  }
  return [];
}

/** 将 Tree 勾选 keys 序列化为 api_data_scope */
export function buildApiDataScopePayload(
  checkedKeys: string[],
  domainCodes: Set<string>,
): APIDataScopePayload {
  const domains: string[] = [];
  const services: string[] = [];
  checkedKeys.forEach((key) => {
    if (domainCodes.has(key)) {
      domains.push(key);
    } else {
      services.push(key);
    }
  });
  return {
    domainCodes: domains,
    ...(services.length ? { serviceCodes: services } : {}),
  };
}
