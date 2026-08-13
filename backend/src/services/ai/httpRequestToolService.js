/**
 * 公共 HTTP 请求 Tool（类 curl）：供 AI 在没有专用 Tool 时探查 API。
 * - 受信主机（本机 EADAF / 额外配置 host）：强制注入当前用户 JWT
 * - 外部 URL：禁止附带用户 JWT；可选手动 header
 * - 使用 Node fetch，不 exec curl（防命令注入）
 */

const { URL } = require('url');
const config = require('../../config');
const logger = require('../../utils/logger');

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
const MAX_BODY_CHARS = 48 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 60000;

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata',
]);

function parseTrustedHosts() {
  const fromEnv = String(process.env.AI_HTTP_TRUSTED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const apiHost = String(config.api.host || 'localhost').toLowerCase();
  const apiPort = Number(config.api.port) || 3000;
  const defaults = [
    `${apiHost}:${apiPort}`,
    `localhost:${apiPort}`,
    `127.0.0.1:${apiPort}`,
    'localhost:9526',
    '127.0.0.1:9526',
    'localhost:5171',
    '127.0.0.1:5171',
  ];

  return new Set([...defaults, ...fromEnv]);
}

function getSelfBaseUrl() {
  const host = config.api.host || 'localhost';
  const port = Number(config.api.port) || 3000;
  // 相对路径解析时优先用本机 loopback，避免 hostname 绑 0.0.0.0 时不可达
  const resolveHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  return `http://${resolveHost}:${port}`;
}

function isPrivateOrLinkLocalIp(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  if (BLOCKED_HOSTS.has(h)) return true;

  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function hostKey(url) {
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  return `${url.hostname.toLowerCase()}:${port}`;
}

function isTrustedUrl(url) {
  const trusted = parseTrustedHosts();
  const key = hostKey(url);
  if (trusted.has(key)) return true;
  // 也允许仅 hostname 匹配（无端口项）
  if (trusted.has(url.hostname.toLowerCase())) return true;
  return false;
}

function stripAuthHeaders(headers) {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    if (key.toLowerCase() === 'authorization') {
      delete out[key];
    }
  }
  return out;
}

function normalizeHeaders(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    out[String(k)] = String(v);
  }
  return out;
}

function resolveUrl(inputUrl) {
  const raw = String(inputUrl || '').trim();
  if (!raw) {
    const err = new Error('url 为必填项');
    err.code = 'invalid_url';
    throw err;
  }

  let url;
  try {
    if (raw.startsWith('/')) {
      url = new URL(raw, getSelfBaseUrl());
    } else {
      url = new URL(raw);
    }
  } catch {
    const err = new Error(`无效 url: ${raw}`);
    err.code = 'invalid_url';
    throw err;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    const err = new Error(`不支持的协议: ${url.protocol}`);
    err.code = 'invalid_protocol';
    throw err;
  }

  return url;
}

function truncateBody(text) {
  if (text == null) return { body: null, truncated: false };
  const s = String(text);
  if (s.length <= MAX_BODY_CHARS) {
    return { body: s, truncated: false };
  }
  return {
    body: `${s.slice(0, MAX_BODY_CHARS)}\n…[truncated ${s.length - MAX_BODY_CHARS} chars]`,
    truncated: true,
  };
}

function parseBodyForReturn(text, contentType) {
  const { body, truncated } = truncateBody(text);
  if (body == null) return { body: null, truncated };
  if (!truncated && contentType && contentType.includes('application/json')) {
    try {
      return { body: JSON.parse(body), truncated: false };
    } catch {
      return { body, truncated: false };
    }
  }
  return { body, truncated };
}

/**
 * @param {object} args
 * @param {string} [args.method]
 * @param {string} args.url
 * @param {Record<string,string>} [args.headers]
 * @param {unknown} [args.body]
 * @param {number} [args.timeoutMs]
 * @param {{ userToken?: string|null }} [context]
 */
