const config = require('../../config');
const Application = require('../../models/application');
const User = require('../../models/user');
const Role = require('../../models/role');

function normalizeRestrictions(raw = {}) {
  return {
    same_application: !!raw.same_application,
    role_ids: Array.isArray(raw.role_ids) ? raw.role_ids.map(String) : [],
    scope_codes: Array.isArray(raw.scope_codes) ? raw.scope_codes.map(String) : [],
  };
}

function hasScopeOverlap(appScopes = [], requiredScopes = []) {
  if (!requiredScopes.length) return true;
  const appSet = new Set(appScopes);
  return requiredScopes.some((code) => appSet.has(code));
}

async function resolveRequestApplicationId(authContext) {
  if (!authContext) return null;
  if (authContext.kind === 'application') return authContext.applicationId;
  return config.systemApplication.applicationId || null;
}

async function loadApplicationScopes(applicationId) {
  if (!applicationId) return [];
  const app = await Application.findByPk(applicationId, {
    attributes: ['application_id', 'bizdata_scope_codes'],
  });
  if (!app) return [];
  const codes = app.bizdata_scope_codes;
  return Array.isArray(codes) ? codes : [];
}

async function loadUserRoleIds(userId) {
  if (!userId) return [];
  const user = await User.findByPk(userId, {
    include: [{ model: Role, attributes: ['role_id'], through: { attributes: [] } }],
  });
  if (!user?.Roles) return [];
  return user.Roles.map((r) => String(r.role_id));
}

async function assertObjectAccess({ bucket, object, authContext }) {
  if (bucket.access_mode === 'public') return;

  if (!authContext) {
    const err = new Error('需要授权访问');
    err.status = 401;
    throw err;
  }

  const restrictions = normalizeRestrictions(bucket.access_restrictions);
  const requestApplicationId = await resolveRequestApplicationId(authContext);
  const enabledPolicies = [];

  if (restrictions.same_application) {
    enabledPolicies.push('same_application');
    if (!object.application_id || !requestApplicationId || String(object.application_id) !== String(requestApplicationId)) {
      const err = new Error('无权访问：必须与上传相同应用');
      err.status = 403;
      throw err;
    }
  }

  if (restrictions.role_ids.length) {
    enabledPolicies.push('role_ids');
    if (authContext.kind !== 'user') {
      const err = new Error('无权访问：需要用户角色授权');
      err.status = 403;
      throw err;
    }
    const userRoleIds = await loadUserRoleIds(authContext.userId);
    const allowed = restrictions.role_ids.some((id) => userRoleIds.includes(String(id)));
    if (!allowed) {
      const err = new Error('无权访问：角色不满足');
      err.status = 403;
      throw err;
    }
  }

  if (restrictions.scope_codes.length) {
    enabledPolicies.push('scope_codes');
    const appScopes = await loadApplicationScopes(requestApplicationId);
    if (!hasScopeOverlap(appScopes, restrictions.scope_codes)) {
      const err = new Error('无权访问：应用 Scope 无重叠');
      err.status = 403;
      throw err;
    }
  }

  // authenticated 且无额外策略时，仅要求已登录
  return { requestApplicationId, enabledPolicies };
}

function resolveUploadApplicationId(authContext, explicitApplicationId) {
  if (explicitApplicationId) return explicitApplicationId;
  if (authContext?.kind === 'application') return authContext.applicationId;
  return config.systemApplication.applicationId || null;
}

function resolveUploadUserId(authContext) {
  if (authContext?.kind === 'user') return authContext.userId;
  return null;
}

module.exports = {
  normalizeRestrictions,
  assertObjectAccess,
  resolveRequestApplicationId,
  resolveUploadApplicationId,
  resolveUploadUserId,
  hasScopeOverlap,
};
