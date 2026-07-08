import { ChatSessionGroupProvider as BaseChatSessionGroupProvider } from '@EADAF/ai-base';
import { useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveChatSessionGroupFromPathname } from './chatSessionGroup';

export function ChatSessionGroupProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const groupId = useMemo(() => resolveChatSessionGroupFromPathname(pathname), [pathname]);
  return <BaseChatSessionGroupProvider groupId={groupId}>{children}</BaseChatSessionGroupProvider>;
}
