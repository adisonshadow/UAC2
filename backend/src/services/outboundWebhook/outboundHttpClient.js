/**
 * 外部 API HTTP 客户端：POST JSON 到目标 URL
 * 使用 Node.js 内置 fetch（Node 18+），超时 10s
 */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * POST JSON 到外部 API。
 * @returns { ok, status, body, error }
 */
async function postJson(url, body, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const respText = await resp.text().catch(() => '');
    return {
      ok: resp.ok,
      status: resp.status,
      body: respText,
    };
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      body: null,
      error: aborted ? `请求超时（${timeout}ms）` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { postJson, DEFAULT_TIMEOUT_MS };