async function executeHttpRequest(args = {}, context = {}) {
  const method = String(args.method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    const err = new Error(`method 仅支持: ${[...ALLOWED_METHODS].join(', ')}`);
    err.code = 'invalid_method';
    throw err;
  }

  const url = resolveUrl(args.url);
  const trusted = isTrustedUrl(url);
  const userToken = context.userToken || null;

  // 外部 URL：拦截明显 SSRF 目标（云 metadata / 未列入受信的链路本地）
  if (!trusted) {
    if (BLOCKED_HOSTS.has(url.hostname.toLowerCase()) || url.hostname === '169.254.169.254') {
      const err = new Error('禁止访问该主机');
      err.code = 'host_blocked';
      throw err;
    }
  }

  let headers = normalizeHeaders(args.headers);

  if (trusted) {
    if (!userToken) {
      const err = new Error(
        'missing_user_token：访问受信主机需要当前登录用户 JWT，请确认前端 getToken / 代理 Authorization 已透传',
      );
      err.code = 'missing_user_token';
      throw err;
    }
    headers = stripAuthHeaders(headers);
    headers.Authorization = `Bearer ${userToken}`;
  } else {
    // 外部：剥掉与当前用户 token 相同的 Authorization，防止泄露
    headers = stripAuthHeaders(headers);
    // 允许模型自带其它 Authorization（API Key），但若值等于用户 token 则已剥掉
    const original = normalizeHeaders(args.headers);
    for (const [k, v] of Object.entries(original)) {
      if (k.toLowerCase() !== 'authorization') {
        headers[k] = v;
        continue;
      }
      const bearer = v.replace(/^Bearer\s+/i, '');
      if (userToken && (v === userToken || bearer === userToken)) {
        continue;
      }
      headers[k] = v;
    }
  }

  let body;
  if (method !== 'GET' && method !== 'HEAD' && args.body !== undefined && args.body !== null) {
    if (typeof args.body === 'string') {
      body = args.body;
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'text/plain; charset=utf-8';
      }
    } else {
      body = JSON.stringify(args.body);
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  const timeoutMs = Math.min(
    Math.max(Number(args.timeoutMs) || DEFAULT_TIMEOUT_MS, 1000),
    MAX_TIMEOUT_MS,
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  logger.info('[http_request] 发起请求', {
    method,
    host: hostKey(url),
    path: url.pathname,
    trusted,
    hasUserToken: Boolean(userToken),
    timeoutMs,
  });

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });

    // 手动处理有限次重定向，避免跳到非受信 host 时仍带用户 token
    let finalResponse = response;
    let hops = 0;
    while (
      [301, 302, 303, 307, 308].includes(finalResponse.status) &&
      hops < 3
    ) {
      const loc = finalResponse.headers.get('location');
      if (!loc) break;
      const nextUrl = new URL(loc, url);
      const nextTrusted = isTrustedUrl(nextUrl);
      if (trusted && !nextTrusted) {
        // 从受信跳到外网：去掉用户 JWT 后再跟
        headers = stripAuthHeaders(headers);
      }
      if (!nextTrusted && isPrivateOrLinkLocalIp(nextUrl.hostname) && !isTrustedUrl(nextUrl)) {
        break;
      }
      finalResponse = await fetch(nextUrl.toString(), {
        method: [301, 302, 303].includes(finalResponse.status) && method !== 'HEAD' ? 'GET' : method,
        headers,
        body: [301, 302, 303].includes(finalResponse.status) ? undefined : body,
        signal: controller.signal,
        redirect: 'manual',
      });
      hops += 1;
    }

    const contentType = finalResponse.headers.get('content-type') || '';
    const text = method === 'HEAD' ? null : await finalResponse.text();
    const parsed = parseBodyForReturn(text, contentType);

    const responseHeaders = {};
    finalResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return;
      responseHeaders[key] = value;
    });

    return {
      status: finalResponse.status,
      ok: finalResponse.ok,
      contentType,
      headers: responseHeaders,
      body: parsed.body,
      truncated: parsed.truncated,
      url: finalResponse.url || url.toString(),
      trusted,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const err = new Error(`请求超时（${timeoutMs}ms）`);
      err.code = 'timeout';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  executeHttpRequest,
  ALLOWED_METHODS,
  MAX_BODY_CHARS,
};
