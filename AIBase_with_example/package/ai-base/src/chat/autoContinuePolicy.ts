import type { AIBaseSkill } from '../types';
import type { ToolResponse } from '../types/toolResponse';
import { extractA2uiCommandsPayload } from '../a2ui/parseA2uiCommands';
import { getSkillCompletionStrategy } from '../registry/skillPolicyRegistry';

/**
 * 声明式 auto-continue 策略：取代历史版本里硬编码的 bizdata/apiservice 等业务判定。
 *
 * 判定依据全部来自各 Skill 的 SkillCompletionStrategy（后端声明或前端注册表覆盖）：
 * - requiredTools：本轮结束若仍有未调用的关键 Tool → 续调
 * - completionKeywords：文本命中 → 视为任务完成，停止续调（须通过 verification 检查）
 * - blockKeywords：文本命中（如收尾建议句）→ 停止续调
 * - continuousExecution：连续执行型 Skill（test-fix 循环等），对 narration 宽松续调
 *
 * SDK 本身不再包含任何业务工具名集合或中文正则。
 */

export interface AutoContinueContext {
  /** 已加载的 Skill 列表（含 completionStrategy） */
  skills: AIBaseSkill[];
  allowedToolNames: Set<string>;
  invokedToolNames: Set<string>;
  toolsExecuted: number;
  text: string;
  /** 本轮各 Tool 的标准化返回信封 */
  toolOutcomes?: ToolResponse[];
}

/** 合并所有 Skill 的完成策略（取并集；布尔字段任一为真即为真） */
function aggregateStrategies(skills: AIBaseSkill[]): {
  requiredTools: Set<string>;
  completionKeywords: string[];
  blockKeywords: string[];
  claimRules: Array<{ keywords: string[]; requiredTools: string[] }>;
  anyContinuous: boolean;
} {
  const requiredTools = new Set<string>();
  const completionKeywords: string[] = [];
  const blockKeywords: string[] = [];
  const claimRules: Array<{ keywords: string[]; requiredTools: string[] }> = [];
  let anyContinuous = false;

  for (const skill of skills) {
    const strategy = getSkillCompletionStrategy(skill);
    if (!strategy) continue;
    if (strategy.requiredTools) {
      for (const name of strategy.requiredTools) requiredTools.add(name);
    }
    if (strategy.completionKeywords) completionKeywords.push(...strategy.completionKeywords);
    if (strategy.blockKeywords) blockKeywords.push(...strategy.blockKeywords);
    if (strategy.claimRules) claimRules.push(...strategy.claimRules);
    if (strategy.continuousExecution) anyContinuous = true;
  }

  return { requiredTools, completionKeywords, blockKeywords, claimRules, anyContinuous };
}

function hasUnmetClaimRules(
  text: string,
  claimRules: Array<{ keywords: string[]; requiredTools: string[] }>,
  invokedToolNames: Set<string>,
): boolean {
  for (const rule of claimRules) {
    if (!matchesAnyKeyword(text, rule.keywords)) continue;
    if (rule.requiredTools.some((name) => !invokedToolNames.has(name))) return true;
  }
  return false;
}

/** 对已 published 服务重复 publish：业务上可接受，不应触发续调纠正 */
function isBenignPublishOutcome(item: ToolResponse): boolean {
  if (item.meta.tool !== 'apiservice_publish_service') return false;
  const data = item.data as Record<string, unknown> | undefined;
  if (data?.alreadyPublished === true) return true;
  const msg = item.error?.message ?? '';
  return /已是 published|alreadyPublished/i.test(msg);
}

function isFailedToolOutcome(item: ToolResponse): boolean {
  if (isBenignPublishOutcome(item)) return false;
  if (item.kind === 'system_error' || item.ok === false) return true;
  if (item.kind === 'business_error') return true;
  if (item.verified === false) return true;
  return false;
}

