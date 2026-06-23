const { Department } = require('../models');
const User = require('../models/user');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid');
const logger = require('../utils/logger');

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

      // 如果提供了分页参数，则添加分页
      if (page && size) {
        const offset = (parseInt(page) - 1) * parseInt(size);
        queryOptions.offset = offset;
        queryOptions.limit = parseInt(size);
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

      ctx.body = {
        code: 200,
        message: 'success',
        data: department
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
          .filter(dept => dept.parent_id === parentId)
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

      await department.update(updateData);
      
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
}

module.exports = DepartmentController; 