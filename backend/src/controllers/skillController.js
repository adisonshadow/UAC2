const { v4: uuidv4 } = require('uuid');
const { Skill, Tool, SkillTool, Scope, Application, SkillApplication } = require('../models');
const { isValidSlug, resolveUniqueSlug } = require('../constants/aiCapabilities');
const { formatOpenAITool } = require('../services/ai/toolInvokeService');
const logger = require('../utils/logger');

const skillInclude = [
  {
    model: Tool,
    as: 'tools',
    through: { attributes: ['sort_order'] },
    required: false,
  },
  {
    model: Scope,
    as: 'scope',
    attributes: ['id', 'name', 'slug'],
    required: false,
  },
  {
    model: Application,
    as: 'applications',
    attributes: ['application_id', 'name', 'code'],
    through: { attributes: [] },
    required: false,
  },
];

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
    isActive: data.is_active,
  };
}

function formatSkill(skill, includeTools = true) {
  const data = skill.toJSON ? skill.toJSON() : skill;
  const applications = data.applications || [];
  const result = {
    id: data.id,
    scopeId: data.scope_id || data.scopeId || null,
    scopeSlug: data.scope?.slug || null,
    name: data.name,
    slug: data.slug,
    description: data.description,
    contentMarkdown: data.content_markdown,
    isActive: data.is_active,
    isGlobal: data.is_global === true,
    isDedicated: data.is_dedicated === true,
    completionStrategy: data.completion_strategy || undefined,
    applicationIds: applications.map((item) => item.application_id),
    applications: applications.map((item) => ({
      applicationId: item.application_id,
      name: item.name,
      code: item.code,
    })),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  if (includeTools && data.tools) {
    result.tools = data.tools
      .sort((a, b) => (a.SkillTool?.sort_order || 0) - (b.SkillTool?.sort_order || 0))
      .map(formatToolBrief);
    result.toolIds = result.tools.map((item) => item.id);
  }

  return result;
}

async function syncSkillApplications(skillId, applicationIds, transaction) {
  await SkillApplication.destroy({
    where: { skill_id: skillId },
    transaction,
  });

  if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
    return;
  }

  const apps = await Application.findAll({
    where: { application_id: applicationIds },
    transaction,
  });

  await Promise.all(
    apps.map((app) =>
      SkillApplication.create(
        {
          id: uuidv4(),
          skill_id: skillId,
          application_id: app.application_id,
        },
        { transaction },
      ),
    ),
  );
}

