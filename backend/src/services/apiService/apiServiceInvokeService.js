const { PassThrough } = require('stream');
const apiServiceExecutionService = require('./apiServiceExecutionService');
const { assertTransportAllowed } = require('./apiServiceTransport');
const { isReadOperation } = require('./operationParameterSchemas');
const { assertAccessAllowed } = require('./apiServicePermissionService');
const {
  resolvePublishedInvokeTarget,
  resolveOperationByHttpMethod,
} = require('./apiServiceRouteResolve');
const logger = require('../../utils/logger');

let _triggerByApiService = null;
/**
 * 延迟加载 outboundWebhookService（避免循环依赖）
 */
function getTriggerFn() {
  if (_triggerByApiService === null) {
    try {
      _triggerByApiService = require('../outboundWebhook/outboundWebhookService').triggerByApiService;
    } catch {
      _triggerByApiService = false;
    }
  }
  return _triggerByApiService || null;
}

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
      return { ...query, ...rest.parameters };
    }
    return { ...query, ...rest };
  }
  return query;
}

function resolveExplicitOperation(ctx) {
  const fromQuery = ctx.query?.operation;
  const fromBody = ctx.request.body?.operation;
  return String(fromQuery || fromBody || '').trim() || null;
}

async function resolvePublishedService(routePath) {
  const { service } = await resolvePublishedInvokeTarget(routePath, 'GET');
  return service;
}

async function invokePublished(routePath, ctx, transport) {
  const target = await resolvePublishedInvokeTarget(routePath, ctx.method);
  const { service, pathParams, operationHint } = target;
  assertTransportAllowed(service, transport);

  const operation = resolveOperationByHttpMethod(
    service,
    ctx.method,
    operationHint || resolveExplicitOperation(ctx),
  );
  if (!operation) {
    throw Object.assign(new Error('须指定 operation 参数'), { status: 400 });
  }

  // path 参数优先于 query/body（REST :id）；仍支持 POST body 传 id 的兼容写法
  const parameters = {
    ...gatherInvokeParameters(ctx),
    ...pathParams,
  };
  const authContext = buildAuthContext(ctx);
  assertAccessAllowed(service, authContext, { bypass: false });

  const result = await apiServiceExecutionService.testService(service.id, {
    operation,
    parameters,
    bypassAccessControl: false,
    authContext,
  });

  if (transport === 'http' && result) {
    try {
      const triggerFn = getTriggerFn();
      if (triggerFn) {
        await triggerFn(service.id, result.preview || result);
      }
    } catch (e) {
      logger.warn('外部 API 提交触发失败（不影响业务 API 主流程）', { error: e.message });
    }
  }

  return result?.preview ?? null;
}

async function streamPublishedSse(routePath, ctx) {
  const target = await resolvePublishedInvokeTarget(routePath, ctx.method);
  const { service, pathParams, operationHint } = target;
  assertTransportAllowed(service, 'sse');

  const operation = resolveOperationByHttpMethod(
    service,
    ctx.method,
    operationHint || resolveExplicitOperation(ctx),
  );
  if (!operation) {
    throw Object.assign(new Error('须指定 operation 参数'), { status: 400 });
  }
  if (!isReadOperation(operation)) {
    throw Object.assign(new Error('SSE 仅支持读类 operation'), { status: 400 });
  }

  const parameters = {
    ...gatherInvokeParameters(ctx),
    ...pathParams,
  };
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
      writeEvent('done', {
        total: preview.pagination?.total ?? preview.items.length,
        page: preview.pagination?.page,
        pageSize: preview.pagination?.pageSize,
        totalPages: preview.pagination?.totalPages,
        hasNext: preview.pagination?.hasNext,
        count: preview.items.length,
      });
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
