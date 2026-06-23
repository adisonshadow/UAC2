const { v4: uuidv4 } = require('uuid');
const { Scope } = require('../models');
const { isValidSlug, resolveUniqueSlug } = require('../constants/aiCapabilities');
const logger = require('../utils/logger');

function formatScope(scope) {
  const data = scope.toJSON ? scope.toJSON() : scope;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

class ScopeController {
  static async list(ctx) {
    try {
      const page = Math.max(parseInt(ctx.query.page, 10) || 1, 1);
      const size = Math.min(Math.max(parseInt(ctx.query.size, 10) || 10, 1), 100);
      const where = {};

      if (ctx.query.isActive !== undefined) {
        where.is_active = ctx.query.isActive === 'true';
      }

      const { count, rows } = await Scope.findAndCountAll({
        where,
        limit: size,
        offset: (page - 1) * size,
        order: [['created_at', 'DESC']]
      });

      ctx.body = {
        code: 200,
        message: '获取 Scope 列表成功',
        data: { total: count, items: rows.map(formatScope), page, size }
      };
    } catch (error) {
      logger.error('获取 Scope 列表失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Scope 列表失败', data: null };
    }
  }

  static async create(ctx) {
    const { name, slug, description } = ctx.request.body;
    if (!name) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'name 为必填项', data: null };
      return;
    }

    const trimmedSlug = typeof slug === 'string' ? slug.trim() : '';
    if (trimmedSlug && !isValidSlug(trimmedSlug)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'slug 格式无效', data: null };
      return;
    }

    try {
      const finalSlug = trimmedSlug || await resolveUniqueSlug(Scope, name);
      if (trimmedSlug) {
        const existing = await Scope.findOne({ where: { slug: finalSlug } });
        if (existing) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
      }

      const scope = await Scope.create({
        id: uuidv4(),
        name,
        slug: finalSlug,
        description: description || null,
        is_active: true
      });

      ctx.body = { code: 201, message: '创建 Scope 成功', data: formatScope(scope) };
    } catch (error) {
      logger.error('创建 Scope 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '创建 Scope 失败', data: null };
    }
  }

  static async getById(ctx) {
    try {
      const scope = await Scope.findByPk(ctx.params.id);
      if (!scope) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Scope 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取 Scope 详情成功', data: formatScope(scope) };
    } catch (error) {
      logger.error('获取 Scope 详情失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Scope 详情失败', data: null };
    }
  }

  static async update(ctx) {
    const { name, slug, description, isActive } = ctx.request.body;
    try {
      const scope = await Scope.findByPk(ctx.params.id);
      if (!scope) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Scope 不存在', data: null };
        return;
      }

      if (slug !== undefined) {
        const trimmedSlug = String(slug).trim();
        if (!isValidSlug(trimmedSlug)) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 格式无效', data: null };
          return;
        }
        const existing = await Scope.findOne({ where: { slug: trimmedSlug } });
        if (existing && existing.id !== scope.id) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
        scope.slug = trimmedSlug;
      }

      if (name !== undefined) scope.name = name;
      if (description !== undefined) scope.description = description;
      if (isActive !== undefined) scope.is_active = isActive;

      await scope.save();
      ctx.body = { code: 200, message: '更新 Scope 成功', data: formatScope(scope) };
    } catch (error) {
      logger.error('更新 Scope 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '更新 Scope 失败', data: null };
    }
  }

  static async remove(ctx) {
    try {
      const scope = await Scope.findByPk(ctx.params.id);
      if (!scope) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Scope 不存在', data: null };
        return;
      }
      scope.is_active = false;
      await scope.save();
      ctx.body = { code: 200, message: '删除 Scope 成功', data: null };
    } catch (error) {
      logger.error('删除 Scope 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '删除 Scope 失败', data: null };
    }
  }
}

module.exports = ScopeController;
