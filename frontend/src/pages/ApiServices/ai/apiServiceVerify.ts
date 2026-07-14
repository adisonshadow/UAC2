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
  message?: string;
}

export interface VerifyApiServiceOptions {
  expectedCode?: string;
  /** 指定时期望的 status；不满足时 verified=false */
  expectedStatus?: 'draft' | 'published' | 'disabled';
}

function buildVerificationMessage(
  data: API.ApiService,
  options?: VerifyApiServiceOptions,
): string {
  const code = data.code || options?.expectedCode || data.id || '';
  if (options?.expectedStatus) {
    if (data.status === options.expectedStatus) {
      return `已验证「${code}」status=${data.status}`;
    }
    return `校验失败：期望 status=${options.expectedStatus}，实际为 ${data.status ?? '未知'}`;
  }
  return `已验证「${code}」存在（status=${data.status ?? '未知'}）`;
}

/** 创建/发布后回读服务，供 AI Tool 返回与 Skill 校验 */
export async function verifyApiServiceById(
  serviceId: string,
  options?: VerifyApiServiceOptions | string,
): Promise<ApiServiceVerification> {
  const opts: VerifyApiServiceOptions =
    typeof options === 'string' ? { expectedCode: options } : options || {};

  const res = await getApiService(serviceId);
  const data = getApiData<API.ApiService>(res);
  if (!data?.id) {
    throw new Error(
      `校验失败：服务 ${opts.expectedCode || serviceId} 在系统中不存在，请勿向用户声称创建/发布成功`,
    );
  }
  if (opts.expectedCode && data.code !== opts.expectedCode) {
    throw new Error(`校验失败：期望 code=${opts.expectedCode}，实际为 ${data.code}`);
  }

  const statusOk =
    !opts.expectedStatus || data.status === opts.expectedStatus;

  return {
    verified: statusOk,
    id: data.id,
    code: data.code || opts.expectedCode || serviceId,
    name: data.name,
    status: data.status,
    routePath: data.routePath,
    entityCode: data.entityCode,
    message: buildVerificationMessage(data, opts),
  };
}

/** 按 code 在列表中确认服务可见（与列表页同源） */
export async function verifyApiServiceListed(
  code: string,
  options?: Pick<VerifyApiServiceOptions, 'expectedStatus'>,
): Promise<ApiServiceVerification> {
  const res = await getApiServices({ codePrefix: code, size: -1 });
  const data = getApiData<API.ApiServiceListResult>(res);
  const exact = data?.items?.find((item) => item.code === code);
  if (!exact?.id) {
    throw new Error(
      `校验失败：列表中未找到 code=${code} 的 API 服务，请勿声称创建成功`,
    );
  }

  const statusOk =
    !options?.expectedStatus || exact.status === options.expectedStatus;

  return {
    verified: statusOk,
    id: exact.id,
    code: exact.code || code,
    name: exact.name,
    status: exact.status,
    routePath: exact.routePath,
    entityCode: exact.entityCode,
    message: statusOk
      ? `列表中已确认「${exact.code}」status=${exact.status ?? '未知'}`
      : `列表校验失败：「${exact.code}」status=${exact.status ?? '未知'}，期望 ${options?.expectedStatus}`,
  };
}

/** 发布专用：回读并强制 status=published */
export async function verifyApiServicePublished(
  serviceId: string,
  expectedCode?: string,
): Promise<ApiServiceVerification> {
  const verified = await verifyApiServiceById(serviceId, {
    expectedCode,
    expectedStatus: 'published',
  });
  if (!verified.verified) {
    throw new Error(
      verified.message ||
        `发布校验失败：期望 status=published，实际为 ${verified.status ?? '未知'}`,
    );
  }
  return verified;
}
