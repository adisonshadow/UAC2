import type { AIBaseClient } from '../sdk/client';
import type { AIBaseSkill, ResolvedAIChatConfig } from '../types';

async function loadSkill(client: AIBaseClient, slug: string): Promise<AIBaseSkill | null> {
  try {
    return await client.loadSkill(slug);
  } catch {
    return null;
  }
}

async function loadSkillsBySlugs(
  client: AIBaseClient,
  slugs: string[],
): Promise<AIBaseSkill[]> {
  if (!slugs.length) return [];

  const results = await Promise.all(slugs.map((slug) => loadSkill(client, slug)));
  return results.filter(Boolean) as AIBaseSkill[];
}

function extractTopLevelFromCapabilities(caps: Record<string, unknown> | null | undefined): string {
  const topLevel = caps?.topLevelSkill as { contentMarkdown?: string } | null | undefined;
  return topLevel?.contentMarkdown?.trim() || '';
}

/** 按 slug 合并；后出现的同 slug Skill 覆盖先前的（本地配置优先于远端） */
function mergeSkillsBySlug(...groups: AIBaseSkill[][]): AIBaseSkill[] {
  const map = new Map<string, AIBaseSkill>();
  for (const group of groups) {
    for (const skill of group) {
      map.set(skill.slug, skill);
    }
  }
  return Array.from(map.values());
}

export interface ChatSkillContext {
  skills: AIBaseSkill[];
  topLevelSkillMarkdown: string;
}

/**
 * 加载可用 Skill 与顶层 Skill 说明：
 * - 配置了 applicationId：远端（全局 + 绑定该应用的专用）+ 本地 fallbackSkillSlugs
 * - 未配置 applicationId：仅本地 fallbackSkillSlugs
 * - topLevelSkillMarkdown：config 非空优先，否则从 capabilities 读取
 */
export async function loadChatSkillContext(
  client: AIBaseClient,
  config: ResolvedAIChatConfig,
  scopeSlug?: string,
): Promise<ChatSkillContext> {
  const localTopLevel = config.topLevelSkillMarkdown.trim();
  const localSkills = await loadSkillsBySlugs(client, config.fallbackSkillSlugs);

  if (!config.applicationId) {
    return {
      skills: localSkills,
      topLevelSkillMarkdown: localTopLevel,
    };
  }

  try {
    const caps = await client.getCapabilities({
      scopeSlug: scopeSlug || config.scopeSlug,
      applicationId: config.applicationId,
    });
    const topLevelSkillMarkdown =
      localTopLevel || extractTopLevelFromCapabilities(caps as Record<string, unknown>);

    const skillMetas = ((caps as Record<string, unknown>)?.skills as Array<{ slug: string }>) || [];
    const remoteSkills = skillMetas.length
      ? ((await Promise.all(skillMetas.map((item) => loadSkill(client, item.slug)))).filter(
          Boolean,
        ) as AIBaseSkill[])
      : [];

    return {
      skills: mergeSkillsBySlug(remoteSkills, localSkills),
      topLevelSkillMarkdown,
    };
  } catch {
    return {
      skills: localSkills,
      topLevelSkillMarkdown: localTopLevel,
    };
  }
}

/** @deprecated 使用 loadChatSkillContext */
export async function loadAllSkills(
  client: AIBaseClient,
  config: ResolvedAIChatConfig,
  scopeSlug?: string,
): Promise<AIBaseSkill[]> {
  const ctx = await loadChatSkillContext(client, config, scopeSlug);
  return ctx.skills;
}

export function buildCombinedSystemPrompt(
  skills: AIBaseSkill[],
  config: ResolvedAIChatConfig,
  topLevelMarkdown = '',
): string {
  const topLevel = topLevelMarkdown.trim();
  const sections = skills.map(
    (skill) => `### ${skill.name} (${skill.slug})\n${skill.contentMarkdown || skill.description || ''}`,
  );

  if (!topLevel && !sections.length) return '';

  const parts: string[] = [];
  if (config.systemPromptPrefix) {
    parts.push(config.systemPromptPrefix);
  }
  if (topLevel) {
    if (parts.length) parts.push('');
    parts.push('## 应用顶层 Skill');
    parts.push(topLevel);
  }
  if (sections.length) {
    if (parts.length) parts.push('');
    parts.push('## 可用 Skill');
    parts.push(...sections);
  }
  return parts.join('\n');
}
