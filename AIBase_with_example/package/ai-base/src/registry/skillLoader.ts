import type { AIBaseClient } from '../sdk/client';
import type { AIBaseSkill, ResolvedAIChatConfig } from '../types';
import {
  buildSkillCacheKey,
  getCachedSkillContext,
  setCachedSkillContext,
} from './skillCache';

/**
 * 结构化终止协议：开启 enableStructuredTermination 时注入系统提示词最前面。
 *
 * 核心是「信号反转」——禁止用自由文本声称完成，必须走 update_plan（维护任务清单）
 * + task_complete（显式终止 + 验收）两个 harness Tool。对标成熟闭环流程的六阶段状态机。
 */
const STRUCTURED_TERMINATION_PROTOCOL =
  '## Agent 执行协议（硬约束，优先级高于其他 Skill 指令）\n' +
  '你在一个「思考→执行→验收」的循环中工作。必须使用内置 Tool 来管理任务、向用户确认选择与终止：\n\n' +
  '### update_plan —— 任务清单\n' +
  '- 任务开始时：调用 update_plan，把任务拆解为 3-7 个里程碑步骤，全部初始化为 pending，再把第一个设为 in_progress；纯查询/列表/详情类只读任务可退化为 1 个步骤\n' +
  '- 每完成一步、或发现需要新增/调整步骤时：调用 update_plan（merge=true）增量更新状态\n' +
  '- 硬约束：同一时间**有且仅有一个**任务处于 in_progress，禁止并行推进多个步骤\n' +
  '- 标记 completed 前，必须确认该步对应的 Tool 已返回 verified=true\n\n' +
  '### ask_user —— 向用户询问并确认选择（mid-task HITL）\n' +
  '- 方案取舍、危险写操作前、多路径决策时，**必须**调用 ask_user 展示结构化选择题并暂停\n' +
  '- mode=single（单选，默认允许「其他」自定义）或 multi（多选）；options 通常 2–5 项（推荐 3）\n' +
  '- **禁止**仅用「请确认后回复」「是否继续」等口头话术代替 ask_user（口头等待仅作兜底）\n' +
  '- 调用后循环会挂起；用户在卡片中提交后，系统会注入【用户选择】消息并续跑——据此继续执行\n' +
  '- 与 a2ui-commands「下一步建议」不同：ask_user 是任务中途决策门；下一步建议仅用于阶段完成后的可选动作\n\n' +
  '### task_complete —— 显式终止\n' +
  '- 当且仅当 plan 全部 completed、关键 Tool 全部 verified=true、成功标准全部满足时，调用 task_complete 终止\n' +
  '- **禁止**用自由文本声称「完成」「已处理」「搞定」等——必须调用 task_complete，否则循环不会停止\n' +
  '- 若当前 Skill 明确允许查询型直接收尾，则在只读结果已返回且已回答用户问题时，可直接交付结束，不必为了凑闭环继续自动执行\n' +
  '- task_complete 会校验：未通过时返回未完成项，你必须继续推进后重试，不能无视\n' +
  '- summary 字段写给用户看（做了什么、验证结果、注意事项）；next_steps 渲染为可点击按钮\n\n' +
  '### 每轮工作模式\n' +
  '1. 对账：回顾当前 plan，确认进度，选定要推进的 in_progress 项\n' +
  '2. 执行：对该项做 Read（读现状）→ Modify（改）→ Verify（验证）；需要用户决策时先 ask_user\n' +
  '3. 更新：update_plan 标记完成、推进下一项\n' +
  '4. 终止：全部完成后调用 task_complete\n\n' +
  '### 禁止事项\n' +
  '- 禁止跳过 update_plan 直接堆 Tool 调用\n' +
  '- 禁止用「接下来您可以…」之类的自由文本收尾来代替 task_complete\n' +
  '- 禁止在 task_complete 返回 TASK_INCOMPLETE 后仍向用户声称完成\n' +
  '- 禁止用口头「请确认」代替 ask_user 做方案取舍或危险操作确认';

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
 * - 配置了 applicationId：远端（全局 Skill + fallbackSkillSlugs 页面 Skill）+ 本地 fallbackSkillSlugs
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

    const skillMetas =
      ((caps as Record<string, unknown>)?.skills as Array<{ slug: string; isGlobal?: boolean }>) || [];
    const fallbackSet = new Set(config.fallbackSkillSlugs ?? []);
    // 页面配置了 fallbackSkillSlugs 时，只加载全局框架 Skill + 当前页 Skill，避免全部专用 Skill 稀释指引与 Tool 池
    const remoteSkillSlugs = skillMetas
      .filter((item) => {
        if (!fallbackSet.size) return true;
        return item.isGlobal === true || fallbackSet.has(item.slug);
      })
      .map((item) => item.slug);
    // 批量加载远端 Skill（单请求替代 N 次），失败时降级为逐个请求
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

  if (!topLevel && !sections.length && !config.enableStructuredTermination) return '';

  const parts: string[] = [];
  // 结构化终止开启时，在最前面注入固定 Agent 执行协议（不受 systemPromptPrefix / Skill 影响）。
  // 这套规则对标 docs/AIBase 成熟闭环与 Planning next moves 统一方案.md：思考→执行→验收的六阶段状态机。
  if (config.enableStructuredTermination) {
    parts.push(STRUCTURED_TERMINATION_PROTOCOL);
  }
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
