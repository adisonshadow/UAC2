const { match } = require('path-to-regexp');
const { BuiltinApiConfig, User, Role, UserRole } = require('../../models');
const { listBuiltinApis, getBuiltinApiByCode } = require('./catalog');

/** 系统内置应用 code：该应用为 EADAF 本系统，拥有全部内置 API 访问权，不受授权范围限制 */
const SYSTEM_APPLICATION_CODE = 'EADAF';
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

let matchersCache = null;
let restrictionCache = null;
let restrictionCacheAt = 0;
const RESTRICTION_TTL_MS = 30 * 1000;

/** user_id → { roleIds, roleCodes, departmentId, cachedAt } */
const userAuthCache = new Map();
const USER_AUTH_CACHE_TTL_MS = 60 * 1000;

function normalizeAccessRestriction(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }
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
    roleCodes: user.roleCodes || user.role_codes || [],
    departmentId: user.department_id || user.departmentId,
  };
}

async function resolveUserAuthFromDb(userId) {
  const key = String(userId);
  const cached = userAuthCache.get(key);
  const now = Date.now();
  if (cached && now - cached.cachedAt < USER_AUTH_CACHE_TTL_MS) {
    return cached;
  }

  const user = await User.findByPk(userId, {
    attributes: ['user_id', 'department_id'],
  });
  if (!user) {
    const empty = { roleIds: [], roleCodes: [], departmentId: null, cachedAt: now };
    userAuthCache.set(key, empty);
    return empty;
  }

  const userRoles = await UserRole.findAll({
    where: { user_id: userId },
    attributes: ['role_id'],
  });
  const roleIds = userRoles.map((ur) => String(ur.role_id)).filter(Boolean);
  let roleCodes = [];
  if (roleIds.length) {
    const roles = await Role.findAll({
      where: { role_id: roleIds },
      attributes: ['role_id', 'code'],
    });
    roleCodes = roles.map((r) => r.code).filter(Boolean);
  }

  const resolved = {
    roleIds,
    roleCodes,
    departmentId: user.department_id ? String(user.department_id) : null,
    cachedAt: now,
  };
  userAuthCache.set(key, resolved);
  return resolved;
}

async function enrichUserAuthContext(authContext) {
  if (!authContext?.userId) return authContext;

  const hasRoleIds = Array.isArray(authContext.roleIds) && authContext.roleIds.length > 0;
  const hasDept = Boolean(authContext.departmentId);
  const hasRoleCodes = Array.isArray(authContext.roleCodes) && authContext.roleCodes.length > 0;

  if (hasRoleIds && hasDept && hasRoleCodes) {
    return authContext;
  }

  const fromDb = await resolveUserAuthFromDb(authContext.userId);
  return {
    ...authContext,
    roleIds: hasRoleIds ? authContext.roleIds : fromDb.roleIds,
    roleCodes: hasRoleCodes ? authContext.roleCodes : fromDb.roleCodes,
    departmentId: hasDept ? authContext.departmentId : fromDb.departmentId,
  };
}

/**
 * 鉴权：根据调用主体（应用令牌 / 用户令牌）与命中的内置 API 条目判断是否放行。
 */
async function assertBuiltinApiAccess(ctx, matched) {
  if (!matched) return;

  const application = ctx.state?.application;
  if (application) {
    if (application.code === SYSTEM_APPLICATION_CODE) {
      return;
    }
    const scope = parseBuiltinApiScope(application.builtin_api_scope);
    if (!scope.includes(matched.code)) {
      throw Object.assign(new Error('无权访问该内置 API：未授权'), { status: 403 });
    }
    return;
  }

  const restriction = matched.accessRestriction;
  if (!restriction || restriction.mode === 'none') {
    return;
  }

  let authContext = extractUserAuthContext(ctx);
  if (!authContext || authContext.kind !== 'user') {
    throw Object.assign(new Error('无权访问该内置 API'), { status: 403 });
  }

  authContext = await enrichUserAuthContext(authContext);

  if ((authContext.roleCodes || []).includes(SUPER_ADMIN_ROLE_CODE)) {
    return;
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

function invalidateCache() {
  restrictionCache = null;
  restrictionCacheAt = 0;
  userAuthCache.clear();
}

module.exports = {
  matchApiPermission,
  assertBuiltinApiAccess,
  normalizeAccessRestriction,
  parseBuiltinApiScope,
  invalidateCache,
  getBuiltinApiByCode,
};
