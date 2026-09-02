const { Department, Role, sequelize } = require('../models');
const User = require('../models/user');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid');
const logger = require('../utils/logger');
const { formatRole, assignRolesToEntity } = require('../services/roleBindingService');

class DepartmentController {
  // 创建部门
  static async create(ctx) {
    try {
      const { name, description, parent_id, status = 'ACTIVE' } = ctx.request.body;

      // 创建部门
      const department = await Department.create({
        name,
        description,
        parent_id,
        status
      });

      ctx.state.auditContext = {
        resource_id: department.department_id,
        resource_name: department.name,
        new_data: {
          department_id: department.department_id,
          name: department.name,
          description: department.description,
          parent_id: department.parent_id,
          status: department.status,
        },
      };

      ctx.status = 201;
      ctx.body = {
        code: 201,
        message: '部门创建成功',
        data: department
      };
    } catch (error) {
      logger.error('创建部门失败', { 
        error: error.message,
        body: ctx.request.body 
      });
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '创建部门失败',
        error: error.message
      };
    }
  }

  // 获取部门列表
  static async list(ctx) {
    try {
      const { page, size, name, status } = ctx.query;
      const where = {};
      if (name) where.name = { [Op.like]: `%${name}%` };
      if (status) where.status = status;

      // 构建查询选项
      const queryOptions = {
        where,
        order: [['created_at', 'DESC']],
        attributes: [
          'department_id',
          'name',
          'parent_id',
          'status',
          'description',
          'created_at',
          'updated_at',
          'deleted_at'
        ]
      };

      const parsedPage = page != null ? parseInt(page, 10) : null;
      const parsedSize = size != null ? parseInt(size, 10) : null;

      // size=-1 表示不分页，返回全部记录
      if (parsedSize === -1) {
        // 不设置 offset/limit
      } else if (parsedPage && parsedSize) {
        queryOptions.offset = (parsedPage - 1) * parsedSize;
        queryOptions.limit = parsedSize;
      }

      const { count, rows } = await Department.findAndCountAll(queryOptions);

      ctx.body = {
        code: 200,
        message: 'success',
        data: {
          total: count,
          items: rows,
          ...(page && size ? {
            current: parseInt(page),
            size: parseInt(size)
          } : {})
        }
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取部门列表失败',
        error: error.message
      };
    }
  }

  // 获取部门详情
  static async getById(ctx) {
    try {
      const { department_id } = ctx.params;

      // 新增：UUID 校验
      if (!isUuid(department_id)) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '部门不存在',
          data: null
        };
        return;
      }

      const department = await Department.findByPk(department_id, {
        include: [{
          model: Role,
          attributes: ['role_id', 'role_name', 'code', 'status'],
          through: { attributes: [] },
          required: false
        }]
      });

      if (!department) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '部门不存在',
          data: null
        };
        return;
      }

      const json = department.toJSON();
      const roles = (json.Roles || []).map(formatRole);

      ctx.body = {
        code: 200,
        message: 'success',
        data: {
          ...json,
          roles,
          role_ids: roles.map((r) => r.role_id)
        }
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取部门详情失败',
        error: error.message
      };
    }
  }

  // 获取部门树
  static async getTree(ctx) {
    try {
      // 先获取所有部门
      const allDepartments = await Department.findAll({
        attributes: [
          'department_id',
          'name',
          'parent_id',
          'status',
          'description',
          'created_at',
          'updated_at'
        ],
        order: [['created_at', 'ASC']]
      });

      // 构建部门树
      const buildTree = (departments, parentId = null) => {
        return departments
          .filter(dept => (dept.parent_id || null) === parentId)
          .map(dept => ({
            ...dept.toJSON(),
            children: buildTree(departments, dept.department_id)
          }));
      };

      const tree = buildTree(allDepartments);

      ctx.body = {
        code: 200,
        message: 'success',
        data: {
          items: tree
        }
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取部门树失败',
        error: error.message
      };
    }
  }

  // 更新部门
  static async update(ctx) {
    try {
      const { department_id } = ctx.params;
      const updateData = ctx.request.body;

      const department = await Department.findByPk(department_id);
      
      if (!department) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '部门不存在',
          data: null
        };
        return;
      }

      const oldData = {
        name: department.name,
        description: department.description,
        parent_id: department.parent_id,
        status: department.status,
      };

      await department.update(updateData);

      ctx.state.auditContext = {
        resource_id: department_id,
        resource_name: department.name,
        old_data: oldData,
        new_data: {
          name: department.name,
          description: department.description,
          parent_id: department.parent_id,
          status: department.status,
        },
      };
      
      ctx.body = {
        code: 200,
        message: 'success',
        data: department
      };
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '部门编码已存在',
          error: error.message
        };
      } else {
        ctx.status = 500;
        ctx.body = {
          code: 500,
          message: '更新部门失败',
          error: error.message
        };
      }
    }
  }

  // 删除部门
  static async delete(ctx) {
    try {
      const { department_id } = ctx.params;
      const department = await Department.findByPk(department_id);

      if (!department) {
        ctx.status = 404;
        ctx.body = {
          code: 404,
          message: '部门不存在',
          data: null
        };
        return;
      }

      // 检查是否有子部门
      const hasChildren = await Department.count({
        where: { parent_id: department_id }
      });

      if (hasChildren > 0) {
        ctx.status = 400;
        ctx.body = {
          code: 400,
          message: '该部门下存在子部门，无法删除',
          data: null
        };
        return;
      }

      await department.destroy();

      ctx.state.auditContext = {
        resource_id: department_id,
        resource_name: department.name,
        old_data: {
          name: department.name,
          description: department.description,
          parent_id: department.parent_id,
          status: department.status,
        },
      };
      
      ctx.body = {
        code: 200,
        message: 'success',
        data: null
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '删除部门失败',
        error: error.message
      };
    }
  }

  // 获取部门成员
  static async getMembers(ctx) {
    try {
      const { department_id } = ctx.params;
      const { include_children } = ctx.query;

      let departmentIds = [department_id];

      if (include_children === 'true') {
        const childDepartments = await Department.findAll({
          where: {
            parent_id: department_id
          }
        });
        departmentIds = departmentIds.concat(
          childDepartments.map(dept => dept.department_id)
        );
      }

      const users = await User.findAll({
        where: {
          department_id: departmentIds
        }
      });

      ctx.body = {
        code: 200,
        message: 'success',
        data: users
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: 500,
        message: '获取部门成员失败',
        error: error.message
      };
    }
  }

  // 为部门分配角色
  static async assignRoles(ctx) {
    const { department_id } = ctx.params;
    const { role_ids } = ctx.request.body;

    if (!isUuid(department_id)) {
      ctx.status = 404;
      ctx.body = { code: 404, message: '部门不存在', data: null };
      return;
    }

    if (!Array.isArray(role_ids)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'role_ids 必须为数组', data: null };
      return;
    }

    try {
      const department = await Department.findByPk(department_id);
      if (!department) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '部门不存在', data: null };
        return;
      }

      const roles = await sequelize.transaction((t) =>
        assignRolesToEntity(department, role_ids, { transaction: t })
      );

      ctx.state.auditContext = {
        resource_id: department_id,
        resource_name: department.name,
        new_data: { role_ids },
      };

      ctx.body = {
        code: 200,
        message: '分配成功',
        data: {
          department_id,
          roles
        }
      };
    } catch (error) {
      if (error.status === 400) {
        ctx.status = 400;
        ctx.body = { code: 400, message: error.message, data: null };
        return;
      }
      logger.error('为部门分配角色失败', { error: error.message, department_id });
      ctx.status = 500;
      ctx.body = { code: 500, message: '服务器内部错误', data: null };
    }
  }
}

module.exports = DepartmentController; 