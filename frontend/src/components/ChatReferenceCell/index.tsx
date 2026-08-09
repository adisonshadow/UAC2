import type { ReactNode } from 'react';
import type { AddReferenceParams } from '@eadaf/ai-base';
import { useChatReference } from '@eadaf/ai-base';
import ChatReferenceTarget from '@/components/ChatReferenceTarget';

export interface ChatReferenceCellProps {
  label: ReactNode;
  reference: AddReferenceParams;
}

/** 表格名称列：文本 + 「添加到 AI」按钮 */
export default function ChatReferenceCell({ label, reference }: ChatReferenceCellProps) {
  const { addReference } = useChatReference();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
      <span style={{ minWidth: 0 }}>{label}</span>
      <ChatReferenceTarget onClick={() => addReference(reference)} />
    </span>
  );
}
