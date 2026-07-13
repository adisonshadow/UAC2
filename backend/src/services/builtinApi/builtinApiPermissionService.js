const { match } = require('path-to-regexp');
const { BuiltinApiConfig } = require('../../models');
const { listBuiltinApis, getBuiltinApiByCode } = require('./catalog');

/** 系统内置应用 code：该应用为 EADAF 本系统，拥有全部内置 API 访问权，不受授权范围限制 */
const SYSTEM_APPLICATION_CODE = 'EADAF';

/**
 * 内置 API 路由匹配与访问鉴权服务
 *
 * 职责：
 * 1. 把 catalog.js 清单中的 routePath 编译成 path-to-regexp matcher（进程内缓存）。
 * 2. matchApiPermission(method, path)：按 method + path 命中清单条目（含其限制配置），无命中→null。
 * 3. assertBuiltinApiAccess(ctx, matched)：
 *    - 应用令牌（ctx.state.application）→ 校验 application.builtin_api_scope.permissionCodes 含 matched.code，命中放行（跳过角色/组织）。
 *    - 用户令牌（ctx.state.user）→ 按 matched.accessRestriction（role/department）鉴权；未配置→放行（兼容）。
 */

let matchersCache = null; // [{ code, routePath, methodsSet, matchFn }]
let restrictionCache = null; // { [code]: accessRestriction }
let restrictionCacheAt = 0;
const RESTRICTION_TTL_MS = 30 * 1000;

function normalizeAccessRestriction(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }
  // 无限制：显式存储 { mode: 'none' }，与「未配置(null)」区分，但鉴权时都按放行处理
  if (input.mode === 'none') {
    return { mode: 'none', roleIds: [], departmentIds: [] };
  }
  const mode = input.mode === 'role' || input.mode === 'department' ? input.mode : null;
  if (!mode) return null;
  const roleIds = Array.isArray(input.roleIds) ? input.roleIds.map(String).filter(Boolean) : [];
  const departmentIds = Array.isArray(input.departmentIds)
    ? input.departmentIds.map(String).filter(Boolean)
    : [];
  if (mode === 'role' && !roleIds.length) return null;
  if (mode === 'department' && !departmentIds.length) return null;
  return { mode, roleIds, departmentIds };
}

/**
 * 构建路由匹配器（惰性、进程内缓存）。
 * routePath 形如 /api/v1/users/:user_id，使用 path-to-regexp v6 的 match() 编译。
 */
function buildMatchers() {
  if (matchersCache) return matchersCache;
  matchersCache = listBuiltinApis().map((item) => {
    const matchFn = match(item.routePath, { decode: decodeURIComponent });
    return {
      code: item.code,
      routePath: item.routePath,
      methodsSet: new Set((item.httpMethods || []).map((m) => String(m).toUpperCase())),
      matchFn,
    };
  });
  // 具体优先：路径段数多的在前；段数相同时，字面量路径（无参数 :）优先于参数路径，
  // 避免 /roles/check-permission 被 /roles/:role_id 先吃掉。
  matchersCache.sort((a, b) => {
    const segDiff = segmentCount(b.routePath) - segmentCount(a.routePath);
    if (segDiff !== 0) return segDiff;
    const aParam = a.routePath.includes(':') ? 1 : 0;
    const bParam = b.routePath.includes(':') ? 1 : 0;
    return aParam - bParam;
  });
  return matchersCache;
}

function segmentCount(path) {
  return String(path || '').split('/').filter(Boolean).length;
}

/**
 * 重新加载限制配置缓存（TTL 内复用）。
 * 返回 { [code]: accessRestriction }。
 */
async function loadRestrictions(force = false) {
  const now = Date.now();
  if (!force && restrictionCache && now - restrictionCacheAt < RESTRICTION_TTL_MS) {
    return restrictionCache;
  }
  const rows = await BuiltinApiConfig.findAll({ attributes: ['code', 'access_restriction'] });
  const map = {};
  rows.forEach((row) => {
    const code = row.code;
    const normalized = normalizeAccessRestriction(row.access_restriction);
    if (normalized) map[code] = normalized;
  });
  restrictionCache = map;
  restrictionCacheAt = now;
  return map;
}

