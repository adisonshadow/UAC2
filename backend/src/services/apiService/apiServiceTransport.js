const TRANSPORT_PROTOCOLS = ['http', 'sse', 'websocket'];

const TRANSPORT_LABELS = {
  http: 'HTTP REST',
  sse: 'SSE 流式',
  websocket: 'WebSocket',
};

function normalizeTransportProtocols(value) {
  const raw = Array.isArray(value) ? value : ['http'];
  const normalized = [...new Set(
    raw.map((item) => String(item).trim().toLowerCase()).filter((item) => TRANSPORT_PROTOCOLS.includes(item)),
  )];
  return normalized.length ? normalized : ['http'];
}

function buildTransportEndpoints(service) {
  const routePath = service.routePath || service.route_path;
  if (!routePath) return [];
  const protocols = normalizeTransportProtocols(service.transportProtocols || service.transport_protocols);
  const endpoints = [];

  if (protocols.includes('http')) {
    endpoints.push({
      protocol: 'http',
      label: TRANSPORT_LABELS.http,
      url: service.basePath || `/api/v1/data/${routePath}`,
      description: '标准 REST；通过 query/body 传 operation 与 parameters',
    });
  }
  if (protocols.includes('sse')) {
    endpoints.push({
      protocol: 'sse',
      label: TRANSPORT_LABELS.sse,
      url: `/api/v1/stream/data/${routePath}`,
      description: 'GET 流式推送；仅读类 operation（find/count 等），参数走 query',
    });
  }
  if (protocols.includes('websocket')) {
    endpoints.push({
      protocol: 'websocket',
      label: TRANSPORT_LABELS.websocket,
      url: `/api/v1/ws/data/${routePath}`,
      description: 'JSON 消息：{ "operation": "find", "parameters": { ... } }',
    });
  }
  return endpoints;
}

function assertTransportAllowed(service, protocol) {
  const protocols = normalizeTransportProtocols(service.transportProtocols || service.transport_protocols);
  if (!protocols.includes(protocol)) {
    throw Object.assign(
      new Error(`该服务未启用 ${TRANSPORT_LABELS[protocol] || protocol} 访问协议`),
      { status: 405 },
    );
  }
}

module.exports = {
  TRANSPORT_PROTOCOLS,
  TRANSPORT_LABELS,
  normalizeTransportProtocols,
  buildTransportEndpoints,
  assertTransportAllowed,
};
