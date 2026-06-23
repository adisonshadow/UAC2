// @ts-ignore
import { request } from '@umijs/max';

const BASE = '/api/v1/business-data';

export async function getBusinessDataSchema(options?: Record<string, unknown>) {
  return request<{ code: number; message: string; data: API.BusinessDataSchema }>(`${BASE}/schema`, {
    method: 'GET',
    ...(options || {}),
  });
}

export async function getBusinessDataEntities(params?: {
  codePrefix?: string;
  entityKind?: string;
  page?: number;
  size?: number;
}) {
  return request<{ code: number; message: string; data: API.BusinessDataEntityList }>(`${BASE}/entities`, {
    method: 'GET',
    params,
  });
}

export async function getBusinessDataEntity(id: string) {
  return request<{ code: number; message: string; data: API.BusinessDataEntity }>(`${BASE}/entities/${id}`, {
    method: 'GET',
  });
}

export async function postBusinessDataEntity(body: Partial<API.BusinessDataEntity>) {
  return request<{ code: number; message: string; data: API.BusinessDataEntity }>(`${BASE}/entities`, {
    method: 'POST',
    data: body,
  });
}

export async function patchBusinessDataEntity(id: string, body: Partial<API.BusinessDataEntity>) {
  return request<{ code: number; message: string; data: API.BusinessDataEntity }>(`${BASE}/entities/${id}`, {
    method: 'PATCH',
    data: body,
  });
}

export async function deleteBusinessDataEntity(id: string) {
  return request<{ code: number; message: string; data: null }>(`${BASE}/entities/${id}`, {
    method: 'DELETE',
  });
}

export async function putBusinessDataEntityFields(id: string, fields: API.BusinessDataField[]) {
  return request<{ code: number; message: string; data: API.BusinessDataEntity }>(
    `${BASE}/entities/${id}/fields`,
    { method: 'PUT', data: { fields } },
  );
}

export async function getBusinessDataEnums(params?: { page?: number; size?: number }) {
  return request<{ code: number; message: string; data: { total: number; items: API.BusinessDataEnum[] } }>(
    `${BASE}/enums`,
    { method: 'GET', params },
  );
}

export async function postBusinessDataEnum(body: Partial<API.BusinessDataEnum>) {
  return request<{ code: number; message: string; data: API.BusinessDataEnum }>(`${BASE}/enums`, {
    method: 'POST',
    data: body,
  });
}

export async function patchBusinessDataEnum(id: string, body: Partial<API.BusinessDataEnum>) {
  return request<{ code: number; message: string; data: API.BusinessDataEnum }>(`${BASE}/enums/${id}`, {
    method: 'PATCH',
    data: body,
  });
}

export async function deleteBusinessDataEnum(id: string) {
  return request<{ code: number; message: string; data: null }>(`${BASE}/enums/${id}`, {
    method: 'DELETE',
  });
}

export async function getBusinessDataRelations() {
  return request<{ code: number; message: string; data: API.BusinessDataRelation[] }>(`${BASE}/relations`, {
    method: 'GET',
  });
}

export async function postBusinessDataRelation(body: Partial<API.BusinessDataRelation>) {
  return request<{ code: number; message: string; data: API.BusinessDataRelation }>(`${BASE}/relations`, {
    method: 'POST',
    data: body,
  });
}

export async function deleteBusinessDataRelation(id: string) {
  return request<{ code: number; message: string; data: null }>(`${BASE}/relations/${id}`, {
    method: 'DELETE',
  });
}

export async function postMaterializationPreview(body: {
  entityIds?: string[];
  targetSchema?: string;
}) {
  return request<{ code: number; message: string; data: API.MaterializationPreview }>(
    `${BASE}/materialization/preview`,
    { method: 'POST', data: body },
  );
}

export async function postMaterializationExecute(body: {
  entityIds?: string[];
  targetSchema?: string;
  dryRun?: boolean;
  expectedVersions?: Record<string, number>;
}) {
  return request<{ code: number; message: string; data: API.MaterializationExecuteResult }>(
    `${BASE}/materialization/execute`,
    { method: 'POST', data: body },
  );
}

export async function getMaterializationStatus() {
  return request<{ code: number; message: string; data: API.MaterializationStatusItem[] }>(
    `${BASE}/materialization/status`,
    { method: 'GET' },
  );
}

export async function getMaterializationRuns(params?: { page?: number; size?: number }) {
  return request<{ code: number; message: string; data: API.MaterializationRunList }>(
    `${BASE}/materialization/runs`,
    { method: 'GET', params },
  );
}
