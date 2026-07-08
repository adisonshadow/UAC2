import { getApiServices } from '@/services/UAC/api/apiServices';
import { getApiData } from '@/utils/apiResponse';

export async function resolveApiServiceId(args: Record<string, unknown>): Promise<string> {
  const serviceId = args.serviceId ? String(args.serviceId).trim() : '';
  if (serviceId) return serviceId;

  const code = args.code ? String(args.code).trim() : '';
  if (!code) {
    throw new Error('请提供 serviceId 或 code');
  }

  const res = await getApiServices({ codePrefix: code, size: -1 });
  const data = getApiData<API.ApiServiceListResult>(res);
  const exact = data?.items?.find((item) => item.code === code);
  if (exact?.id) return exact.id;

  throw new Error(`未找到 code 为 ${code} 的 API 服务`);
}
