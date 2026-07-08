const { PassThrough } = require('stream');
const apiServiceService = require('./apiServiceService');
const apiServiceExecutionService = require('./apiServiceExecutionService');
const { assertTransportAllowed } = require('./apiServiceTransport');
const { isReadOperation } = require('./operationParameterSchemas');
const { assertAccessAllowed } = require('./apiServicePermissionService');

function buildAuthContext(ctx) {
  const user = ctx.state?.user;
  if (!user) return null;
  return {
    kind: 'user',
    userId: user.user_id || user.id,
    roleIds: user.roleIds || user.role_ids || [],
    departmentId: user.department_id || user.departmentId,
  };
}

function gatherInvokeParameters(ctx) {
  const query = { ...ctx.query };
  delete query.operation;
  const body = ctx.request.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const { operation: _op, ...rest } = body;
    if (rest.parameters && typeof rest.parameters === 'object') {
      return rest.parameters;
    }
    return { ...query, ...rest };
  }
  return query;
}

function resolveOperation(ctx, service) {
  const fromQuery = ctx.query?.operation;
  const fromBody = ctx.request.body?.operation;
  const operation = String(fromQuery || fromBody || '').trim();
  if (operation) return operation;
  const enabled = service.enabledOperations || [];
  return enabled[0] || null;
}

async function resolvePublishedService(routePath) {
  const service = await apiServiceService.getServiceByRoutePath(routePath, {
    includeOperations: true,
    includePermissions: true,
  });
  if (!service) {
    throw Object.assign(new Error('API 服务不存在'), { status: 404 });
  }
  if (service.status !== 'published') {
    throw Object.assign(new Error('API 服务未发布'), { status: 403 });
  }
  return service;
}

async function invokePublished(routePath, ctx, transport) {
  const service = await resolvePublishedService(routePath);
  assertTransportAllowed(service, transport);
  const operation = resolveOperation(ctx, service);
  if (!operation) {
    throw Object.assign(new Error('须指定 operation 参数'), { status: 400 });
  }
  const parameters = gatherInvokeParameters(ctx);
  const authContext = buildAuthContext(ctx);
  assertAccessAllowed(service, authContext, { bypass: false });

  return apiServiceExecutionService.testService(service.id, {
    operation,
    parameters,
    bypassAccessControl: false,
    authContext,
  });
}

async function streamPublishedSse(routePath, ctx) {
  const service = await resolvePublishedService(routePath);
  assertTransportAllowed(service, 'sse');
  const operation = resolveOperation(ctx, service);
  if (!operation) {
    throw Object.assign(new Error('须指定 operation 参数'), { status: 400 });
  }
  if (!isReadOperation(operation)) {
    throw Object.assign(new Error('SSE 仅支持读类 operation'), { status: 400 });
  }

  const parameters = gatherInvokeParameters(ctx);
  const authContext = buildAuthContext(ctx);
  assertAccessAllowed(service, authContext, { bypass: false });

  const result = await apiServiceExecutionService.testService(service.id, {
    operation,
    parameters,
    bypassAccessControl: false,
    authContext,
  });

  ctx.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;
  ctx.respond = false;

  const stream = new PassThrough();
  ctx.body = stream;

  const writeEvent = (event, data) => {
    if (event) stream.write(`event: ${event}\n`);
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    writeEvent('meta', {
      serviceId: result.serviceId,
      code: result.code,
      operation: result.operation,
      version: service.version,
    });

    const preview = result.preview;
    if (preview?.items && Array.isArray(preview.items)) {
      preview.items.forEach((item, index) => {
        writeEvent('item', { index, item });
      });
      writeEvent('done', { total: preview.items.length, count: preview.count });
    } else {
      writeEvent('result', preview ?? null);
      writeEvent('done', { total: 1 });
    }
  } catch (error) {
    writeEvent('error', { message: error.message || 'SSE 流推送失败' });
  } finally {
    stream.end();
  }
}

module.exports = {
  buildAuthContext,
  gatherInvokeParameters,
  resolvePublishedService,
  invokePublished,
  streamPublishedSse,
};
