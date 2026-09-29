/**
 * SSO redirect_uri：支持「跟随本系统域名/IP」
 * - redirect_uri_use_system_host=true 时，redirect_uri 存后缀，如 `:13303/auth/callback` 或 `/callback`
 * - 登录/跳转时按请求 Host 拼出完整 URL
 */

/**
 * @param {string} uri
 * @returns {boolean}
 */
function isValidSystemHostRedirectSuffix(uri) {
  if (!uri || typeof uri !== 'string') return false;
  const s = uri.trim();
  if (!s || /^https?:\/\//i.test(s)) return false;
  if (s.startsWith(':')) {
    return /^:\d{1,5}(\/[^\s]*)?$/.test(s);
  }
  if (s.startsWith('/')) {
    return !s.includes('://');
  }
  return false;
}

/**
 * @param {string} uri
 * @returns {boolean}
 */
function isAbsoluteHttpUrl(uri) {
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 创建/更新时校验 redirect_uri（按是否跟随本机 Host）
 * @param {{ redirect_uri?: string, redirect_uri_use_system_host?: boolean }} ssoConfig
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function validateSsoRedirectUriConfig(ssoConfig) {
  const uri = ssoConfig?.redirect_uri;
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    return { ok: false, message: 'SSO回调地址不能为空' };
  }
  const useSystem = !!ssoConfig.redirect_uri_use_system_host;
  if (useSystem) {
    if (!isValidSystemHostRedirectSuffix(uri.trim())) {
      return {
        ok: false,
        message:
          '已启用「自动跟随本系统域名/IP」时，请填写端口路径（如 :13303/auth/callback）或本机路径（如 /auth/callback），不要填写完整域名',
      };
    }
    return { ok: true };
  }
  if (!isAbsoluteHttpUrl(uri.trim())) {
    return { ok: false, message: 'SSO回调地址格式不正确' };
  }
  return { ok: true };
}

/**
 * @param {{ redirect_uri?: string, redirect_uri_use_system_host?: boolean } | null | undefined} ssoConfig
 * @param {{ protocol?: string, host?: string }} req
 * @returns {string}
 */
function resolveSsoRedirectUri(ssoConfig, req = {}) {
  const uri = String(ssoConfig?.redirect_uri || '').trim();
  if (!ssoConfig?.redirect_uri_use_system_host || !uri) {
    return uri;
  }
  const host = String(req.host || '').trim() || 'localhost';
  const hostname = host.split(':')[0] || 'localhost';
  const proto = req.protocol === 'https' ? 'https' : 'http';

  if (uri.startsWith(':')) {
    return `${proto}://${hostname}${uri}`;
  }
  if (uri.startsWith('/')) {
    return `${proto}://${host}${uri}`;
  }
  return `${proto}://${hostname}/${uri.replace(/^\//, '')}`;
}

/**
 * 从 Koa ctx 取协议与 Host（信任代理时用 ctx.request）
 * @param {import('koa').Context} ctx
 */
function requestHostInfo(ctx) {
  return {
    protocol: ctx.request.protocol,
    host: ctx.request.host,
  };
}

module.exports = {
  isValidSystemHostRedirectSuffix,
  isAbsoluteHttpUrl,
  validateSsoRedirectUriConfig,
  resolveSsoRedirectUri,
  requestHostInfo,
};
