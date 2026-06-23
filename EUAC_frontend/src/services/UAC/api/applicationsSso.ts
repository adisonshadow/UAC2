// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

/** 获取SSO应用信息 获取指定应用的SSO配置信息，用于SSO登录流程 GET /api/v1/applications-sso/${param0} */
export async function getApplicationsSsoId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getApplicationsSsoIdParams,
  options?: { [key: string]: any },
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: {
      application_id?: string;
      name?: string;
      code?: string;
      status?: 'ACTIVE' | 'DISABLED';
      sso_enabled?: boolean;
      sso_config?: {
        currentTimestamp?: string;
        secret?: string;
        protocol?: 'OIDC';
        redirect_uri?: string;
        redirect_mode?: 'POST_REDIRECT' | 'HEADER_REDIRECT';
        base_url?: string;
        client_id?: string;
        client_secret?: string;
        issuer?: string;
        frontend_url?: string;
      };
      description?: string;
      created_at?: string;
      updated_at?: string;
    };
  }>(`/api/v1/applications-sso/${param0}`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}
