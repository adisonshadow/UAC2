const { Role, Permission, RolePermission, sequelize, User, OperationLog } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const config = require('../config');

class RoleController {
  // 创建角色
  static async create(ctx) {
    console.log('创建角色请求体:', JSON.stringify(ctx.request.body, null, 2));
    const { role_name, code, description } = ctx.request.body;

    // 验证必填字段
    if (!role_name || !code) {
      console.log('参数验证失败:', {
        role_name: role_name,
        code: code,
        role_name_type: typeof role_name,
        code_type: typeof code
      });
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '角色名称和编码不能为空',
        debug: {
          received: {
            role_name,
            code,
            description
          },
          validation: {
            role_name_empty: !role_name,
            code_empty: !code
          }
        }
      };
      return;
    }

    try {
      // 检查角色编码是否已存在
      console.log('检查角色编码是否存在:', code);
      const existingRole = await Role.findOne({
        where: { code }
      });

      if (existingRole) {
        console.log('角色编码已存在:', {
          existing_role: existingRole.toJSON()
        });
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '角色编码已存在',
          debug: {
            existing_role: existingRole.toJSON()
          }
        };
        return;
      }

      // 创建角色
      console.log('开始创建角色:', {
        role_name,
        code,
        description,
        status: 'ACTIVE'
      });
      const role = await Role.create({
        role_id: uuidv4(),
        role_name,
        code,
        description,
        status: 'ACTIVE'
      });

