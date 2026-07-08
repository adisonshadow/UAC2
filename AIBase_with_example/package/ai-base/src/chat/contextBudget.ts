import type { EADAFChatMessage } from './EADAFChatProvider';

/** 估算上下文上限（字符数，约 30k tokens） */
export const MAX_CONTEXT_CHARS = 120_000;

/** 超过该比例时自动整理历史消息 */
export const COMPACT_THRESHOLD = 0.85;

/** 整理后保留的最近消息条数（约 6 轮对话） */
export const KEEP_RECENT_MESSAGES = 12;

export function estimateMessageChars(message: EADAFChatMessage): number {
  const content = message.content;
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) return JSON.stringify(content).length;
  return JSON.stringify(content ?? '').length;
}

export function estimateMessagesChars(messages: EADAFChatMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageChars(message), 0);
}

export function getContextUsagePercent(
  messages: EADAFChatMessage[],
  systemPrompt?: string,
): number {
  let total = systemPrompt?.length ?? 0;
  total += estimateMessagesChars(messages);
  return Math.min(100, Math.round((total / MAX_CONTEXT_CHARS) * 100));
}

export interface CompactHistoryResult {
  history: EADAFChatMessage[];
  compacted: boolean;
  trimmedCount: number;
}

/** 上下文过长时裁剪 API 请求用的历史，并插入系统提示说明已整理 */
export function compactHistoryForApi(history: EADAFChatMessage[]): CompactHistoryResult {
  const usage = estimateMessagesChars(history);
  if (usage < MAX_CONTEXT_CHARS * COMPACT_THRESHOLD) {
    return { history, compacted: false, trimmedCount: 0 };
  }

  const trimmed = history.slice(-KEEP_RECENT_MESSAGES);
  const trimmedCount = history.length - trimmed.length;
  if (trimmedCount <= 0) {
    return { history, compacted: false, trimmedCount: 0 };
  }

  const notice: EADAFChatMessage = {
    role: 'system',
    content:
      `[Context compacted] ${trimmedCount} earlier message(s) were removed to stay within context limits. Continue based on recent messages.`,
  };

  return {
    history: [notice, ...trimmed],
    compacted: true,
    trimmedCount,
  };
}
