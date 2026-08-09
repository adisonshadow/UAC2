/**
 * 解析业务数据 API 调用目标：routePath + 可选 path 参数（如 /:id）。
 * 兼容：精确 routePath（无后缀）+ POST body 传 id；以及 REST path 后缀。
 */

const apiServiceService = require('./apiServiceService');
const { getOperationMeta } = require('./operationCatalog');

function normalizeRoutePath(routePath) {
  return String(routePath || '')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

/**
 * @param {string} pattern 如 '/:id'、'/one'、'/distinct/:field'、'/:id/clone'、''
 * @param {string} remainder 去掉服务 routePath 后的后缀
 * @returns {Record<string, string>|null}
 */
function matchRoutePattern(pattern, remainder) {
  const patternParts = String(pattern || '')
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean);
  const remParts = String(remainder || '')
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });

  if (patternParts.length !== remParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const token = patternParts[i];
    const value = remParts[i];
    if (token.startsWith(':')) {
      params[token.slice(1)] = value;
    } else if (token !== value) {
      return null;
    }
  }
  return params;
}

function listOperationCandidates(service) {
  const fromRows = Array.isArray(service?.operations) ? service.operations : [];
  if (fromRows.length) {
    return fromRows.map((op) => {
      const name = op.operation || op.name;
      const meta = getOperationMeta(name);
      return {
        operation: name,
        httpMethod: String(op.httpMethod || meta?.httpMethod || 'GET').toUpperCase(),
        routePattern: op.routePattern != null ? op.routePattern : (meta?.routePattern || ''),
      };
    });
  }
  const enabled = Array.isArray(service?.enabledOperations) ? service.enabledOperations : [];
  return enabled.map((name) => {
    const meta = getOperationMeta(name);
    return {
      operation: name,
      httpMethod: String(meta?.httpMethod || 'GET').toUpperCase(),
      routePattern: meta?.routePattern || '',
    };
  });
}

function pickCandidate(candidates, httpMethod, remainder) {
  const method = String(httpMethod || 'GET').toUpperCase();
  const matched = [];
  for (const c of candidates) {
    const params = matchRoutePattern(c.routePattern, remainder);
    if (params == null) continue;
    matched.push({ ...c, pathParams: params });
  }
  if (!matched.length) return null;

  const methodMatched = matched.filter((c) => c.httpMethod === method);
  if (methodMatched.length === 1) return methodMatched[0];
  if (methodMatched.length > 1) {
    const empty = methodMatched.find((c) => !String(c.routePattern || '').replace(/^\//, ''));
    return empty || methodMatched[0];
  }

  // POST 兼容：无 path 后缀时由上层走 exact；有后缀时允许 POST 命中 REST pattern
  if (method === 'POST' && matched.length) {
    return matched[0];
  }
  return matched[0];
}

/**
 * 按 HTTP method 在无 path 后缀时推断 operation（单服务多 op 时）。
 */
function resolveOperationByHttpMethod(service, httpMethod, explicitOperation) {
  const explicit = String(explicitOperation || '').trim();
  if (explicit) return explicit;

  const method = String(httpMethod || 'GET').toUpperCase();
  const candidates = listOperationCandidates(service);
  const byMethod = candidates.filter((c) => c.httpMethod === method);
  if (byMethod.length === 1) return byMethod[0].operation;
  if (byMethod.length > 1) {
    const empty = byMethod.find((c) => !String(c.routePattern || '').replace(/^\//, ''));
    if (empty) return empty.operation;
  }
  const enabled = service.enabledOperations || [];
  return enabled[0] || candidates[0]?.operation || null;
}

async function loadPublishedByRoutePath(routePath) {
  const service = await apiServiceService.getServiceByRoutePath(routePath, {
    includeOperations: true,
    includePermissions: true,
  });
  if (!service) return null;
  if (service.status !== 'published') {
    throw Object.assign(new Error('API 服务未发布'), { status: 403 });
  }
  return service;
}

/**
 * @returns {Promise<{ service: object, pathParams: Record<string, string>, operationHint: string|null }>}
 */
async function resolvePublishedInvokeTarget(fullRoutePath, httpMethod) {
  const normalized = normalizeRoutePath(fullRoutePath);
  if (!normalized) {
    throw Object.assign(new Error('API 服务不存在'), { status: 404 });
  }

  const exact = await loadPublishedByRoutePath(normalized);
  if (exact) {
    return {
      service: exact,
      pathParams: {},
      operationHint: null,
      matchedVia: 'exact',
    };
  }

  const parts = normalized.split('/').filter(Boolean);
  for (let len = parts.length - 1; len >= 1; len -= 1) {
    const prefix = parts.slice(0, len).join('/');
    const remainder = parts.slice(len).join('/');
    const service = await loadPublishedByRoutePath(prefix);
    if (!service) continue;

    const picked = pickCandidate(listOperationCandidates(service), httpMethod, remainder);
    if (!picked) continue;

    return {
      service,
      pathParams: picked.pathParams || {},
      operationHint: picked.operation,
      matchedVia: 'pattern',
      matchedPattern: picked.routePattern,
    };
  }

  throw Object.assign(new Error('API 服务不存在'), { status: 404 });
}

module.exports = {
  normalizeRoutePath,
  matchRoutePattern,
  listOperationCandidates,
  resolveOperationByHttpMethod,
  resolvePublishedInvokeTarget,
};
