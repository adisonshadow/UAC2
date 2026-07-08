const { Scope, Tool, Skill, Application } = require('../models');
const SkillController = require('./skillController');
const { invokeTool, formatOpenAITool } = require('../services/ai/toolInvokeService');
const { CAPABILITIES } = require('../constants/aiCapabilities');
const logger = require('../utils/logger');

class AiCapabilityController {
  static async getCapabilities(ctx) {
    try {
      const scopeSlug = ctx.query.scopeSlug || ctx.query.scope;
      const applicationId = ctx.query.applicationId || ctx.query.application_id;

      const [scopes, skills, tools] = await Promise.all([
        Scope.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }),
        Skill.findAll({
          where: { is_active: true },
          include: [
            { model: Scope, as: 'scope', attributes: ['id', 'name', 'slug'], required: false },
            {
              model: Application,
              as: 'applications',
              attributes: ['application_id', 'name', 'code'],
              through: { attributes: [] },
              required: false,
            },
          ],
          order: [['name', 'ASC']],
        }),
        Tool.findAll({
          where: { is_active: true },
          include: [{ model: Scope, as: 'scope', attributes: ['id', 'name', 'slug'] }],
          order: [['name', 'ASC']],
        }),
      ]);

      const visibleSkills = SkillController.filterSkillsForContext(skills, {
        scopeSlug,
        applicationId,
      });

      let topLevelSkill = null;
      if (applicationId) {
        const application = await Application.findByPk(applicationId, {
          attributes: ['application_id', 'name', 'top_level_skill_markdown'],
        });
        const contentMarkdown = application?.top_level_skill_markdown?.trim();
        if (contentMarkdown) {
          topLevelSkill = {
            name: `${application.name} 顶层 Skill`,
            contentMarkdown,
          };
        }
      }

      ctx.body = {
        data: {
          modelCapabilities: CAPABILITIES,
          scopes: scopes.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            description: item.description,
          })),
          skills: visibleSkills.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            description: item.description,
            scopeId: item.scope_id,
            scopeSlug: item.scope?.slug || null,
            isGlobal: item.is_global === true,
            isDedicated: item.is_dedicated === true,
            applicationIds: (item.applications || []).map((app) => app.application_id),
          })),
          tools: tools.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            functionName: item.function_name,
            executionType: item.execution_type,
            scopeSlug: item.scope?.slug,
          })),
          topLevelSkill,
        },
      };
    } catch (error) {
      logger.error('获取 capabilities 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = {
        error: { code: 'INTERNAL_ERROR', message: '获取 capabilities 失败', traceId: ctx.state.traceId },
      };
    }
  }

  static async getScopeTools(ctx) {
    try {
      const scope = await Scope.findOne({
        where: { slug: ctx.params.slug, is_active: true },
      });

      if (!scope) {
        ctx.status = 404;
        ctx.body = {
          error: { code: 'SCOPE_NOT_FOUND', message: 'Scope 不存在', traceId: ctx.state.traceId },
        };
        return;
      }

      const tools = await Tool.findAll({
        where: { scope_id: scope.id, is_active: true },
        order: [['name', 'ASC']],
      });

      ctx.body = {
        data: {
          scope: { id: scope.id, name: scope.name, slug: scope.slug },
          tools: tools.map((tool) => ({
            id: tool.id,
            name: tool.name,
            slug: tool.slug,
            functionName: tool.function_name,
            description: tool.description,
            executionType: tool.execution_type,
            parametersSchema: tool.parameters_schema || {},
            reviewMarkdown: tool.review_markdown,
            openaiTool: formatOpenAITool(tool),
          })),
        },
      };
    } catch (error) {
      logger.error('获取 Scope Tools 失败', { error: error.message });
      ctx.status = 500;
      ctx.body = {
        error: { code: 'INTERNAL_ERROR', message: '获取 Scope Tools 失败', traceId: ctx.state.traceId },
      };
    }
  }

  static async invokeTool(ctx) {
    const { functionName, arguments: toolArgs } = ctx.request.body;

    if (!functionName) {
      ctx.status = 400;
      ctx.body = {
        error: { code: 'INVALID_REQUEST', message: 'functionName 为必填项', traceId: ctx.state.traceId },
      };
      return;
    }

    try {
      const tool = await Tool.findOne({
        where: { function_name: functionName, is_active: true },
      });

      if (!tool) {
        ctx.status = 404;
        ctx.body = {
          error: { code: 'TOOL_NOT_FOUND', message: 'Tool 不存在', traceId: ctx.state.traceId },
        };
        return;
      }

      if (tool.execution_type === 'client') {
        ctx.status = 400;
        ctx.body = {
          error: {
            code: 'CLIENT_TOOL',
            message: 'Client tool 需在前端 functionRegistry 执行',
            traceId: ctx.state.traceId,
          },
        };
        return;
      }

      const result = await invokeTool(tool, toolArgs || {});
      ctx.body = { data: result };
    } catch (error) {
      logger.error('Tool 调用失败', { error: error.message, functionName });
      ctx.status = 500;
      ctx.body = {
        error: { code: 'TOOL_INVOKE_FAILED', message: error.message, traceId: ctx.state.traceId },
      };
    }
  }
}

module.exports = AiCapabilityController;
