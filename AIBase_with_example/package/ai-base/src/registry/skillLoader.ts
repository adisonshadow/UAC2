import type { AIBaseClient } from '../sdk/client';
import type { AIBaseSkill, ResolvedAIChatConfig } from '../types';
import {
  buildSkillCacheKey,
  getCachedSkillContext,
  setCachedSkillContext,
} from './skillCache';

async function loadSkill(client: AIBaseClient, slug: string): Promise<AIBaseSkill | null> {
  try {
    return await client.loadSkill(slug);
  } catch {
    return null;
  }
}

/**
 * 批量加载 Skill：优先走批量接口（单请求），失败时降级为逐个请求。
 */
async function loadSkillsBySlugs(
  client: AIBaseClient,
  slugs: string[],
): Promise<AIBaseSkill[]> {
  if (!slugs.length) return [];

  try {
    const skills = await client.loadSkills(slugs);
    if (Array.isArray(skills) && skills.length) {
      return skills;
    }
    // 批量接口返回空（可能全部不存在），逐个兜底以区分「不存在」与「批量接口异常」
  } catch {
    // 批量接口异常时降级为逐个请求，保证加载鲁棒性
  }

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
 *
 * 带内存缓存（按 apiBase + applicationId + scopeSlug + fallbackSlugs 维度，TTL 5 分钟），
 * 避免每次进页面/切路由全量重拉；远端 Skill 用批量接口一次性加载（解决 N+1）。
 */
export async function loadChatSkillContext(
  client: AIBaseClient,
  config: ResolvedAIChatConfig,
  scopeSlug?: string,
): Promise<ChatSkillContext> {
  const cacheKey = buildSkillCacheKey({
    apiBase: config.apiBase,
    applicationId: config.applicationId,
    scopeSlug: scopeSlug || config.scopeSlug,
    fallbackSlugs: config.fallbackSkillSlugs,
  });
  const cached = getCachedSkillContext(cacheKey);
  if (cached) return cached;

  const localTopLevel = config.topLevelSkillMarkdown.trim();
  const localSkills = await loadSkillsBySlugs(client, config.fallbackSkillSlugs);

  if (!config.applicationId) {
    const ctx: ChatSkillContext = {
      skills: localSkills,
      topLevelSkillMarkdown: localTopLevel,
    };
    setCachedSkillContext(cacheKey, ctx);
    return ctx;
  }

  try {
    const caps = await client.getCapabilities({
      scopeSlug: scopeSlug || config.scopeSlug,
      applicationId: config.applicationId,
    });
    const topLevelSkillMarkdown =
      localTopLevel || extractTopLevelFromCapabilities(caps as Record<string, unknown>);

    const skillMetas = ((caps as Record<string, unknown>)?.skills as Array<{ slug: string }>) || [];
    // 批量加载远端 Skill（单请求替代 N 次），失败时降级为逐个请求
    const remoteSkillSlugs = skillMetas.map((item) => item.slug);
    const remoteSkills = skillMetas.length
      ? await loadSkillsBySlugs(client, remoteSkillSlugs)
      : [];

    const ctx: ChatSkillContext = {
      skills: mergeSkillsBySlug(remoteSkills, localSkills),
      topLevelSkillMarkdown,
    };
    setCachedSkillContext(cacheKey, ctx);
    return ctx;
  } catch {
    const ctx: ChatSkillContext = {
      skills: localSkills,
      topLevelSkillMarkdown: localTopLevel,
    };
    return ctx;
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