function validateSkillVisibility(isGlobal, isDedicated, applicationIds) {
  if (isGlobal && isDedicated) {
    return '全局 Skill 与专用 Skill 不能同时启用';
  }
  if (isDedicated && (!Array.isArray(applicationIds) || applicationIds.length === 0)) {
    return '专用 Skill 需至少选择一个应用系统';
  }
  return null;
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

      const count = await Skill.count({ where });
      const rows = await Skill.findAll({
        where,
        include: skillInclude,
        limit: size,
        offset: (page - 1) * size,
        order: [['created_at', 'DESC']],
      });

      ctx.body = {
        code: 200,
        message: '获取 Skill 列表成功',
        data: { total: count, items: rows.map((row) => formatSkill(row)), page, size },
      };
    } catch (error) {
      logger.error('获取 Skill 列表失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取 Skill 列表失败', data: null };
    }
  }

  static async create(ctx) {
    const {
      name,
      slug,
      description,
      contentMarkdown,
      toolIds = [],
      scopeId,
      isGlobal = false,
      isDedicated = false,
      applicationIds = [],
      completionStrategy,
    } = ctx.request.body;

    if (!name) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'name 为必填项', data: null };
      return;
    }

    const trimmedSlug = typeof slug === 'string' ? slug.trim() : '';
    if (!trimmedSlug) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'Skill ID 为必填项', data: null };
      return;
    }
    if (!isValidSlug(trimmedSlug)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'Skill ID 格式无效', data: null };
      return;
    }

    const visibilityError = validateSkillVisibility(isGlobal, isDedicated, applicationIds);
    if (visibilityError) {
      ctx.status = 400;
      ctx.body = { code: 400, message: visibilityError, data: null };
      return;
    }

    const transaction = await Skill.sequelize.transaction();
    try {
      const existing = await Skill.findOne({ where: { slug: trimmedSlug }, transaction });
      if (existing) {
        await transaction.rollback();
        ctx.status = 400;
        ctx.body = { code: 400, message: 'Skill ID 已存在', data: null };
        return;
      }

      const skill = await Skill.create(
        {
          id: uuidv4(),
          name,
          slug: trimmedSlug,
          description: description || null,
          content_markdown: contentMarkdown || '',
          scope_id: scopeId || null,
          is_global: Boolean(isGlobal),
          is_dedicated: Boolean(isDedicated),
          completion_strategy: completionStrategy || null,
          is_active: true,
        },
        { transaction },
      );

      if (Array.isArray(toolIds) && toolIds.length > 0) {
        const tools = await Tool.findAll({ where: { id: toolIds }, transaction });
        await Promise.all(
          tools.map((tool, index) =>
            SkillTool.create(
              {
                id: uuidv4(),
                skill_id: skill.id,
                tool_id: tool.id,
                sort_order: index,
              },
              { transaction },
            ),
          ),
        );
      }

      if (isDedicated) {
        await syncSkillApplications(skill.id, applicationIds, transaction);
      }

      await transaction.commit();

      const created = await Skill.findByPk(skill.id, { include: skillInclude });
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
      const skill = await Skill.findByPk(ctx.params.id, { include: skillInclude });
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
    const {
      name,
      slug,
      description,
      contentMarkdown,
      toolIds,
      isActive,
      scopeId,
      isGlobal,
      isDedicated,
      applicationIds,
      completionStrategy,
    } = ctx.request.body;
    const transaction = await Skill.sequelize.transaction();

    try {
      const skill = await Skill.findByPk(ctx.params.id, { transaction });
      if (!skill) {
        await transaction.rollback();
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Skill 不存在', data: null };
        return;
      }

      const nextIsGlobal = isGlobal !== undefined ? Boolean(isGlobal) : skill.is_global;
      const nextIsDedicated = isDedicated !== undefined ? Boolean(isDedicated) : skill.is_dedicated;
      const nextApplicationIds =
        applicationIds !== undefined
          ? applicationIds
          : nextIsDedicated
            ? (await skill.getApplications({ transaction })).map((item) => item.application_id)
            : [];

      const visibilityError = validateSkillVisibility(nextIsGlobal, nextIsDedicated, nextApplicationIds);
      if (visibilityError) {
        await transaction.rollback();
        ctx.status = 400;
        ctx.body = { code: 400, message: visibilityError, data: null };
        return;
      }

      if (slug !== undefined) {
        const trimmedSlug = String(slug).trim();
        if (!trimmedSlug) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'Skill ID 为必填项', data: null };
          return;
        }
        if (!isValidSlug(trimmedSlug)) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'Skill ID 格式无效', data: null };
          return;
        }
        const existing = await Skill.findOne({ where: { slug: trimmedSlug }, transaction });
        if (existing && existing.id !== skill.id) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'Skill ID 已存在', data: null };
          return;
        }
        skill.slug = trimmedSlug;
      }

      if (name !== undefined) skill.name = name;
      if (description !== undefined) skill.description = description;
      if (contentMarkdown !== undefined) skill.content_markdown = contentMarkdown;
      if (isActive !== undefined) skill.is_active = isActive;
      if (scopeId !== undefined) skill.scope_id = scopeId || null;
      if (isGlobal !== undefined) skill.is_global = Boolean(isGlobal);
      if (isDedicated !== undefined) skill.is_dedicated = Boolean(isDedicated);
      if (completionStrategy !== undefined) skill.completion_strategy = completionStrategy || null;

      await skill.save({ transaction });

      if (Array.isArray(toolIds)) {
        await SkillTool.destroy({ where: { skill_id: skill.id }, transaction });
        if (toolIds.length > 0) {
          const tools = await Tool.findAll({ where: { id: toolIds }, transaction });
          await Promise.all(
            tools.map((tool, index) =>
              SkillTool.create(
                {
                  id: uuidv4(),
                  skill_id: skill.id,
                  tool_id: tool.id,
                  sort_order: index,
                },
                { transaction },
              ),
            ),
          );
        }
      }

      if (isDedicated !== undefined || applicationIds !== undefined) {
        if (skill.is_dedicated) {
          await syncSkillApplications(skill.id, applicationIds || [], transaction);
        } else {
          await syncSkillApplications(skill.id, [], transaction);
        }
      }

      await transaction.commit();

      const updated = await Skill.findByPk(skill.id, { include: skillInclude });
      ctx.body = { code: 200, message: '更新 Skill 成功', data: formatSkill(updated) };
    } catch (error) {
      await transaction.rollback();
      logger.error('更新 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '更新 Skill 失败', data: null };
    }
  }

  static async remove(ctx) {
    const transaction = await Skill.sequelize.transaction();
    try {
      const skill = await Skill.findByPk(ctx.params.id, { transaction });
      if (!skill) {
        await transaction.rollback();
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Skill 不存在', data: null };
        return;
      }
      await skill.destroy({ transaction });
      await transaction.commit();
      ctx.body = { code: 200, message: '删除 Skill 成功', data: null };
    } catch (error) {
      await transaction.rollback();
      logger.error('删除 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '删除 Skill 失败', data: null };
    }
  }

  static async getPublicBySlug(ctx) {
    try {
      const skill = await Skill.findOne({
        where: { slug: ctx.params.slug, is_active: true },
        include: skillInclude,
      });

      if (!skill) {
        ctx.status = 404;
        ctx.body = {
          error: { code: 'SKILL_NOT_FOUND', message: 'Skill 不存在', traceId: ctx.state.traceId },
        };
        return;
      }

      const formatted = formatSkill(skill);
      formatted.tools = (formatted.tools || []).filter((t) => t.isActive !== false);
      formatted.openaiTools = formatted.tools.map(formatOpenAITool);

      // ETag / 条件请求：基于 updated_at + slug，命中 If-None-Match 直接返回 304
      const etag = `W/"${skill.updated_at ? new Date(skill.updated_at).getTime() : 'na'}-${skill.slug}"`;
      ctx.set('ETag', etag);
      ctx.set('Cache-Control', 'private, no-cache');
      if (ctx.get('If-None-Match') === etag) {
        ctx.status = 304;
        ctx.body = null;
        return;
      }

      ctx.body = { data: formatted };
    } catch (error) {
      logger.error('获取 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = {
        error: { code: 'INTERNAL_ERROR', message: '获取 Skill 失败', traceId: ctx.state.traceId },
      };
    }
  }

  /**
   * 批量获取 Skill 详情（含 Tool 列表）：一次请求替代 N 次 GET /skills/:slug。
   * 入参 ctx.query.slugs（逗号分隔，单次最多 50 个）。
   * 解决 skill 加载 N+1 请求问题（docs/improvements/p2-skill-tool-caching.md）。
   */
  static async getPublicBySlugs(ctx) {
    try {
      const rawSlugs = ctx.query.slugs || '';
      const slugs = String(rawSlugs)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);

      if (!slugs.length) {
        ctx.body = { data: [] };
        return;
      }

      const skills = await Skill.findAll({
        where: { slug: slugs, is_active: true },
        include: skillInclude,
      });

      const formatted = skills.map((skill) => {
        const f = formatSkill(skill);
        f.tools = (f.tools || []).filter((t) => t.isActive !== false);
        f.openaiTools = (f.tools || []).map(formatOpenAITool);
        return f;
      });

      // 批量 ETag：取各 skill updated_at 最大值聚合
      const maxUpdated = skills.reduce((max, skill) => {
        const ts = skill.updated_at ? new Date(skill.updated_at).getTime() : 0;
        return Math.max(max, ts);
      }, 0);
      const etag = `W/"${maxUpdated || 'na'}-${slugs.length}"`;
      ctx.set('ETag', etag);
      ctx.set('Cache-Control', 'private, no-cache');
      if (ctx.get('If-None-Match') === etag) {
        ctx.status = 304;
        ctx.body = null;
        return;
      }

      ctx.body = { data: formatted };
    } catch (error) {
      logger.error('批量获取 Skill 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = {
        error: { code: 'INTERNAL_ERROR', message: '批量获取 Skill 失败', traceId: ctx.state.traceId },
      };
    }
  }
}

/** 供 capabilities 接口按应用系统过滤 Skill（需配置 applicationId 才返回远端 Skill） */
SkillController.filterSkillsForContext = function filterSkillsForContext(skills, { applicationId } = {}) {
  if (!applicationId) {
    return [];
  }

  return skills.filter((skill) => {
    const data = skill.toJSON ? skill.toJSON() : skill;

    if (data.is_global) {
      return true;
    }

    if (data.is_dedicated) {
      const appIds = (data.applications || []).map((item) => item.application_id);
      return appIds.includes(applicationId);
    }

    return false;
  });
};

module.exports = SkillController;
