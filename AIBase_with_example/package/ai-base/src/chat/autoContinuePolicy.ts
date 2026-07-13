import type { AIBaseSkill } from '../types';
import { getSkillCompletionStrategy } from '../registry/skillPolicyRegistry';

/**
 * 声明式 auto-continue 策略：取代历史版本里硬编码的 bizdata/apiservice 等业务判定。
 *
 * 判定依据全部来自各 Skill 的 SkillCompletionStrategy（后端声明或前端注册表覆盖）：
 * - requiredTools：本轮结束若仍有未调用的关键 Tool → 续调
 * - completionKeywords：文本命中 → 视为任务完成，停止续调
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
}

/** 合并所有 Skill 的完成策略（取并集；布尔字段任一为真即为真） */
function aggregateStrategies(skills: AIBaseSkill[]): {
  requiredTools: Set<string>;
  completionKeywords: string[];
  blockKeywords: string[];
  anyContinuous: boolean;
} {
  const requiredTools = new Set<string>();
  const completionKeywords: string[] = [];
  const blockKeywords: string[] = [];
  let anyContinuous = false;

  for (const skill of skills) {
    const strategy = getSkillCompletionStrategy(skill);
    if (!strategy) continue;
    if (strategy.requiredTools) {
      for (const name of strategy.requiredTools) requiredTools.add(name);
    }
    if (strategy.completionKeywords) completionKeywords.push(...strategy.completionKeywords);
    if (strategy.blockKeywords) blockKeywords.push(...strategy.blockKeywords);
    if (strategy.continuousExecution) anyContinuous = true;
  }

  return { requiredTools, completionKeywords, blockKeywords, anyContinuous };
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

/**
 * 是否应在「本轮只输出文本、未调 Tool」时自动注入续调指令。
 * 全部依据已加载 Skill 的声明式策略判定。
 */
export function shouldAutoContinueAfterTextOnly(ctx: AutoContinueContext): boolean {
  const { text, toolsExecuted, invokedToolNames, skills } = ctx;
  if (toolsExecuted === 0 || !text.trim()) return false;

  const { requiredTools, completionKeywords, blockKeywords, anyContinuous } =
    aggregateStrategies(skills);

  // 1. 文本命中完成关键词 → 任务完成，停止续调
  if (matchesAnyKeyword(text, completionKeywords)) return false;
  // 2. 文本命中阻断关键词（收尾建议句）→ 停止续调
  if (matchesAnyKeyword(text, blockKeywords)) return false;

  // 3. requiredTools 中仍有未调用的关键 Tool → 续调
  const unmetRequired = [...requiredTools].some(
    (name) => !invokedToolNames.has(name),
  );
  if (unmetRequired) return true;

  // 4. 进度叙述但未调 Tool：连续执行型 Skill 宽松续调，否则仅在声明了策略时续调
  if (hasIncompleteProgressNarration(text)) {
    // 仅当存在任何声明（即上述聚合非空）时才续调，避免对无策略 Skill 过度干预
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
export function buildAutoContinueNudge(allowedToolNames: Set<string>, skills: AIBaseSkill[] = []): string {
  const { requiredTools } = aggregateStrategies(skills);
  const examples = [...requiredTools];
  if (!examples.length) {
    examples.push(...Array.from(allowedToolNames).slice(0, 4));
  }
  const toolHint = examples.length ? examples.join('、') : '当前 Skill 允许的 Tool';
  return `[系统] 请立即调用 Tool 完成尚未执行的步骤（如 ${toolHint}），不要只输出步骤说明或虚假成功汇总。必须以 Tool 返回的 _verification / success / verified 字段为准汇报结果。`;
}