      console.log('角色创建成功:', role.toJSON());
      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '角色创建成功',
        data: role
      };
    } catch (error) {
      console.error('创建角色失败:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        request_body: ctx.request.body
      });
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '创建角色失败',
        debug: {
          error_name: error.name,
          error_message: error.message,
          request_body: ctx.request.body
        }
      };
    }
  }

  // 获取角色列表
  static async list(ctx) {
    const { page = 1, size = 10, status } = ctx.query;
    const offset = (page - 1) * size;

    try {
      const where = {
        deleted_at: null  // 只查询未删除的角色
      };
      if (status) {
        where.status = status;
      }

      const { count, rows } = await Role.findAndCountAll({
        where,
        offset,
        limit: parseInt(size),
        order: [['created_at', 'DESC']],
        include: [{
          model: Permission,
          through: { attributes: [] }
        }]
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '获取角色列表成功',
        data: {
          total: count,
          items: rows,
          page: parseInt(page),
          size: parseInt(size)
        }
      };
    } catch (error) {
      console.error('获取角色列表失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取角色列表失败'
      };
    }
  }

  // 获取角色详情
  static async getById(ctx) {
    const { role_id } = ctx.params;

    try {
      const role = await Role.findOne({
        where: {
          role_id,
          deleted_at: null  // 只查询未删除的角色
        },
        include: [{
          model: Permission,
          through: { attributes: [] }
        }]
      });

      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在'
        };
        return;
      }

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '获取角色详情成功',
        data: role
      };
    } catch (error) {
      console.error('获取角色详情失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取角色详情失败'
      };
    }
  }

  // 更新角色
  static async update(ctx) {
    const { role_id } = ctx.params;
    const { role_name, description, status } = ctx.request.body;

    try {
      const role = await Role.findByPk(role_id);
      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在'
        };
        return;
      }

      // 记录更新前的数据
      const oldData = {
        role_name: role.role_name,
        description: role.description,
        status: role.status
      };

      // 更新角色信息
      await role.update({
        role_name,
        description,
        status
      });

      // 记录操作日志
      try {
        await OperationLog.create({
          operation_type: 'UPDATE',
          resource_type: 'role',
          resource_id: role_id,
          old_data: oldData,
          new_data: {
            role_name,
            description,
            status
          },
          status: 'SUCCESS'
        });
      } catch (logError) {
        console.error('记录操作日志失败:', logError);
      }

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '角色更新成功',
        data: role
      };
    } catch (error) {
      console.error('更新角色失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '更新角色失败'
      };
    }
  }

  // 删除角色
  static async delete(ctx) {
    const { role_id } = ctx.params;

    try {
      // 检查角色是否存在
      const role = await Role.findOne({ 
        where: { role_id: role_id }
      });
      
      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在'
        };
        return;
      }

      // 记录删除前的数据
      const oldData = {
        role_name: role.role_name,
        code: role.code,
        description: role.description,
        status: role.status,
        deleted_at: role.deleted_at
      };

      // 执行软删除
      await role.softDelete();

      // 记录操作日志
      try {
        await OperationLog.create({
          operation_type: 'DELETE',
          resource_type: 'role',
          resource_id: role_id,
          old_data: oldData,
          new_data: {
            deleted_at: new Date()
          },
          status: 'SUCCESS'
        });
      } catch (logError) {
        console.error('记录操作日志失败:', logError);
      }

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '角色删除成功'
      };
    } catch (error) {
      console.error('删除角色失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '删除角色失败'
      };
    }
  }

  // 给角色分配权限
  static async assignPermissions(ctx) {
    const { role_id } = ctx.params;
    const { permission_ids } = ctx.request.body;

    if (!Array.isArray(permission_ids)) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '权限ID列表格式不正确'
      };
      return;
    }

    try {
      const role = await Role.findByPk(role_id);
      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在'
        };
        return;
      }

      // 验证所有权限是否存在
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
          message: '部分权限ID不存在'
        };
        return;
      }

      // 使用事务确保数据一致性
      await sequelize.transaction(async (t) => {
        // 先删除该角色的所有现有权限
        await RolePermission.destroy({
          where: { role_id },
          transaction: t
        });

        // 添加新的权限关联
        const rolePermissions = permission_ids.map(permission_id => ({
          role_id,
          permission_id,
          created_at: new Date(),
          updated_at: new Date()
        }));

        await RolePermission.bulkCreate(rolePermissions, { transaction: t });
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限分配成功'
      };
    } catch (error) {
      console.error('分配权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '分配权限失败'
      };
    }
  }

  // 批量更新角色权限
  static async updatePermissions(ctx) {
    const { role_id } = ctx.params;
    const { add_permissions = [], remove_permissions = [] } = ctx.request.body;

    if (!Array.isArray(add_permissions) || !Array.isArray(remove_permissions)) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '权限列表格式不正确'
      };
      return;
    }

    try {
      const role = await Role.findByPk(role_id);
      if (!role) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '角色不存在'
        };
        return;
      }

      await sequelize.transaction(async (t) => {
        // 添加新权限
        if (add_permissions.length > 0) {
          const newRolePermissions = add_permissions.map(permission_id => ({
            role_id,
            permission_id,
            created_at: new Date(),
            updated_at: new Date()
          }));
          await RolePermission.bulkCreate(newRolePermissions, { transaction: t });
        }

        // 移除指定权限
        if (remove_permissions.length > 0) {
          await RolePermission.destroy({
            where: {
              role_id,
              permission_id: {
                [Op.in]: remove_permissions
              }
            },
            transaction: t
          });
        }
      });

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限更新成功'
      };
    } catch (error) {
      console.error('更新权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '更新权限失败'
      };
    }
  }

  // 检查用户是否拥有某个权限
  static async checkUserPermission(ctx) {
    const { user_id } = ctx.params;
    const { permission_code } = ctx.query;

    if (!permission_code) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '权限编码不能为空'
      };
      return;
    }

    try {
      const user = await User.findByPk(user_id, {
        include: [{
          model: Role,
          include: [{
            model: Permission,
            where: {
              code: permission_code
            }
          }]
        }]
      });

      if (!user) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '用户不存在'
        };
        return;
      }

      // 检查用户是否通过任何角色拥有该权限
      const hasPermission = user.Roles.some(role => role.Permissions.length > 0);

      ctx.status = 200;
      ctx.body = {
        code: 200,
        message: '权限检查成功',
        data: {
          has_permission: hasPermission
        }
      };
    } catch (error) {
      console.error('检查权限失败:', error);
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '检查权限失败'
      };
    }
  }
}

module.exports = RoleController; 