/**
 * 外部 API HTTP 客户端：按 method / headers / query 发送 JSON
 * 使用 Node.js 内置 fetch（Node 18+），超时默认 10s
 * SSRF：每跳（含重定向）经 outboundSsrfGuard 校验，重定向手动跟随（≤3 跳）
 */
const { assertSafeOutboundUrl } = require('./outboundSsrfGuard');

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

const ALLOWED_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function networkError(message) {
  return { ok: false, status: 0, body: null, error: message };
}

/**
 * @param {string} url
 * @param {unknown} body
 * @param {{
 *   method?: string,
 *   headers?: Record<string, string>,
 *   query?: Record<string, string>,
 *   timeout?: number,
 * }} [options]
 * @returns {Promise<{ ok: boolean, status: number, body: string|null, error?: string }>}
 */
async function requestJson(url, body, {
  method = 'POST',
  headers = {},
  query = {},
  timeout = DEFAULT_TIMEOUT_MS,
} = {}) {
  const httpMethod = String(method || 'POST').toUpperCase();
  if (!ALLOWED_METHODS.has(httpMethod)) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: `不支持的 HTTP 方法: ${httpMethod}`,
    };
  }

  let finalUrl = url;
  const queryEntries = Object.entries(query || {}).filter(([, v]) => v != null && v !== '');
  if (queryEntries.length) {
    const u = new URL(url);
    queryEntries.forEach(([k, v]) => u.searchParams.set(k, String(v)));
    finalUrl = u.toString();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    // 每跳 SSRF 校验；重定向手动跟随（默认 follow 会绕过逐跳校验）
    let currentUrl = finalUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertSafeOutboundUrl(currentUrl);
      const resp = await fetch(currentUrl, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
        redirect: 'manual',
      });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const location = resp.headers.get('location');
        if (!location) {
          const respText = await resp.text().catch(() => '');
          return { ok: resp.ok, status: resp.status, body: respText };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      const respText = await resp.text().catch(() => '');
      return {
        ok: resp.ok,
        status: resp.status,
        body: respText,
      };
    }
    return networkError(`重定向次数超过 ${MAX_REDIRECTS} 次`);
  } catch (err) {
    const aborted = err.name === 'AbortError';
    if (err && err.status === 400 && /SSRF|外呼/.test(String(err.message || ''))) {
      return networkError(err.message);
    }
    return networkError(aborted ? `请求超时（${timeout}ms）` : err.message);
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated 使用 requestJson；保留兼容旧调用 */
async function postJson(url, body, options = {}) {
  return requestJson(url, body, { ...options, method: 'POST' });
}

module.exports = {
  requestJson,
  postJson,
  DEFAULT_TIMEOUT_MS,
  ALLOWED_METHODS,
};
