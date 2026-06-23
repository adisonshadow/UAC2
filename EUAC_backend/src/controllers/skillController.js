const { v4: uuidv4 } = require('uuid');
const { Skill, Tool, SkillTool, Scope } = require('../models');
const { isValidSlug, resolveUniqueSlug } = require('../constants/aiCapabilities');
const { formatOpenAITool } = require('../services/ai/toolInvokeService');
const logger = require('../utils/logger');

function formatToolBrief(tool) {
  const data = tool.toJSON ? tool.toJSON() : tool;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    functionName: data.function_name,
    description: data.description,
    executionType: data.execution_type,
    parametersSchema: data.parameters_schema || {},
    reviewMarkdown: data.review_markdown,
    serverConfig: data.server_config,
    isActive: data.is_active
  };
}

function formatSkill(skill, includeTools = true) {
  const data = skill.toJSON ? skill.toJSON() : skill;
  const result = {
    id: data.id,
    scopeId: data.scope_id || data.scopeId || null,
    scopeSlug: data.scope?.slug || null,
    name: data.name,
    slug: data.slug,
    description: data.description,
    contentMarkdown: data.content_markdown,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };

  if (includeTools && data.tools) {
    result.tools = data.tools
      .sort((a, b) => (a.SkillTool?.sort_order || 0) - (b.SkillTool?.sort_order || 0))
      .map(formatToolBrief);
    result.toolIds = result.tools.map((item) => item.id);
  }

  return result;
}

class SkillController {
  static async list(ctx) {
    try {
      const page = Math.max(parseInt(ctx.query.page, 10) || 1, 1);
      const size = Math.min(Math.max(parseInt(ctx.query.size, 10) || 10, 1), 100);
      const where = {};

      if (ctx.query.isActive !== undefined) {
        where.is_active = ctx.query.isActive === 'true';
      }

      const include = [{
        model: Tool,
        as: 'tools',
        through: { attributes: ['sort_order'] },
        required: false
      }];

      // findAndCountAll + belongsToMany include 会把 limit/offset 打在 JOIN 行上，导致第二页为空
      const count = await Skill.count({ where });
      const rows = await Skill.findAll({
        where,
        include,
        limit: size,
        offset: (page - 1) * size,
        order: [['created_at', 'DESC']]
      });

      ctx.body = {
        code: 200,
        message: '获取 Skill 列表成功',
        data: { total: count, items: rows.map((row) => formatSkill(row)), page, size }
      };
    } catch (error) {
      logger.error('获取 Skill 列表失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Skill 列表失败', data: null };
    }
  }

