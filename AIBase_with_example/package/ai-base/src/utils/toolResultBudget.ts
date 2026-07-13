import type { AIBaseTool, FunctionCallDef } from '../types';

/** 单条 Tool 结果序列化 + 超预算裁剪后的信息（用于 tool role 消息 content） */
export interface TrimmedToolResult {
  /** 最终塞进 role:'tool' content 的字符串 */
  content: string;
  /** 是否发生了裁剪 */
  truncated: boolean;
  /** 原始序列化后的字符数 */
  originalChars: number;
  /** 实际生效的预算字符数 */
  budgetChars: number;
}

/** 序列化任意 Tool 结果为字符串（JSON），失败时退化为 String()。 */
function stringifyResult(result: unknown): string {
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * 序列化 Tool 结果并按预算截断。
 *
 * - 未超预算：原样返回序列化结果（truncated: false）。
 * - 超预算：保留头部 (maxChars - TAIL_RESERVE) 字符，尾部追加截断标注，
 *   使模型明确知道结果被裁剪，可换更聚焦的查询。
 *
 * @param budget.maxChars 该 Tool 结果回灌上下文时的字符上限。
 */
export function serializeToolResultForContext(
  result: unknown,
  budget: { maxChars: number },
): string {
  const serialized = stringifyResult(result);
  const budgetChars = Math.max(1, Math.floor(budget.maxChars) || 1);

  if (serialized.length <= budgetChars) {
    return serialized;
  }

  const TAIL_RESERVE = 120;
  const headKeep = Math.max(1, budgetChars - TAIL_RESERVE);
  const note = `\n…[truncated: original ${serialized.length} chars, budget ${budgetChars}]`;
  return `${serialized.slice(0, headKeep)}${note}`;
}

/**
 * 解析单次 Tool 调用的结果字符预算（优先级：本地 def > 远端 Tool meta > 全局默认）。
 */
export function resolveToolResultBudget(
  localDef: FunctionCallDef | undefined,
  toolMeta: AIBaseTool | undefined,
  globalDefault: number,
): { maxChars: number } {
  const maxChars =
    localDef?.resultBudget?.maxChars ?? toolMeta?.resultBudget?.maxChars ?? globalDefault;
  return { maxChars };
}
