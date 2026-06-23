import type { AIBaseClient } from '../sdk/client';
import type { AIBaseSkill, AIBaseTool, OpenAIToolDefinition, ResolvedAIChatConfig } from '../types';
import { toOpenAIToolFromMeta } from './toolManifest';

async function loadSkill(client: AIBaseClient, slug: string): Promise<AIBaseSkill> {
  return client.loadSkill(slug);
}

async function loadSkillsBySlugs(
  client: AIBaseClient,
  slugs: string[],
): Promise<AIBaseSkill[]> {
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await loadSkill(client, slug);
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean) as AIBaseSkill[];
}

async function loadScopeToolsAsFallback(
  client: AIBaseClient,
  scopeSlug: string,
): Promise<AIBaseSkill[]> {
  try {
    const { scope, tools } = await client.getScopeTools(scopeSlug);
    if (!tools?.length) return [];

    const openaiTools = tools.map((tool) => tool.openaiTool || toOpenAIToolFromMeta(tool));
    const toolNames = tools.map((t) => t.functionName).join('、');

    return [{
      id: scope.id,
      name: scope.name,
      slug: scope.slug,
      description: scope.description,
      scopeSlug: scope.slug,
      contentMarkdown: [
        `# ${scope.name}`,
        '',
        '你可以调用以下 Tool 查询真实业务数据（SQLite），禁止声称无法访问数据库：',
        '',
        toolNames,
        '',
        '用户询问订单趋势时，优先调用 `sales_order_stats_by_period`，参数 days=30。',
        '用户询问订单状态统计时，调用 `sales_order_stats_by_status`。',
      ].join('\n'),
      tools: tools as AIBaseTool[],
      openaiTools: openaiTools as OpenAIToolDefinition[],
    }];
  } catch {
    return [];
  }
}

export async function loadAllSkills(
  client: AIBaseClient,
  config: ResolvedAIChatConfig,
  scopeSlug?: string,
): Promise<AIBaseSkill[]> {
  const targetScope = scopeSlug || config.scopeSlug;
  const fallbackSkillSlugs = config.fallbackSkillSlugs;

  try {
    const caps = await client.getCapabilities();
    const skillMetas = (caps?.skills as Array<{ slug: string; scopeSlug?: string | null }>) || [];

    if (skillMetas.length) {
      const filtered = targetScope
        ? skillMetas.filter((item) => item.scopeSlug === targetScope)
        : skillMetas;

      if (filtered.length) {
        const skills = await Promise.all(filtered.map((item) => loadSkill(client, item.slug)));
        return skills.filter(Boolean);
      }
    }
  } catch {
    // capabilities 失败（如 DB 未迁移 scope_id）时走 fallback
  }

  const bySlug = await loadSkillsBySlugs(client, fallbackSkillSlugs);
  if (bySlug.length) return bySlug;

  if (targetScope) {
    return loadScopeToolsAsFallback(client, String(targetScope));
  }

  return [];
}

export function buildCombinedSystemPrompt(
  skills: AIBaseSkill[],
  config: ResolvedAIChatConfig,
): string {
  if (!skills.length) return '';

  const sections = skills.map(
    (skill) => `### ${skill.name} (${skill.slug})\n${skill.contentMarkdown || skill.description || ''}`,
  );

  return [
    config.systemPromptPrefix,
    '',
    '## 可用 Skill',
    ...sections,
  ].join('\n');
}
