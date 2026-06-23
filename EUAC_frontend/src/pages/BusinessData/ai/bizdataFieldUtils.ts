import { getBusinessDataEntities, getBusinessDataEntity } from '@/services/UAC/api/businessData';
import { getApiData, parseApiListResponse } from '@/utils/apiResponse';

/** 将 AI 常见字段写法规范化为 API 结构 */
export function normalizeBizDataField(raw: Record<string, unknown>, index = 0): API.BusinessDataField {
  const fieldKey = String(raw.fieldKey || raw.field_key || raw.name || raw.key || '').trim();
  if (!fieldKey) {
    throw new Error(`fields[${index}] 缺少 fieldKey/name`);
  }

  const columnInfo = { ...((raw.columnInfo || raw.column_info || {}) as Record<string, unknown>) };
  if (raw.label && columnInfo.label == null) {
    columnInfo.label = raw.label;
  }

  const rawTypeorm = (raw.typeormConfig || raw.typeorm_config || {}) as Record<string, unknown>;
  const typeormConfig: Record<string, unknown> = {
    ...rawTypeorm,
    type: rawTypeorm.type || raw.type || 'varchar',
  };
  if (raw.length != null && typeormConfig.length == null) {
    typeormConfig.length = raw.length;
  }
  if (raw.nullable != null && typeormConfig.nullable == null) {
    typeormConfig.nullable = raw.nullable;
  }
  if (raw.unique != null && typeormConfig.unique == null) {
    typeormConfig.unique = raw.unique;
  }
  if (raw.primary != null && typeormConfig.primary == null) {
    typeormConfig.primary = raw.primary;
  }
  if (typeormConfig.nullable === undefined) {
    typeormConfig.nullable = true;
  }

  return {
    fieldKey,
    columnInfo,
    typeormConfig,
    sortOrder: (raw.sortOrder ?? raw.sort_order ?? index) as number,
  };
}

/** 默认合并已有字段，避免 AI 只传新增字段时覆盖清空 */
export function mergeEntityFields(
  existing: API.BusinessDataField[],
  incoming: API.BusinessDataField[],
  replace = false,
): API.BusinessDataField[] {
  if (replace) {
    return incoming.map((field, index) => ({
      ...field,
      sortOrder: field.sortOrder ?? index,
    }));
  }

  const map = new Map<string, API.BusinessDataField>();
  existing.forEach((field, index) => {
    if (field.fieldKey) {
      map.set(field.fieldKey, { ...field, sortOrder: field.sortOrder ?? index });
    }
  });

  incoming.forEach((field, index) => {
    if (!field.fieldKey) return;
    const prev = map.get(field.fieldKey);
    map.set(field.fieldKey, {
      ...prev,
      ...field,
      columnInfo: { ...prev?.columnInfo, ...field.columnInfo },
      typeormConfig: { ...prev?.typeormConfig, ...field.typeormConfig },
      sortOrder: field.sortOrder ?? prev?.sortOrder ?? map.size + index,
    });
  });

  return Array.from(map.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function resolveBizDataEntityId(args: Record<string, unknown>): Promise<string> {
  if (args.entityId) {
    return String(args.entityId);
  }

  const entityCode = args.entityCode ? String(args.entityCode).trim() : '';
  if (!entityCode) {
    throw new Error('缺少 entityId 或 entityCode');
  }

  const res = await getBusinessDataEntities({ codePrefix: entityCode, size: 100 });
  const listData = getApiData<{ items?: API.BusinessDataEntity[] }>(res);
  const items = listData?.items ?? parseApiListResponse<API.BusinessDataEntity>(res).items;
  const entity = items.find((item) => item.code === entityCode) || items[0];
  if (!entity?.id) {
    throw new Error(`找不到实体: ${entityCode}`);
  }
  return entity.id;
}

export async function loadEntityFields(entityId: string): Promise<API.BusinessDataField[]> {
  const res = await getBusinessDataEntity(entityId);
  const entity = getApiData<API.BusinessDataEntity>(res);
  return entity?.fields || [];
}
