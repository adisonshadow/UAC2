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

let _emitHookEvent = null;
/**
 * 延迟加载钩子事件分发器（M1 提供；缺失时静默跳过，不影响业务主流程）
 */
function getEmitFn() {
  if (_emitHookEvent === null) {
    try {
      _emitHookEvent = require('../automation/eventDispatcher').emit;
    } catch {
      _emitHookEvent = false;
    }
  }
  return _emitHookEvent || null;
}

function emitHookEvent(type, payload) {
  try {
    const emit = getEmitFn();
    if (emit) emit(type, payload);
  } catch (e) {
    logger.warn('钩子事件分发失败（不影响业务 API 主流程）', { type, error: e.message });
  }
}

/**
 * M4 前临时互斥：若已有 enabled 钩子以 apiServiceIds 定向订阅本服务的 apiservice.invoked，
 * 则跳过旧 outbound webhook，避免双触发。空 apiServiceIds（匹配全部）不触发互斥。
 */
async function shouldSkipLegacyOutbound(apiServiceId) {
  try {
    const hookRegistryCache = require('../automation/hookRegistryCache');
    const hooks = await hookRegistryCache.getEnabledHooks();
    const sid = String(apiServiceId || '');
    return hooks.some((h) => {
      if (h.eventType !== 'apiservice.invoked') return false;
      const ids = h.compiled?.apiServiceIds;
      return ids && ids.has(sid);
    });
  } catch {
    return false;
  }
}

/** 事件负载截断：小负载原样保留，超限降级为截断预览，防 Run 表膨胀 */
function truncateForEvent(value, maxChars = 8000) {
  if (value == null) return value;
  try {
    const text = JSON.stringify(value);
    if (text.length <= maxChars) return value;
    return { _truncated: true, preview: text.slice(0, maxChars) };
  } catch {
    return { _truncated: true, reason: 'unserializable' };
  }
}

/** Data API 调用完成后的事件分发（fire-and-forget；WS/SSE 不发，见钩子管理边界）。
 *  亦被钩子 internal_api 动作复用（transport='internal_api'，运行于 depth+1 上下文）。 */
function emitApiInvokeEvents(service, result, ctx, transport, operation) {
  emitHookEvent('apiservice.invoked', {
    api_service_id: service.id,
    api_service_code: service.code,
    operation: result?.operation || operation,
    transport,
    status: result?.executable === false ? 'skipped' : 'success',
    executable: result?.executable !== false,
    executable_reason: result?.executableReason || null,
    duration_ms: result?.durationMs ?? null,
    request: truncateForEvent(result?.parameters),
    response: truncateForEvent(result?.preview),
    trace_id: ctx?.state?.traceId || null,
  });

  const write = result?.write;
  if (result?.executable !== false && write && write.kind) {
    emitHookEvent(`bizdata.record.${write.kind}`, {
      entity_code: result.entityCode,
      before: truncateForEvent(write.before),
      after: truncateForEvent(write.after),
      changed_fields: write.changedFields,
      api_service_id: service.id,
      operation: result.operation,
    });
  }
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

  let result;
  try {
    // 生产路径：写操作真实 COMMIT（executePublished），不再走测试台默认回滚
    result = await apiServiceExecutionService.executePublished(service.id, {
      operation,
      parameters,
      bypassAccessControl: false,
      authContext,
    });
  } catch (error) {
    // 失败也发 apiservice.invoked（fire-and-forget），随后抛回 HTTP 层
    emitHookEvent('apiservice.invoked', {
      api_service_id: service.id,
      api_service_code: service.code,
      operation,
      transport,
      status: 'failed',
      duration_ms: null,
      error: String(error?.message || error).slice(0, 2000),
      trace_id: ctx.state?.traceId || null,
    });
    throw error;
  }

  if (transport === 'http' && result) {
    emitApiInvokeEvents(service, result, ctx, transport, operation);

    // 旧 outbound webhook：M4 收编前保持可用，但不再 await 在请求路径上。
    // 若已有「按 apiServiceIds 定向」的 enabled 钩子订阅本服务，则跳过旧外呼，避免双触发。
    try {
      const shouldSkip = await shouldSkipLegacyOutbound(service.id);
      if (shouldSkip) {
        logger.info('跳过旧 outbound webhook（已有定向钩子订阅本 API 服务）', {
          apiServiceId: service.id,
        });
      } else {
        const triggerFn = getTriggerFn();
        if (triggerFn) {
          Promise.resolve(triggerFn(service.id, result.preview || result))
            .catch((e) => logger.warn('外部 API 提交触发失败（不影响业务 API 主流程）', { error: e.message }));
        }
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
  emitApiInvokeEvents,
};