function hasFailedToolOutcomes(
  toolNames: string[],
  toolOutcomes: ToolResponse[] = [],
): boolean {
  if (!toolNames.length || !toolOutcomes.length) return false;
  const relevant = toolOutcomes.filter((item) => toolNames.includes(item.meta.tool));
  return relevant.some(isFailedToolOutcome);
}

/** 文本是否命中关键词集合（任一命中即 true，忽略大小写） */
function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => kw && lower.includes(kw.toLowerCase()));
}

/**
 * 进度叙述检测：模型把步骤用文字写出来（如"第一步…接下来…"），却没真正调用 Tool。
 * 这是语言层面的通用模式（非业务专属），仅在声明了策略的 Skill 上生效时才触发续调。
 */
const PROGRESS_NARRATION_RE =
  /第[一二三四五六七八九十\d]+步|现在进入第?|进入第[三四五]步|最后第?[四五]步|接下来(?!您|可|若|也|建议)/i;

/** 收尾建议句（如下一步建议），命中时禁止续调 —— 通用语言模式 */
const PROGRESS_CLOSING_RE =
  /接下来您(?:可以|若|也)?|建议(?:您|可)|可选(?:操作|步骤)?|如需(?:继续|物化|创建|配置)/i;

function hasIncompleteProgressNarration(text: string): boolean {
  if (PROGRESS_CLOSING_RE.test(text)) return false;
  return PROGRESS_NARRATION_RE.test(text);
}

function hasUnmetRequiredTools(requiredTools: Set<string>, invokedToolNames: Set<string>): boolean {
  return [...requiredTools].some((name) => !invokedToolNames.has(name));
}

function hasFailedVerification(
  requiredTools: Set<string>,
  toolOutcomes: ToolResponse[] = [],
): boolean {
  if (!toolOutcomes.length) return false;

  const requiredList = [...requiredTools];
  const relevant = requiredList.length
    ? toolOutcomes.filter((item) => requiredList.includes(item.meta.tool))
    : toolOutcomes;

  const targets = relevant.length ? relevant : toolOutcomes;

  return targets.some((item) => {
    if (isBenignPublishOutcome(item)) return false;
    if (item.kind === 'system_error' || item.ok === false) return true;
    if (item.kind === 'business_error') return true;
    if (item.verified === false) return true;
    if (item.verified === undefined && requiredList.includes(item.meta.tool)) {
      // 关键写操作 Tool 无 verified 字段，视为未通过
      return true;
    }
    return false;
  });
}

/**
 * 根据文本声称内容，确定须校验的关键 Tool（claimRules 优先于全局 requiredTools）。
 * 例如声称「全部 published」只须 publish_service，不应再强制 apiservice_run_test。
 */
function getApplicableRequiredTools(
  text: string,
  requiredTools: Set<string>,
  completionKeywords: string[],
  claimRules: Array<{ keywords: string[]; requiredTools: string[] }>,
): Set<string> {
  const applicable = new Set<string>();
  let ruleMatched = false;

  for (const rule of claimRules) {
    if (!matchesAnyKeyword(text, rule.keywords)) continue;
    ruleMatched = true;
    for (const name of rule.requiredTools) applicable.add(name);
  }

  if (ruleMatched) return applicable;
  if (matchesAnyKeyword(text, completionKeywords)) return new Set(requiredTools);
  return new Set();
}

/** 模型声称任务完成，但 Tool 证据不足或未 verified */
function hasPrematureSuccessClaim(
  text: string,
  ctx: AutoContinueContext,
  completionKeywords: string[],
  requiredTools: Set<string>,
  claimRules: Array<{ keywords: string[]; requiredTools: string[] }>,
): boolean {
  const publishClaim =
    matchesAnyKeyword(text, completionKeywords) || claimRules.some((rule) => matchesAnyKeyword(text, rule.keywords));

  if (!publishClaim) return false;

  if (ctx.toolsExecuted === 0) return true;

  const applicableTools = getApplicableRequiredTools(
    text,
    requiredTools,
    completionKeywords,
    claimRules,
  );

  if (applicableTools.size > 0) {
    if (hasUnmetRequiredTools(applicableTools, ctx.invokedToolNames)) return true;
    if (hasFailedVerification(applicableTools, ctx.toolOutcomes)) return true;
    for (const rule of claimRules) {
      if (!matchesAnyKeyword(text, rule.keywords)) continue;
      if (hasFailedToolOutcomes(rule.requiredTools, ctx.toolOutcomes)) return true;
    }
    return false;
  }

  if (hasUnmetClaimRules(text, claimRules, ctx.invokedToolNames)) return true;
  if (hasFailedVerification(new Set(), ctx.toolOutcomes)) return true;
  return false;
}

