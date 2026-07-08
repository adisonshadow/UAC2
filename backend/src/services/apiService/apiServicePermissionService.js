const { BizdataApiServicePermission } = require('../../models');

function permissionsToAccessRestriction(permissions = []) {
  if (!permissions.length) {
    return { mode: 'none', roleIds: [], departmentIds: [] };
  }
  const roleIds = permissions
    .filter((p) => p.grantType === 'role' || p.grant_type === 'role')
    .map((p) => String(p.grantId || p.grant_id));
  const departmentIds = permissions
    .filter((p) => p.grantType === 'department' || p.grant_type === 'department')
    .map((p) => String(p.grantId || p.grant_id));
  if (roleIds.length) {
    return { mode: 'role', roleIds, departmentIds: [] };
  }
  if (departmentIds.length) {
    return { mode: 'department', roleIds: [], departmentIds };
  }
  return { mode: 'none', roleIds: [], departmentIds: [] };
}

function normalizeAccessRestriction(input) {
  if (!input || typeof input !== 'object') {
    return { mode: 'none', roleIds: [], departmentIds: [] };
  }
  const mode = input.mode === 'role' || input.mode === 'department' ? input.mode : 'none';
  const roleIds = Array.isArray(input.roleIds) ? input.roleIds.map(String).filter(Boolean) : [];
  const departmentIds = Array.isArray(input.departmentIds)
    ? input.departmentIds.map(String).filter(Boolean)
    : [];
  if (mode === 'role') return { mode, roleIds, departmentIds: [] };
  if (mode === 'department') return { mode, roleIds: [], departmentIds };
  return { mode: 'none', roleIds: [], departmentIds: [] };
}

async function syncPermissions(apiServiceId, accessRestriction, transaction) {
  const normalized = normalizeAccessRestriction(accessRestriction);
  await BizdataApiServicePermission.destroy({
    where: { api_service_id: apiServiceId },
    transaction,
  });

  const rows = [];
  if (normalized.mode === 'role') {
    normalized.roleIds.forEach((grantId) => {
      rows.push({
        api_service_id: apiServiceId,
        grant_type: 'role',
        grant_id: grantId,
        actions: ['invoke'],
      });
    });
  } else if (normalized.mode === 'department') {
    normalized.departmentIds.forEach((grantId) => {
      rows.push({
        api_service_id: apiServiceId,
        grant_type: 'department',
        grant_id: grantId,
        actions: ['invoke'],
      });
    });
  }

  if (rows.length) {
    await BizdataApiServicePermission.bulkCreate(rows, { transaction });
  }
  return normalized;
}

function assertAccessAllowed(service, authContext, { bypass = false } = {}) {
  if (bypass) return;
  const securityConfig = service?.securityConfig || service?.security_config || {};
  if (securityConfig.bypassAccessControlInTest === true && bypass) return;

  const permissions = service?.permissions || [];
  const restriction = permissionsToAccessRestriction(permissions);
  if (restriction.mode === 'none') return;

  if (!authContext || authContext.kind !== 'user') {
    throw Object.assign(new Error('无权访问该 API 服务'), { status: 403 });
  }

  if (restriction.mode === 'role') {
    const userRoleIds = (authContext.roleIds || []).map(String);
    const allowed = restriction.roleIds.some((id) => userRoleIds.includes(id));
    if (!allowed) {
      throw Object.assign(new Error('无权访问：角色不满足'), { status: 403 });
    }
    return;
  }

  if (restriction.mode === 'department') {
    const deptId = authContext.departmentId ? String(authContext.departmentId) : null;
    if (!deptId || !restriction.departmentIds.includes(deptId)) {
      throw Object.assign(new Error('无权访问：组织不满足'), { status: 403 });
    }
  }
}

module.exports = {
  syncPermissions,
  normalizeAccessRestriction,
  permissionsToAccessRestriction,
  assertAccessAllowed,
};
