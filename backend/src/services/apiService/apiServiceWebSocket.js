const { WebSocketServer } = require('ws');
const url = require('url');
const logger = require('../../utils/logger');
const apiServiceInvokeService = require('./apiServiceInvokeService');
const apiServiceExecutionService = require('./apiServiceExecutionService');
const { assertTransportAllowed } = require('./apiServiceTransport');
const { assertAccessAllowed } = require('./apiServicePermissionService');

const WS_PATH_PREFIX = '/api/v1/ws/data/';

function parseRoutePathFromUrl(requestUrl) {
  const parsed = url.parse(requestUrl || '');
  if (!parsed.pathname?.startsWith(WS_PATH_PREFIX)) return null;
  return decodeURIComponent(parsed.pathname.slice(WS_PATH_PREFIX.length));
}

function buildAuthContextFromTokenPayload(payload) {
  if (!payload) return null;
  return {
    kind: 'user',
    userId: payload.user_id || payload.id,
    roleIds: payload.roleIds || payload.role_ids || [],
    departmentId: payload.department_id || payload.departmentId,
  };
}

async function handleWebSocketMessage(routePath, message, authContext) {
  const service = await apiServiceInvokeService.resolvePublishedService(routePath);
  assertTransportAllowed(service, 'websocket');

  let payload;
  try {
    payload = JSON.parse(message);
  } catch {
    throw Object.assign(new Error('WebSocket 消息须为 JSON'), { status: 400 });
  }

  const operation = String(payload.operation || '').trim();
  if (!operation) {
    throw Object.assign(new Error('消息缺少 operation 字段'), { status: 400 });
  }
  const parameters = payload.parameters && typeof payload.parameters === 'object'
    ? payload.parameters
    : {};

  assertAccessAllowed(service, authContext, { bypass: false });

  return apiServiceExecutionService.testService(service.id, {
    operation,
    parameters,
    bypassAccessControl: false,
    authContext,
  });
}

function attachApiServiceWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const routePath = parseRoutePathFromUrl(request.url);
    if (!routePath) return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.routePath = routePath;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'ready',
      routePath: ws.routePath,
      hint: '发送 { "operation": "find", "parameters": {} }',
    }));

    ws.on('message', async (raw) => {
      try {
        const authContext = ws.authContext || null;
        const result = await handleWebSocketMessage(ws.routePath, String(raw), authContext);
        ws.send(JSON.stringify({ type: 'result', success: true, data: result }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          success: false,
          message: error.message || '执行失败',
          status: error.status || 500,
        }));
      }
    });

    ws.on('error', (error) => {
      logger.warn('API WebSocket error', { message: error.message, routePath: ws.routePath });
    });
  });

  logger.info('✅ API Service WebSocket attached', { pathPrefix: WS_PATH_PREFIX });
  return wss;
}

module.exports = {
  attachApiServiceWebSocket,
  WS_PATH_PREFIX,
  buildAuthContextFromTokenPayload,
};
