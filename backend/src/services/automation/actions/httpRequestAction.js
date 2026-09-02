/**
 * 动作实现：调用外部 HTTP（收编自 outbound webhook 的能力集）。
 * 配置（action_config）：
 *  - method: POST|PUT|PATCH（默认 POST）
 *  - url / headers / query
 *  - bodyTemplate: 对象或字符串模板，支持 {{payload.a.b}} 事件负载插值
 *  - transformScript: 高级可选，对插值后的 body 做最终变换（沙箱，5s）
 *  - auth: { type: none|bearer|api_key, keyName, sendMode: header|query, secretEnc }
 *  - responseConfig: 异常判定规则（outboundResponseRules）
 *  - timeoutMs: 默认 30000，上限 60000
 */
const { requestJson } = require('../../outboundWebhook/outboundHttpClient');
const { evaluateResponse } = require('../../outboundWebhook/outboundResponseRules');
const {
  executeTransformScript,
} = require('../../outboundWebhook/outboundScriptRuntime');
const { decryptApiKey } = require('../../../utils/encryption');

const DEFAULT_HTTP_TIMEOUT_MS = 30000;
const MAX_HTTP_TIMEOUT_MS = 60000;

/** {{payload.a.b}} 插值：模板字符串/对象深插值，未命中路径原样保留 */
function interpolateValue(template, payload) {
  if (typeof template === 'string') {
    return template.replace(/\{\{\s*payload\.([\w.[\]-]+)\s*\}\}/g, (raw, pathExpr) => {
      const value = getPath(payload, pathExpr);
      if (value === undefined) return raw;
      if (value === null) return 'null';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }
  if (Array.isArray(template)) {
    return template.map((item) => interpolateValue(item, payload));
  }
  if (template && typeof template === 'object') {
    const out = {};
    Object.entries(template).forEach(([k, v]) => {
      out[interpolateValue(k, payload)] = interpolateValue(v, payload);
    });
    return out;
  }
  return template;
}

function getPath(obj, pathExpr) {
  const parts = String(pathExpr).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/** 组装鉴权（密钥解密失败按无鉴权处理并提示错误） */
function buildAuthHeaders(auth = {}, query = {}) {
  const type = String(auth.type || 'none');
  if (type === 'none' || !auth.secretEnc) {
    return { headers: {}, query, error: type !== 'none' && !auth.secretEnc ? '鉴权密钥缺失，按无鉴权发送' : null };
  }
  let secret;
  try {
    secret = decryptApiKey(auth.secretEnc);
  } catch (e) {
    return { headers: {}, query, error: `鉴权密钥解密失败: ${e.message}` };
  }
  if (!secret) {
    return { headers: {}, query, error: '鉴权密钥为空，按无鉴权发送' };
  }
  if (type === 'bearer') {
    const keyName = auth.keyName || 'Authorization';
    const headers = { [keyName]: /^Bearer\s/.test(secret) ? secret : `Bearer ${secret}` };
    return { headers, query, error: null };
  }
  if (type === 'api_key') {
    const sendMode = auth.sendMode === 'query' ? 'query' : 'header';
    const keyName = auth.keyName || (sendMode === 'query' ? 'api_key' : 'X-API-Key');
    if (sendMode === 'query') {
      return { headers: {}, query: { ...query, [keyName]: secret }, error: null };
    }
    return { headers: { [keyName]: secret }, query, error: null };
  }
  return { headers: {}, query, error: `未知鉴权类型: ${type}` };
}

/**
 * 执行外呼动作。
 * @returns {Promise<{ ok: boolean, output: object, error: string|null }>}
 */
async function executeHttpRequestAction(actionConfig = {}, envelope) {
  const payload = envelope.payload || {};
  const timeoutMs = Math.min(
    Math.max(Number(actionConfig.timeoutMs) || DEFAULT_HTTP_TIMEOUT_MS, 1000),
    MAX_HTTP_TIMEOUT_MS,
  );

  const url = String(actionConfig.url || '').trim();
  if (!url) {
    throw Object.assign(new Error('http_request 动作缺少 url'), { status: 400 });
  }

  const interpolatedBody = interpolateValue(actionConfig.bodyTemplate ?? {}, payload);
  const interpolatedQuery = interpolateValue(actionConfig.query ?? {}, payload);
  const interpolatedHeaders = interpolateValue(actionConfig.headers ?? {}, payload);

  let finalBody = interpolatedBody;
  if (actionConfig.transformScript) {
    finalBody = await executeTransformScript(
      actionConfig.transformScript,
      interpolatedBody,
      { hook: { event: { type: envelope.type, occurredAt: envelope.occurredAt } } },
    );
  }

  const authResult = buildAuthHeaders(actionConfig.auth || {}, interpolatedQuery);

  const resp = await requestJson(url, finalBody, {
    method: actionConfig.method || 'POST',
    headers: { ...interpolatedHeaders, ...authResult.headers },
    query: authResult.query,
    timeout: timeoutMs,
  });

  // 网络层失败（无 status）
  if (resp.error && !resp.status) {
    return {
      ok: false,
      output: { requestUrl: url, method: actionConfig.method || 'POST' },
      error: resp.error,
    };
  }

  const evaluation = evaluateResponse({
    httpStatus: resp.status,
    responseBody: resp.body,
    responseConfig: actionConfig.responseConfig,
  });

  return {
    ok: evaluation.ok,
    output: {
      requestUrl: url,
      method: String(actionConfig.method || 'POST').toUpperCase(),
      responseStatus: resp.status,
      responseBody: truncateText(resp.body, 4000),
      matchedRules: evaluation.matchedRules,
      authWarning: authResult.error,
    },
    error: evaluation.ok ? null : evaluation.errorMessage,
  };
}

function truncateText(text, maxChars) {
  const str = String(text ?? '');
  if (str.length <= maxChars) return str;
  return `${str.slice(0, maxChars)}…（截断，共 ${str.length} 字符）`;
}

module.exports = {
  executeHttpRequestAction,
  interpolateValue,
  DEFAULT_HTTP_TIMEOUT_MS,
  MAX_HTTP_TIMEOUT_MS,
};
