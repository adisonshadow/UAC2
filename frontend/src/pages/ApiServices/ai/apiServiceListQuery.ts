import { getApiService, getApiServices } from '@/services/UAC/api/apiServices';
import { getApiData, parseApiListResponse } from '@/utils/apiResponse';

export interface ApiServiceListQueryArgs {
  codePrefix?: string;
  status?: string;
  tag?: string;
  connectionId?: string;
  page?: number;
  size?: number;
}

export interface ApiServiceListItemView {
  id?: string;
  code?: string;
  name?: string;
  status?: string;
  entityCode?: string;
  scopeCode?: string;
  scriptMode?: string;
  enabledOperations?: string[];
  version?: number;
  publishedAt?: string;
  tags?: string[];
  connection?: { name?: string; dbType?: string };
  statusHint?: string;
}

export interface ApiServiceListToolResult {
  /** 符合 appliedFilters 的总数（来自后端 count，非本页条数） */
  total: number;
  /** 本页实际返回条数 */
  returnedCount: number;
  page?: number;
  hasMore?: boolean;
  items: ApiServiceListItemView[];
  statusSummary: {
    draft: number;
    published: number;
    disabled: number;
  };
  appliedFilters: {
    codePrefix?: string;
    status?: string;
    tag?: string;
    connectionId?: string;
    size: number;
  };
  filterWarning?: string;
  /** 列表 status 与 get_service 回读不一致时记录 */
  statusDriftWarnings?: string[];
  exactMatch?: {
    id?: string;
    code?: string;
    name?: string;
    status?: string;
  } | null;
}

function summarizeStatus(items: ApiServiceListItemView[]) {
  return {
    draft: items.filter((item) => (item.status || 'draft') === 'draft').length,
    published: items.filter((item) => item.status === 'published').length,
    disabled: items.filter((item) => item.status === 'disabled').length,
  };
}

function buildStatusHint(service: API.ApiService): string | undefined {
  const status = service.status || 'draft';
  if (status === 'draft' && service.publishedAt) {
    return '曾发布但因配置更新已回退为 draft，须重新 apiservice_publish_service';
  }
  return undefined;
}

/** 列表/过滤 Tool 回灌用的精简视图（不含 securityConfig、脚本正文等） */
function compactServiceForListTool(service: API.ApiService): ApiServiceListItemView {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    status: service.status,
    entityCode: service.entityCode,
    scopeCode: service.scopeCode,
    scriptMode: service.scriptMode,
    enabledOperations: service.enabledOperations,
    version: service.version,
    publishedAt: service.publishedAt,
    tags: service.tags,
    connection: service.connection
      ? { name: service.connection.name, dbType: service.connection.dbType }
      : undefined,
    statusHint: buildStatusHint(service),
  };
}

/** 对列表每条记录 get_service 回读，以详情 status 为准 */
async function revalidateItemsFromSource(
  items: API.ApiService[],
): Promise<{ items: ApiServiceListItemView[]; statusDriftWarnings: string[] }> {
  const statusDriftWarnings: string[] = [];

  const refreshed = await Promise.all(
    items.map(async (item) => {
      if (!item.id) {
        return compactServiceForListTool(item);
      }
      try {
        const res = await getApiService(item.id);
        const fresh = getApiData<API.ApiService>(res);
        if (!fresh) {
          return compactServiceForListTool(item);
        }
        const listStatus = item.status || 'draft';
        const freshStatus = fresh.status || 'draft';
        if (listStatus !== freshStatus) {
          statusDriftWarnings.push(
            `${item.code}：列表 status=${listStatus}，get_service 回读=${freshStatus}（以回读为准）`,
          );
        }
        return compactServiceForListTool(fresh);
      } catch {
        return compactServiceForListTool(item);
      }
    }),
  );

  return { items: refreshed, statusDriftWarnings };
}

/** AI Tool 统一列表查询：默认 size=-1；逐条 get_service 回读校验 status */
export async function queryApiServicesForTool(
  args: ApiServiceListQueryArgs,
): Promise<ApiServiceListToolResult> {
  const codePrefix = args.codePrefix ? String(args.codePrefix).trim() : undefined;
  const requestedStatus = args.status ? String(args.status).trim().toLowerCase() : undefined;
  const size = args.size ?? -1;
  const page = args.page && args.page > 0 ? args.page : 1;

  const res = await getApiServices({
    codePrefix,
    status: requestedStatus,
    tag: args.tag as string | undefined,
    connectionId: args.connectionId as string | undefined,
    page,
    size,
  });

  const data = getApiData<API.ApiServiceListResult>(res);
  const backendTotal = data?.total ?? parseApiListResponse(res).total ?? 0;
  let items = data?.items ?? parseApiListResponse(res).items;

  const { items: revalidated, statusDriftWarnings } = await revalidateItemsFromSource(items);
  items = revalidated;

  const warnings: string[] = [...statusDriftWarnings];
  if (requestedStatus) {
    const beforeCount = items.length;
    items = items.filter(
      (item) => (item.status || 'draft').toLowerCase() === requestedStatus,
    );
    if (items.length < beforeCount) {
      warnings.push(
        `回读校验后 ${beforeCount - items.length} 条不符合 status=${requestedStatus}，已从结果剔除`,
      );
    }
  }

  const exactMatch =
    codePrefix && codePrefix.includes(':')
      ? items.find((item) => item.code === codePrefix)
      : undefined;

  const filterWarning = warnings.length ? warnings.join('；') : undefined;

  return {
    total: backendTotal,
    returnedCount: items.length,
    page: size === -1 ? undefined : page,
    hasMore: size !== -1 && page * Math.abs(size) < backendTotal,
    items,
    statusSummary: summarizeStatus(items),
    appliedFilters: {
      codePrefix,
      status: requestedStatus,
      tag: args.tag as string | undefined,
      connectionId: args.connectionId as string | undefined,
      size,
    },
    filterWarning,
    statusDriftWarnings: statusDriftWarnings.length ? statusDriftWarnings : undefined,
    exactMatch: exactMatch
      ? {
          id: exactMatch.id,
          code: exactMatch.code,
          name: exactMatch.name,
          status: exactMatch.status,
        }
      : null,
  };
}
