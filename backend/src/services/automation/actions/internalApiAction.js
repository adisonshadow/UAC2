/**
 * 动作实现：调用内部已发布 API 服务（系统身份）。
 * 配置（action_config）：
 *  - apiServiceId / operation
 *  - parametersTemplate: 参数模板，支持 {{payload.a.b}} 插值
 * 执行走 executePublished（写操作真实 COMMIT）；其引起的事件在 depth+1 上下文中
 * 由本动作显式 emit（复用 emitApiInvokeEvents），不依赖 HTTP invoke 层。
 */
const apiServiceExecutionService = require('../../apiService/apiServiceExecutionService');
const { emitApiInvokeEvents } = require('../../apiService/apiServiceInvokeService');
const { runWithEventDepth } = require('../eventContext');
const { interpolateValue } = require('./httpRequestAction');

async function executeInternalApiAction(actionConfig = {}, envelope) {
  const apiServiceId = String(actionConfig.apiServiceId || '').trim();
  if (!apiServiceId) {
    throw Object.assign(new Error('internal_api 动作缺少 apiServiceId'), { status: 400 });
  }
  const operation = actionConfig.operation
    ? String(actionConfig.operation).trim()
    : undefined;

  const parameters = interpolateValue(actionConfig.parametersTemplate ?? {}, envelope.payload || {});

  const serviceStub = { id: apiServiceId, code: actionConfig.apiServiceCode || null };
  let result;
  try {
    result = await apiServiceExecutionService.executePublished(apiServiceId, {
      operation,
      parameters,
      bypassAccessControl: true, // 系统身份
      authContext: null,
    });
  } catch (error) {
    // 失败也发 apiservice.invoked（depth+1），随后把失败交给执行器记 Run
    runWithEventDepth(envelope.depth + 1, () => {
      try {
        const { emit } = require('../eventDispatcher');
        emit('apiservice.invoked', {
          api_service_id: apiServiceId,
          api_service_code: actionConfig.apiServiceCode || null,
          operation: operation || null,
          transport: 'internal_api',
          status: 'failed',
          duration_ms: null,
          error: String(error?.message || error).slice(0, 2000),
          trace_id: null,
        });
      } catch { /* 事件失败不影响动作错误传播 */ }
    });
    throw error;
  }

  runWithEventDepth(envelope.depth + 1, () => {
    emitApiInvokeEvents(serviceStub, result, null, 'internal_api', operation);
  });

  const executable = result?.executable !== false;
  return {
    ok: executable,
    output: {
      apiServiceId,
      operation: result?.operation || operation || null,
      executable,
      executableReason: result?.executableReason || null,
      durationMs: result?.durationMs ?? null,
      result: result?.preview ?? null,
    },
    error: executable ? null : (result?.executableReason || '内部 API 服务不可执行'),
  };
}

module.exports = {
  executeInternalApiAction,
};
