import { getApiService, getApiServices } from '@/services/UAC/api/apiServices';
import { getApiData } from '@/utils/apiResponse';

export interface ApiServiceVerification {
  verified: boolean;
  id: string;
  code: string;
  name?: string;
  status?: string;
  routePath?: string;
  entityCode?: string;
}

/** 创建/发布后回读服务，供 AI Tool 返回与 Skill 校验 */
export async function verifyApiServiceById(
  serviceId: string,
  expectedCode?: string,
): Promise<ApiServiceVerification> {
  const res = await getApiService(serviceId);
  const data = getApiData<API.ApiService>(res);
  if (!data?.id) {
    throw new Error(
      `校验失败：服务 ${expectedCode || serviceId} 在系统中不存在，请勿向用户声称创建/发布成功`,
    );
  }
  if (expectedCode && data.code !== expectedCode) {
    throw new Error(
      `校验失败：期望 code=${expectedCode}，实际为 ${data.code}`,
    );
  }
  return {
    verified: true,
    id: data.id,
    code: data.code || expectedCode || serviceId,
    name: data.name,
    status: data.status,
    routePath: data.routePath,
    entityCode: data.entityCode,
  };
}

/** 按 code 在列表中确认服务可见（与列表页同源） */
export async function verifyApiServiceListed(code: string): Promise<ApiServiceVerification> {
  const res = await getApiServices({ codePrefix: code, size: -1 });
  const data = getApiData<API.ApiServiceListResult>(res);
  const exact = data?.items?.find((item) => item.code === code);
  if (!exact?.id) {
    throw new Error(
      `校验失败：列表中未找到 code=${code} 的 API 服务，请勿声称创建成功`,
    );
  }
  return {
    verified: true,
    id: exact.id,
    code: exact.code || code,
    name: exact.name,
    status: exact.status,
    routePath: exact.routePath,
    entityCode: exact.entityCode,
  };
}
