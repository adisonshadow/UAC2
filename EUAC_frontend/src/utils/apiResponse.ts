type ApiRecord = Record<string, unknown>;

/** 判断 API 请求是否成功（兼容 dataField 解包前后） */
export function isApiSuccess(response: unknown): boolean {
  if (response == null || typeof response !== 'object') {
    return false;
  }
  const res = response as ApiRecord;
  if (typeof res.code === 'number') {
    return res.code >= 200 && res.code < 300;
  }
  // dataField: 'data' 解包后直接返回业务数据
  return true;
}

/** 解析分页列表响应（兼容 dataField 解包前后） */
export function parseApiListResponse<T>(response: unknown): {
  /** ProTable request 需要的行数据字段 */
  data: T[];
  /** 与 data 相同，便于解构后手动映射 */
  items: T[];
  total: number;
  success: boolean;
} {
  if (response == null || typeof response !== 'object') {
    return { data: [], items: [], total: 0, success: false };
  }
  const res = response as ApiRecord;
  const payload =
    res.data && typeof res.data === 'object' ? (res.data as ApiRecord) : res;
  const items = (Array.isArray(payload.items) ? payload.items : []) as T[];
  const total = typeof payload.total === 'number' ? payload.total : 0;
  return {
    data: items,
    items,
    total,
    success: isApiSuccess(response),
  };
}

/** 从 API 响应或异常中取出 message 字段 */
export function getApiErrorMessage(response: unknown, fallback?: string): string {
  if (response == null) {
    return fallback || '请求失败';
  }

  const err = response as {
    info?: { message?: string };
    response?: { data?: ApiRecord | string | null };
    message?: string;
    code?: number;
  };

  // axios / umi 异常：优先使用 response.data.message
  const responseData = err.response?.data;
  if (responseData && typeof responseData === 'object') {
    const apiMessage = responseData.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
  }

  const fromInfo = err.info?.message;
  if (fromInfo?.trim()) return fromInfo;

  // 完整 API 响应体 { code, message, data }
  if (typeof response === 'object') {
    const res = response as ApiRecord;
    if (typeof res.message === 'string' && res.message.trim()) {
      return res.message;
    }
  }

  if (
    typeof err.message === 'string' &&
    err.message.trim() &&
    !/^Request failed with status code/i.test(err.message)
  ) {
    return err.message;
  }

  return fallback || '请求失败';
}

/** 从 API 响应中取出 data 字段（兼容已解包的情况） */
export function getApiData<T>(response: unknown): T | undefined {
  if (response == null || typeof response !== 'object') {
    return undefined;
  }
  const res = response as ApiRecord;
  if (res.data !== undefined) {
    return res.data as T;
  }
  return response as T;
}
