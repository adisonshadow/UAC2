export type ChatToolStepStatus = 'loading' | 'success' | 'error' | 'business_error';

export interface ChatToolStep {
  id: string;
  functionName: string;
  displayName: string;
  status: ChatToolStepStatus;
  durationMs?: number;
  error?: string;
}

export interface AssistantChatMessage {
  role: 'assistant';
  content: string;
  reasoningContent?: string;
  toolSteps?: ChatToolStep[];
}

export type PlanningItemStatus = 'pending' | 'in_progress' | 'completed';

export interface PlanningItemView {
  id: string;
  label: string;
  status: PlanningItemStatus;
}

export function upsertToolStep(
  steps: ChatToolStep[] | undefined,
  step: ChatToolStep,
): ChatToolStep[] {
  const list = steps ? [...steps] : [];
  const index = list.findIndex((item) => item.id === step.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...step };
    return list;
  }
  return [...list, step];
}

/**
 * 有序 segment：把一轮 assistant 回复拆成按 AI 输出顺序排列的单元。
 * - text：一段文本（通常是某一轮的回复正文）
 * - tool：一次工具调用（单条 ThoughtChain）
 *
 * segments 取代了原先「整轮累加 content + toolSteps[]」的扁平结构，
 * 渲染时按数组顺序铺开，文本与 ThoughtChain 自然交错，保留输出时序。
 */
// Planning next moves：展示结构化执行过程中用户可感知的“接下来要做什么”
export type PlanningNextMovesSegment = {
  kind: 'planning';
  id: string;
  title: string;
  items: PlanningItemView[];
  /** 可选：当存在失败并即将重试时，给用户明确“重试什么”提示 */
  hint?: string;
};

/** mid-task HITL：ask_user 挂起后展示的选择卡片 */
export type UserChoiceSegment = {
  kind: 'user_choice';
  id: string;
  requestId: string;
  question: string;
  mode: 'single' | 'multi';
  options: Array<{ id: string; label: string; description?: string }>;
  allowCustom: boolean;
  minSelect: number;
  maxSelect?: number;
  /** 提交后锁定，防重复点击 */
  submitted?: boolean;
};

export type AssistantSegment =
  | { kind: 'text'; id: string; content: string }
  | { kind: 'tool'; id: string; step: ChatToolStep }
  | PlanningNextMovesSegment
  | UserChoiceSegment;

/**
 * 按 id upsert 一个 segment：
 * - 已存在则就地更新（工具段 loading→success 时复用，保持位置不变）
 * - 新增则 append 到末尾，保证顺序 = AI 输出顺序
 *
 * 文本段采用「合并到末尾相邻文本段」策略：同一轮的流式回调会反复 upsert 同一个
 * text segment id（如 `text-round-1`），就地更新内容即可，避免文本碎片化。
 */
export function upsertSegment(
  segments: AssistantSegment[] | undefined,
  segment: AssistantSegment,
): AssistantSegment[] {
  const list = segments ? [...segments] : [];
  const index = list.findIndex((item) => item.id === segment.id);
  if (index >= 0) {
    list[index] =
      list[index].kind === 'tool' && segment.kind === 'tool'
        ? { ...list[index], step: { ...list[index].step, ...segment.step } }
        : segment;
    return list;
  }
  return [...list, segment];
}
