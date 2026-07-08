const { Role, Department } = require('../models');

function formatRole(role) {
  const row = role.toJSON ? role.toJSON() : role;
  return {
    role_id: row.role_id,
    role_name: row.role_name,
    code: row.code,
    status: row.status
  };
}

function mergeRolesById(...roleLists) {
  const map = new Map();
  roleLists.flat().forEach((role) => {
    if (role?.role_id) {
      map.set(role.role_id, formatRole(role));
    }
  });
  return Array.from(map.values());
}

async function loadDepartmentRoles(departmentId) {
  if (!departmentId) return [];
  const department = await Department.findByPk(departmentId, {
    include: [{
      model: Role,
      attributes: ['role_id', 'role_name', 'code', 'status'],
      through: { attributes: [] }
    }]
  });
  return (department?.Roles || []).map(formatRole);
}

async function assignRolesToEntity(entity, roleIds, { transaction } = {}) {
  const uniqueIds = [...new Set((roleIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    await entity.setRoles([], { transaction });
    return [];
  }
  const roles = await Role.findAll({ where: { role_id: uniqueIds }, transaction });
  if (roles.length !== uniqueIds.length) {
    const err = new Error('部分角色不存在');
    err.status = 400;
    throw err;
  }
  await entity.setRoles(roles, { transaction });
  return roles.map(formatRole);
}

module.exports = {
  formatRole,
  mergeRolesById,
  loadDepartmentRoles,
  assignRolesToEntity
};