/**
 * 按 method + path 匹配内置 API 清单条目。
 * 返回 { code, routePath, httpMethods, accessRestriction } 或 null（未命中）。
 */
async function matchApiPermission(method, path) {
  const matchers = buildMatchers();
  const methodUpper = String(method || '').toUpperCase();
  const cleanPath = String(path || '').split('?')[0];
  const restrictions = await loadRestrictions();
  for (const m of matchers) {
    if (!m.methodsSet.has(methodUpper)) continue;
    if (m.matchFn(cleanPath)) {
      return {
        code: m.code,
        routePath: m.routePath,
        httpMethods: Array.from(m.methodsSet),
        accessRestriction: restrictions[m.code] || null,
      };
    }
  }
  return null;
}

function extractUserAuthContext(ctx) {
  const user = ctx.state?.user;
  if (!user) return null;
  return {
    kind: 'user',
    userId: user.user_id || user.id,
    roleIds: user.roleIds || user.role_ids || [],
    departmentId: user.department_id || user.departmentId,
  };
}

/**
 * 鉴权：根据调用主体（应用令牌 / 用户令牌）与命中的内置 API 条目判断是否放行。
 * - 系统内置应用（code=EADAF，本系统）：全部内置 API 放行。
 * - 其他应用令牌：校验 builtin_api_scope.permissionCodes 含 matched.code（命中放行，跳过角色/组织）。
 * - 用户令牌：按 accessRestriction（role/department）鉴权；未配置→放行。
 * 不满足抛 403。
 */
function assertBuiltinApiAccess(ctx, matched) {
  if (!matched) return;

  const application = ctx.state?.application;
  if (application) {
    // EADAF 本系统应用拥有全部内置 API 访问权，不受授权范围限制
    if (application.code === SYSTEM_APPLICATION_CODE) {
      return;
    }
    const scope = parseBuiltinApiScope(application.builtin_api_scope);
    if (!scope.includes(matched.code)) {
      throw Object.assign(new Error('无权访问该内置 API：未授权'), { status: 403 });
    }
    return; // 应用令牌命中授权，跳过角色/组织
  }

  const authContext = extractUserAuthContext(ctx);
  const restriction = matched.accessRestriction;
  if (!restriction || restriction.mode === 'none') {
    // 未配置限制或显式「无限制」：任意已认证用户放行
    return;
  }

  if (!authContext || authContext.kind !== 'user') {
    throw Object.assign(new Error('无权访问该内置 API'), { status: 403 });
  }

  if (restriction.mode === 'role') {
    const userRoleIds = (authContext.roleIds || []).map(String);
    const allowed = restriction.roleIds.some((id) => userRoleIds.includes(id));
    if (!allowed) {
      throw Object.assign(new Error('无权访问该内置 API：角色不满足'), { status: 403 });
    }
    return;
  }

  if (restriction.mode === 'department') {
    const deptId = authContext.departmentId ? String(authContext.departmentId) : null;
    if (!deptId || !restriction.departmentIds.includes(deptId)) {
      throw Object.assign(new Error('无权访问该内置 API：组织不满足'), { status: 403 });
    }
  }
}

function parseBuiltinApiScope(scope) {
  if (!scope || typeof scope !== 'object') return [];
  const codes = Array.isArray(scope.permissionCodes) ? scope.permissionCodes : [];
  return codes.map(String).filter(Boolean);
}

/** 失效缓存（限制配置写入后调用） */
function invalidateCache() {
  restrictionCache = null;
  restrictionCacheAt = 0;
}

module.exports = {
  matchApiPermission,
  assertBuiltinApiAccess,
  normalizeAccessRestriction,
  parseBuiltinApiScope,
  invalidateCache,
  getBuiltinApiByCode,
};
