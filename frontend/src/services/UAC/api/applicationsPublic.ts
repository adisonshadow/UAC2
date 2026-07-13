// @ts-ignore
import { request } from '@/utils/request';

export interface ApplicationApiCatalogOperation {
  operation: string;
  httpMethod: string;
  routePattern?: string;
  parametersSchema?: Record<string, unknown>;
  mockParameters?: Record<string, unknown>;
  responseInterface?: string;
  responseSchema?: Record<string, unknown>;
  label?: string;
  category?: string;
}

export interface ApplicationApiCatalogService {
  id: string;
  code: string;
  name?: string;
  description?: string;
  tags?: string[];
  status?: string;
  routePath?: string;
  basePath?: string;
  transportProtocols?: string[];
  entityCode?: string;
  entityLabel?: string;
  version?: number;
  requestParameterInterface?: string;
  operations?: ApplicationApiCatalogOperation[];
}

export interface ApplicationApiCatalogTreeNode {
  code: string;
  name: string;
  isDomainNode?: boolean;
  isApiNode?: boolean;
  serviceCount?: number;
  children?: ApplicationApiCatalogTreeNode[];
}

/** 内置 API 明细（公开目录展示用） */
export interface BuiltinApiCatalogItem {
  code: string;
  domain: string;
  label: string;
  routePath: string;
  httpMethods: string[];
  actions: string[];
  description: string;
}

export interface ApplicationApiCatalogResult {
  application: {
    application_id: string;
    name: string;
    code: string;
    description?: string | null;
    logo_url?: string | null;
  };
  tree: ApplicationApiCatalogTreeNode[];
  services: ApplicationApiCatalogService[];
  builtinApis?: BuiltinApiCatalogItem[];
  builtinApiTree?: ApplicationApiCatalogTreeNode[];
  generatedAt?: string;
}

/** 获取应用可访问 API 目录（公开，无需登录） GET /api/v1/applications-public/${key}/api-catalog */
export async function getApplicationsPublicApiCatalog(
  key: string,
  options?: { skipErrorHandler?: boolean },
) {
  return request<{ code: number; message: string; data: ApplicationApiCatalogResult }>(
    `/api/v1/applications-public/${encodeURIComponent(key)}/api-catalog`,
    {
      method: 'GET',
      skipErrorHandler: options?.skipErrorHandler,
    },
  );
}
