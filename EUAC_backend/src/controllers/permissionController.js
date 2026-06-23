const { Permission, Role, User, RolePermission, DataPermissionRule, sequelize } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

class PermissionController {
  // 分配角色
  static async assignRole(ctx) {
    try {
      const { role_id } = ctx.params;
      const { permission_ids } = ctx.request.body;

      if (!Array.isArray(permission_ids)) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: 'permission_ids 必须是数组',
          data: null
        };
        return;
      }

      // 检查角色是否存在
      const role = await Role.findByPk(role_id);
      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在',
          data: null
        };
        return;
      }

      // 检查权限是否都存在
      const permissions = await Permission.findAll({
        where: {
          permission_id: {
            [Op.in]: permission_ids
          }
        }
      });

      if (permissions.length !== permission_ids.length) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '部分权限不存在',
          data: null
        };
        return;
      }

      // 使用事务确保数据一致性
      await sequelize.transaction(async (t) => {
        // 删除现有的角色-权限关联
        await RolePermission.destroy({
          where: { role_id },
          transaction: t
        });

        // 创建新的角色-权限关联
        const rolePermissions = permission_ids.map(permission_id => ({
          role_id,
          permission_id
        }));

        await RolePermission.bulkCreate(rolePermissions, { transaction: t });
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限分配成功',
        data: null
      };
    } catch (error) {
      console.error('分配权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '分配权限失败',
        error: error.message
      };
    }
  }

  // 获取用户权限
  static async getUserPermissions(ctx) {
    try {
      const { user_id } = ctx.params;

      const permissions = await Permission.findAll({
        include: [{
          model: Role,
          include: [{
            model: User,
            where: { user_id }
          }]
        }]
      });

      ctx.body = {
        code: 200,
        message: '获取用户权限成功',
        data: permissions
      };
    } catch (error) {
      console.error('获取用户权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取用户权限失败',
        error: error.message
      };
    }
  }

  // 检查权限
  static async checkPermission(ctx) {
    try {
      const { user_id, resource_type, action } = ctx.query;

      if (!user_id || !resource_type || !action) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '缺少必要参数：user_id、resource_type 或 action'
        };
        return;
      }

      // 将 action 字符串转换为数组
      const actionList = Array.isArray(action) ? action : action.split(',');

      // 验证操作类型是否合法
      const validActions = ['create', 'read', 'update', 'delete'];
      const invalidActions = actionList.filter(a => !validActions.includes(a));
      if (invalidActions.length > 0) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: `无效的操作类型: ${invalidActions.join(', ')}`
        };
        return;
      }

      const permissions = await Permission.findAll({
        include: [{
          model: Role,
          include: [{
            model: User,
            where: { user_id }
          }]
        }],
        where: {
          resource_type,
          actions: {
            [Op.overlap]: actionList // 使用 PostgreSQL 的数组重叠操作符
          }
        }
      });

      // 检查用户是否有所有请求的操作权限
      const hasAllPermissions = actionList.every(a => 
        permissions.some(p => p.actions.includes(a))
      );

      ctx.body = {
        code: 200,
        message: '权限检查成功',
        data: {
          has_permission: hasAllPermissions,
          permissions: permissions.map(p => ({
            permission_id: p.permission_id,
            name: p.name,
            code: p.code,
            actions: p.actions
          }))
        }
      };
    } catch (error) {
      console.error('检查权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '检查权限失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  // 创建数据权限规则
  static async createRule(ctx) {
    try {
      const { role_id, resource_type, conditions } = ctx.request.body;

      if (!role_id || !resource_type || !conditions) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '缺少必要参数',
          data: null
        };
        return;
      }

      // 检查角色是否存在
      const role = await Role.findByPk(role_id);
      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在',
          data: null
        };
        return;
      }

      const rule = await DataPermissionRule.create({
        rule_id: uuidv4(),
        role_id,
        resource_type,
        conditions,
        status: 'ACTIVE'
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '数据权限规则创建成功',
        data: rule
      };
    } catch (error) {
      console.error('创建数据权限规则失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '创建数据权限规则失败',
        error: error.message
      };
    }
  }

  // 获取数据权限规则
  static async getRules(ctx) {
    try {
      const { role_id, resource_type } = ctx.query;

      const where = {};
      if (role_id) where.role_id = role_id;
      if (resource_type) where.resource_type = resource_type;

      const rules = await DataPermissionRule.findAll({
        where,
        include: [{
          model: Role,
          attributes: ['role_name', 'code']
        }]
      });

      ctx.body = {
        code: 200,
        message: '获取数据权限规则成功',
        data: {
          items: rules,
          total: rules.length
        }
      };
    } catch (error) {
      console.error('获取数据权限规则失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取数据权限规则失败',
        error: error.message
      };
    }
  }

  // 创建权限
  static async create(ctx) {
    const { code, description, resource_type, actions } = ctx.request.body;

    // 验证必填字段
    if (!code || !resource_type || !actions || !Array.isArray(actions)) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '权限编码、资源类型和操作类型不能为空，且操作类型必须是数组'
      };
      return;
    }

    // 验证 actions 数组中的值是否合法
    const validActions = ['create', 'read', 'update', 'delete'];
    const invalidActions = actions.filter(action => !validActions.includes(action));
    if (invalidActions.length > 0) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: `无效的操作类型: ${invalidActions.join(', ')}`
      };
      return;
    }

    try {
      // 检查权限编码是否已存在
      const existingPermission = await Permission.findOne({
        where: { code }
      });

      if (existingPermission) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '权限编码已存在'
        };
        return;
      }

      // 创建权限
      const permission = await Permission.create({
        permission_id: uuidv4(),
        code,
        description,
        resource_type,
        actions,
        status: 'ACTIVE'
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限创建成功',
        data: permission
      };
    } catch (error) {
      console.error('创建权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '创建权限失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  // 获取权限列表
  static async list(ctx) {
    const { page = 1, pageSize = 10, resource_type } = ctx.query;
    const offset = (page - 1) * pageSize;

    try {
      const where = {};
      if (resource_type) {
        where.resource_type = resource_type;
      }

      const { count, rows } = await Permission.findAndCountAll({
        where,
        offset,
        limit: parseInt(pageSize),
        order: [['created_at', 'DESC']]
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '获取权限列表成功',
        data: {
          total: count,
          items: rows,
          page: parseInt(page),
          size: parseInt(pageSize)
        }
      };
    } catch (error) {
      console.error('获取权限列表失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取权限列表失败'
      };
    }
  }

  // 更新权限
  static async update(ctx) {
    try {
      const { permission_id } = ctx.params;
      const { description, resource_type, actions } = ctx.request.body;

      // 检查权限是否存在
      const permission = await Permission.findByPk(permission_id);
      if (!permission) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '权限不存在'
        };
        return;
      }

      // 如果提供了 actions，验证其合法性
      if (actions) {
        if (!Array.isArray(actions)) {
          ctx.status = 400;
          ctx.body = {
            code: 400,
            message: '操作类型必须是数组'
          };
          return;
        }

        const validActions = ['create', 'read', 'update', 'delete'];
        const invalidActions = actions.filter(action => !validActions.includes(action));
        if (invalidActions.length > 0) {
          ctx.status = 400;
          ctx.body = {
            code: 400,
            message: `无效的操作类型: ${invalidActions.join(', ')}`
          };
          return;
        }
      }

      const updateData = {
        description,
        resource_type,
        ...(actions && { actions })
      };

      await permission.update(updateData);

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限更新成功',
        data: permission
      };
    } catch (error) {
      console.error('更新权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '更新权限失败',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }

  // 删除权限
  static async delete(ctx) {
    try {
      const { permission_id } = ctx.params;

      // 检查权限是否存在
      const permission = await Permission.findByPk(permission_id);
      if (!permission) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '权限不存在'
        };
        return;
      }

      // 使用 Sequelize 软删除
      await permission.destroy();

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限删除成功'
      };
    } catch (error) {
      console.error('删除权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '删除权限失败'
      };
    }
  }

  // 移除角色的权限
  static async removeRolePermission(ctx) {
    const { role_id, permission_id } = ctx.params;
    try {
      const rolePermission = await RolePermission.findOne({
        where: { role_id, permission_id }
      });
      if (!rolePermission) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色权限关联不存在'
        };
        return;
      }
      await rolePermission.destroy();
      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '角色权限移除成功'
      };
    } catch (error) {
      console.error('移除角色权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '移除角色权限失败'
      };
    }
  }

  // 获取权限详情
  static async getById(ctx) {
    try {
      const { permission_id } = ctx.params;

      const permission = await Permission.findByPk(permission_id, {
        include: [{
          model: Role,
          through: { attributes: [] }
        }]
      });

      if (!permission) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '权限不存在',
          data: null
        };
        return;
      }

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '获取权限详情成功',
        data: permission
      };
    } catch (error) {
      console.error('获取权限详情失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取权限详情失败',
        error: error.message
      };
    }
  }
}

module.exports = PermissionController; 