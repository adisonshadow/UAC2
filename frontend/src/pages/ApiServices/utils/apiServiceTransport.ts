export type ApiServiceTransportProtocol = 'http' | 'sse' | 'websocket';

export const API_SERVICE_TRANSPORT_OPTIONS: Array<{
  value: ApiServiceTransportProtocol;
  label: string;
  description: string;
}> = [
  {
    value: 'http',
    label: 'HTTP REST',
    description: '标准请求/响应，通过 query 或 body 传 operation 与 parameters',
  },
  {
    value: 'sse',
    label: 'SSE 流式',
    description: 'Server-Sent Events，适合 find/count 等读操作逐条推送',
  },
  {
    value: 'websocket',
    label: 'WebSocket',
    description: '双向通道，发送 JSON：{ operation, parameters }',
  },
];

export function normalizeTransportProtocols(
  value?: string[] | null,
): ApiServiceTransportProtocol[] {
  const allowed = new Set(API_SERVICE_TRANSPORT_OPTIONS.map((o) => o.value));
  const list = Array.isArray(value) ? value : ['http'];
  const normalized = [...new Set(
    list.map((item) => String(item).toLowerCase() as ApiServiceTransportProtocol)
      .filter((item) => allowed.has(item)),
  )];
  return normalized.length ? normalized : ['http'];
}

export function buildTransportEndpointPreview(
  routePath: string,
  protocols: ApiServiceTransportProtocol[],
) {
  if (!routePath) return [];
  const endpoints: Array<{ protocol: ApiServiceTransportProtocol; label: string; url: string }> = [];
  if (protocols.includes('http')) {
    endpoints.push({
      protocol: 'http',
      label: 'HTTP REST',
      url: `/api/v1/data/${routePath}`,
    });
  }
  if (protocols.includes('sse')) {
    endpoints.push({
      protocol: 'sse',
      label: 'SSE',
      url: `/api/v1/stream/data/${routePath}?operation=find`,
    });
  }
  if (protocols.includes('websocket')) {
    endpoints.push({
      protocol: 'websocket',
      label: 'WebSocket',
      url: `/api/v1/ws/data/${routePath}`,
    });
  }
  return endpoints;
}