  static async create(ctx) {
    const { name, slug, description, contentMarkdown, toolIds = [], scopeId } = ctx.request.body;
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

    const transaction = await Skill.sequelize.transaction();
    try {
      const finalSlug = trimmedSlug || await resolveUniqueSlug(Skill, name, { transaction });
      if (trimmedSlug) {
        const existing = await Skill.findOne({ where: { slug: finalSlug }, transaction });
        if (existing) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
      }

      const skill = await Skill.create({
        id: uuidv4(),
        name,
        slug: finalSlug,
        description: description || null,
        content_markdown: contentMarkdown || '',
        scope_id: scopeId || null,
        is_active: true
      }, { transaction });

      if (Array.isArray(toolIds) && toolIds.length > 0) {
        const tools = await Tool.findAll({ where: { id: toolIds }, transaction });
        await Promise.all(tools.map((tool, index) => SkillTool.create({
          id: uuidv4(),
          skill_id: skill.id,
          tool_id: tool.id,
          sort_order: index
        }, { transaction })));
      }

      await transaction.commit();

      const created = await Skill.findByPk(skill.id, {
        include: [{ model: Tool, as: 'tools', through: { attributes: ['sort_order'] } }]
      });

      ctx.body = { code: 201, message: '创建 Skill 成功', data: formatSkill(created) };
    } catch (error) {
      await transaction.rollback();
      logger.error('创建 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '创建 Skill 失败', data: null };
    }
  }

  static async getById(ctx) {
    try {
      const skill = await Skill.findByPk(ctx.params.id, {
        include: [{ model: Tool, as: 'tools', through: { attributes: ['sort_order'] } }]
      });
      if (!skill) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Skill 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取 Skill 详情成功', data: formatSkill(skill) };
    } catch (error) {
      logger.error('获取 Skill 详情失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Skill 详情失败', data: null };
    }
  }

  static async update(ctx) {
    const { name, slug, description, contentMarkdown, toolIds, isActive, scopeId } = ctx.request.body;
    const transaction = await Skill.sequelize.transaction();

    try {
      const skill = await Skill.findByPk(ctx.params.id, { transaction });
      if (!skill) {
        await transaction.rollback();
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Skill 不存在', data: null };
        return;
      }

      if (slug !== undefined) {
        const trimmedSlug = String(slug).trim();
        if (!isValidSlug(trimmedSlug)) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 格式无效', data: null };
          return;
        }
        const existing = await Skill.findOne({ where: { slug: trimmedSlug }, transaction });
        if (existing && existing.id !== skill.id) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
        skill.slug = trimmedSlug;
      }

      if (name !== undefined) skill.name = name;
      if (description !== undefined) skill.description = description;
      if (contentMarkdown !== undefined) skill.content_markdown = contentMarkdown;
      if (isActive !== undefined) skill.is_active = isActive;
      if (scopeId !== undefined) skill.scope_id = scopeId || null;

      await skill.save({ transaction });

      if (Array.isArray(toolIds)) {
        await SkillTool.destroy({ where: { skill_id: skill.id }, transaction });
        if (toolIds.length > 0) {
          const tools = await Tool.findAll({ where: { id: toolIds }, transaction });
          await Promise.all(tools.map((tool, index) => SkillTool.create({
            id: uuidv4(),
            skill_id: skill.id,
            tool_id: tool.id,
            sort_order: index
          }, { transaction })));
        }
      }

      await transaction.commit();

      const updated = await Skill.findByPk(skill.id, {
        include: [{ model: Tool, as: 'tools', through: { attributes: ['sort_order'] } }]
      });

      ctx.body = { code: 200, message: '更新 Skill 成功', data: formatSkill(updated) };
    } catch (error) {
      await transaction.rollback();
      logger.error('更新 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '更新 Skill 失败', data: null };
    }
  }

  static async remove(ctx) {
    try {
      const skill = await Skill.findByPk(ctx.params.id);
      if (!skill) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Skill 不存在', data: null };
        return;
      }
      skill.is_active = false;
      await skill.save();
      ctx.body = { code: 200, message: '删除 Skill 成功', data: null };
    } catch (error) {
      logger.error('删除 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '删除 Skill 失败', data: null };
    }
  }

  static async getPublicBySlug(ctx) {
    try {
      const skill = await Skill.findOne({
        where: { slug: ctx.params.slug, is_active: true },
        include: [
          {
            model: Tool,
            as: 'tools',
            through: { attributes: ['sort_order'] },
            required: false
          },
          {
            model: Scope,
            as: 'scope',
            attributes: ['id', 'name', 'slug'],
            required: false
          }
        ]
      });

      if (!skill) {
        ctx.status = 404;
        ctx.body = {
          error: { code: 'SKILL_NOT_FOUND', message: 'Skill 不存在', traceId: ctx.state.traceId }
        };
        return;
      }

      const formatted = formatSkill(skill);
      formatted.tools = (formatted.tools || []).filter((t) => t.isActive !== false);
      formatted.openaiTools = formatted.tools.map(formatOpenAITool);
      ctx.body = { data: formatted };
    } catch (error) {
      logger.error('获取 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = {
        error: { code: 'INTERNAL_ERROR', message: '获取 Skill 失败', traceId: ctx.state.traceId }
      };
    }
  }
}

module.exports = SkillController;
