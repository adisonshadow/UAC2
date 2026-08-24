import type { PlanItem, SkillCompletionStrategy } from '../types';
import type { ToolResponse } from '../types/toolResponse';

/**
 * 结构化终止（task_complete / update_plan）的权威状态载体。
 *
 * 设计动机：builtin Tool 的 handler 通过 `registerFunctionCall` 注册，
 * 签名只能拿到 `args`，无法直接访问 `submitQuery` 闭包。因此用模块级 holder：
 * 每次 turn 开始时由 `useAIBaseChat` 调用 `beginTurn` 注入本回合的上下文
 * （当前 plan、tool outcomes、激活 skill 的完成策略），两个 harness Tool 的
 * handler 通过 `getCurrent()` 读取。
 *
 * holder 只保存「最近一次 active turn」的引用，turn 之间互相隔离靠 beginTurn/endTurn。
 */

export interface AgentTurnContext {
  /** 当前权威 plan（由 update_plan 维护） */
  plan: PlanItem[];
  /** 本回合已执行的 Tool 结果信封（由 loop 同步写入） */
  toolOutcomes: ToolResponse[];
  /** 已调用过的 Tool functionName 集合 */
  invokedToolNames: Set<string>;
  /** 当前激活 Skill 的完成策略（用于 terminationStrictness / requiredTools） */
  completionStrategy?: SkillCompletionStrategy;
  /**
   * 本回合 LLM 可见的业务 Tool 名（不含 harness）。
   * 用于忽略 plan.requiresVerification 中模型胡填的、当前页根本不存在的 Tool。
   * 可被 expandAvailableTools 就地扩展（同回合 skill 懒加载后立即生效）。
   */
  availableToolNames?: Set<string>;
}

let current: AgentTurnContext | null = null;

/** 本回合开始时注入上下文。返回的 handle 用于结束时清理。 */
export function beginTurn(ctx: AgentTurnContext): () => void {
  current = ctx;
  return () => {
    // 仅在仍是本回合时清理，避免被后开的 turn 误清
    if (current === ctx) current = null;
  };
}

export function getCurrent(): AgentTurnContext | null {
  return current;
}

/**
 * 同回合扩展可见业务 Tool 名（skill 懒加载后、不等 React 重渲染）。
 * 供 run_code / run_subagent / task_complete 与后续 LLM round 同源。
 */
export function expandAvailableTools(names: Iterable<string>): void {
  if (!current?.availableToolNames) return;
  for (const name of names) {
    const n = String(name || '').trim();
    if (n) current.availableToolNames.add(n);
  }
}

export function getPlan(): PlanItem[] {
  return current?.plan ?? [];
}

/** update_plan handler 写入新的 plan（已做单一 in_progress 等校验） */
export function setPlan(plan: PlanItem[]): void {
  if (current) current.plan = plan;
}

/** loop 每次执行完 Tool 后同步追加结果，供 task_complete 校验 */
export function recordToolOutcome(outcome: ToolResponse): void {
  current?.toolOutcomes.push(outcome);
}

export function recordInvokedTool(name: string): void {
  current?.invokedToolNames.add(name);
}
