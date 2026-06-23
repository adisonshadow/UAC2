import type { ChatReferenceItem } from '../provider/ChatReferenceContext';

function formatReferenceContent(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export function formatMessageWithReferences(query: string, refs: ChatReferenceItem[]): string {
  if (!refs.length) return query;

  const refBlock = refs
    .map((ref) => `- [${ref.type}] ${ref.label}: ${formatReferenceContent(ref.content)}`)
    .join('\n');

  return `[引用上下文]\n${refBlock}\n\n用户问题：${query}`;
}
