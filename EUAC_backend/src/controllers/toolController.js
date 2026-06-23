const { v4: uuidv4 } = require('uuid');
const { Tool, Scope } = require('../models');
const { isValidSlug, resolveUniqueSlug } = require('../constants/aiCapabilities');
const { EXECUTION_TYPES } = require('../services/ai/toolInvokeService');
const logger = require('../utils/logger');

function formatTool(tool) {
  const data = tool.toJSON ? tool.toJSON() : tool;
  return {
    id: data.id,
    scopeId: data.scope_id,
    scope: data.scope ? { id: data.scope.id, name: data.scope.name, slug: data.scope.slug } : undefined,
    name: data.name,
    slug: data.slug,
    functionName: data.function_name,
    description: data.description,
    executionType: data.execution_type,
    parametersSchema: data.parameters_schema || {},
    reviewMarkdown: data.review_markdown,
    serverConfig: data.server_config,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

class ToolController {
  static async list(ctx) {
    try {
      const page = Math.max(parseInt(ctx.query.page, 10) || 1, 1);
      const size = Math.min(Math.max(parseInt(ctx.query.size, 10) || 10, 1), 100);
      const where = {};

      if (ctx.query.isActive !== undefined) {
        where.is_active = ctx.query.isActive === 'true';
      }
      if (ctx.query.scopeId) {
        where.scope_id = ctx.query.scopeId;
      }
      if (ctx.query.executionType) {
        where.execution_type = ctx.query.executionType;
      }

      const { count, rows } = await Tool.findAndCountAll({
        where,
        include: [{ model: Scope, as: 'scope', attributes: ['id', 'name', 'slug'] }],
        limit: size,
        offset: (page - 1) * size,
        order: [['created_at', 'DESC']]
      });

      ctx.body = {
        code: 200,
        message: '获取 Tool 列表成功',
        data: { total: count, items: rows.map(formatTool), page, size }
      };
    } catch (error) {
      logger.error('获取 Tool 列表失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Tool 列表失败', data: null };
    }
  }

  static async create(ctx) {
    const {
      scopeId,
      name,
      slug,
      functionName,
      description,
      executionType,
      parametersSchema,
      reviewMarkdown,
      serverConfig
    } = ctx.request.body;

    if (!scopeId || !name || !functionName || !executionType) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'scopeId、name、functionName、executionType 为必填项', data: null };
      return;
    }

    if (!EXECUTION_TYPES.includes(executionType)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: `executionType 必须为 ${EXECUTION_TYPES.join('|')}`, data: null };
      return;
    }

    const trimmedSlug = typeof slug === 'string' ? slug.trim() : '';
    if (trimmedSlug && !isValidSlug(trimmedSlug)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'slug 格式无效', data: null };
      return;
    }

    try {
      const scope = await Scope.findByPk(scopeId);
      if (!scope) {
        ctx.status = 400;
        ctx.body = { code: 400, message: 'Scope 不存在', data: null };
        return;
      }

      const existingFn = await Tool.findOne({ where: { function_name: functionName } });
      if (existingFn) {
        ctx.status = 400;
        ctx.body = { code: 400, message: 'functionName 已存在', data: null };
        return;
      }

      const finalSlug = trimmedSlug || await resolveUniqueSlug(Tool, name);
      if (trimmedSlug) {
        const existing = await Tool.findOne({ where: { slug: finalSlug } });
        if (existing) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
      }

      const tool = await Tool.create({
        id: uuidv4(),
        scope_id: scopeId,
        name,
        slug: finalSlug,
        function_name: functionName,
        description: description || null,
        execution_type: executionType,
        parameters_schema: parametersSchema || { type: 'object', properties: {} },
        review_markdown: reviewMarkdown || null,
        server_config: serverConfig || null,
        is_active: true
      });

      ctx.body = { code: 201, message: '创建 Tool 成功', data: formatTool(tool) };
    } catch (error) {
      logger.error('创建 Tool 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '创建 Tool 失败', data: null };
    }
  }

  static async getById(ctx) {
    try {
      const tool = await Tool.findByPk(ctx.params.id, {
        include: [{ model: Scope, as: 'scope', attributes: ['id', 'name', 'slug'] }]
      });
      if (!tool) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Tool 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取 Tool 详情成功', data: formatTool(tool) };
    } catch (error) {
      logger.error('获取 Tool 详情失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Tool 详情失败', data: null };
    }
  }

  static async update(ctx) {
    const {
      scopeId,
      name,
      slug,
      functionName,
      description,
      executionType,
      parametersSchema,
      reviewMarkdown,
      serverConfig,
      isActive
    } = ctx.request.body;

    try {
      const tool = await Tool.findByPk(ctx.params.id);
      if (!tool) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Tool 不存在', data: null };
        return;
      }

      if (executionType !== undefined && !EXECUTION_TYPES.includes(executionType)) {
        ctx.status = 400;
        ctx.body = { code: 400, message: `executionType 必须为 ${EXECUTION_TYPES.join('|')}`, data: null };
        return;
      }

      if (functionName !== undefined && functionName !== tool.function_name) {
        const existingFn = await Tool.findOne({ where: { function_name: functionName } });
        if (existingFn) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'functionName 已存在', data: null };
          return;
        }
        tool.function_name = functionName;
      }

      if (slug !== undefined) {
        const trimmedSlug = String(slug).trim();
        if (!isValidSlug(trimmedSlug)) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 格式无效', data: null };
          return;
        }
        const existing = await Tool.findOne({ where: { slug: trimmedSlug } });
        if (existing && existing.id !== tool.id) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
        tool.slug = trimmedSlug;
      }

      if (scopeId !== undefined) {
        const scope = await Scope.findByPk(scopeId);
        if (!scope) {
          ctx.status = 400;
          ctx.body = { code: 400, message: 'Scope 不存在', data: null };
          return;
        }
        tool.scope_id = scopeId;
      }

      if (name !== undefined) tool.name = name;
      if (description !== undefined) tool.description = description;
      if (executionType !== undefined) tool.execution_type = executionType;
      if (parametersSchema !== undefined) tool.parameters_schema = parametersSchema;
      if (reviewMarkdown !== undefined) tool.review_markdown = reviewMarkdown;
      if (serverConfig !== undefined) tool.server_config = serverConfig;
      if (isActive !== undefined) tool.is_active = isActive;

      await tool.save();
      ctx.body = { code: 200, message: '更新 Tool 成功', data: formatTool(tool) };
    } catch (error) {
      logger.error('更新 Tool 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '更新 Tool 失败', data: null };
    }
  }

  static async remove(ctx) {
    try {
      const tool = await Tool.findByPk(ctx.params.id);
      if (!tool) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Tool 不存在', data: null };
        return;
      }
      tool.is_active = false;
      await tool.save();
      ctx.body = { code: 200, message: '删除 Tool 成功', data: null };
    } catch (error) {
      logger.error('删除 Tool 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '删除 Tool 失败', data: null };
    }
  }
}

module.exports = ToolController;