/**
 * 是否应在「本轮只输出文本、未调 Tool」时自动注入续调指令。
 * 全部依据已加载 Skill 的声明式策略判定。
 */
export function shouldAutoContinueAfterTextOnly(ctx: AutoContinueContext): boolean {
  const { text, toolsExecuted, invokedToolNames, skills } = ctx;
  if (!text.trim()) return false;

  const { requiredTools, completionKeywords, blockKeywords, claimRules, anyContinuous } =
    aggregateStrategies(skills);

  // A2UI 下一步建议已输出 → 任务已收尾，禁止续调（避免把建议按钮当成待执行步骤）
  if (extractA2uiCommandsPayload(text).hasSteps) return false;

  // 0. 声称成功但未 verified / 未调用关键 Tool → 强制续调纠正
  if (hasPrematureSuccessClaim(text, ctx, completionKeywords, requiredTools, claimRules)) {
    return true;
  }

  if (toolsExecuted === 0) return false;

  // 1. 文本命中完成关键词且 verification 通过 → 任务完成，停止续调
  if (matchesAnyKeyword(text, completionKeywords)) return false;
  // 2. 文本命中阻断关键词（收尾建议句）→ 停止续调
  if (matchesAnyKeyword(text, blockKeywords)) return false;

  // 3. requiredTools 中仍有未调用的关键 Tool → 续调
  if (hasUnmetRequiredTools(requiredTools, invokedToolNames)) return true;

  // 4. 进度叙述但未调 Tool：连续执行型 Skill 宽松续调，否则仅在声明了策略时续调
  if (hasIncompleteProgressNarration(text)) {
    const hasAnyStrategy =
      requiredTools.size > 0 ||
      completionKeywords.length > 0 ||
      blockKeywords.length > 0 ||
      anyContinuous;
    if (hasAnyStrategy || anyContinuous) return true;
  }

  return false;
}

/**
 * 构造续调指令（[系统] 消息）。提示的工具示例从各 Skill 声明的 requiredTools 取，
 * 不再硬编码业务工具名。未声明 requiredTools 时退化为「当前 Skill 允许的 Tool」。
 */
export function buildAutoContinueNudge(
  allowedToolNames: Set<string>,
  skills: AIBaseSkill[] = [],
  toolOutcomes: ToolResponse[] = [],
): string {
  const { requiredTools } = aggregateStrategies(skills);
  const examples = [...requiredTools];
  if (!examples.length) {
    examples.push(...Array.from(allowedToolNames).slice(0, 4));
  }
  const toolHint = examples.length ? examples.join('、') : '当前 Skill 允许的 Tool';

  const failed = toolOutcomes.find(
    (item) =>
      item.kind !== 'success' ||
      item.verified === false ||
      item.ok === false,
  );
  if (failed?.error?.message) {
    return `[系统] 上一 Tool「${failed.meta.tool}」未通过验证（${failed.error.message}）。禁止向用户声称已成功；请根据 Tool 返回的 ok/verified/kind/error.message 说明失败原因或重试。`;
  }

  return `[系统] 请立即调用 Tool 完成尚未执行的步骤（如 ${toolHint}），不要只输出步骤说明或虚假成功汇总。必须以 Tool 返回信封中的 ok/verified/kind/error.message 为准汇报结果。`;
}
