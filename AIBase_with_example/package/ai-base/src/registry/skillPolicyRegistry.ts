import type { AIBaseSkill, SkillCompletionStrategy } from '../types';

/**
 * 业务方覆盖通道：按 Skill slug 注册完成策略覆盖。
 *
 * 设计：Skill 的 completionStrategy 可由后端元数据（completion_strategy 字段）下发，
 * 也可由前端在此注册表覆盖（覆盖优先级高于后端声明）。两者都为空时该 Skill 无策略。
 *
 * 把"是否需要强制续调 Tool / 什么文本算任务完成"这类业务判定从 SDK 内部正则
 * 下沉为业务方显式声明，SDK 保持零业务知识。
 */
const overrides = new Map<string, SkillCompletionStrategy>();

export type SkillCompletionPolicyOverride = Partial<SkillCompletionStrategy>;

/** 注册（或覆盖）某 Skill slug 的完成策略。覆盖会与后端声明合并，覆盖优先。 */
export function registerSkillCompletionPolicy(
  slug: string,
  override: SkillCompletionPolicyOverride,
): void {
  if (!slug) return;
  overrides.set(slug, { ...override });
}

/** 注销某 Skill slug 的策略覆盖（回退到后端声明） */
export function unregisterSkillCompletionPolicy(slug: string): void {
  overrides.delete(slug);
}

/** 清空所有已注册的策略覆盖（测试/卸载场景） */
export function clearSkillCompletionPolicies(): void {
  overrides.clear();
}

/**
 * 取某 Skill 生效的完成策略：前端注册表覆盖优先于后端 skill.completionStrategy 声明。
 * 两者都为空返回 undefined。
 */
export function getSkillCompletionStrategy(
  skill: AIBaseSkill,
): SkillCompletionStrategy | undefined {
  const override = overrides.get(skill.slug);
  if (override) {
    return { ...skill.completionStrategy, ...override };
  }
  return skill.completionStrategy;
}
