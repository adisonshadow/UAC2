import type { ActionType } from '@ant-design/pro-components';
import type { RefObject } from 'react';
import { useAISurface } from '@EADAF/ai-base';

/** ProTable 列表页：AI mutation 触发 reload */
export function useAIListSurface(
  id: string,
  label: string,
  actionRef: RefObject<ActionType | undefined>,
  read?: () => unknown,
): void {
  useAISurface({
    id,
    domain: 'aibase',
    label,
    read: read ?? (() => ({})),
    refresh: () => {
      actionRef.current?.reload();
    },
    applyMutation: (mutation) => {
      if (
        mutation.type.endsWith('.created')
        || mutation.type.endsWith('.updated')
        || mutation.type.endsWith('.deleted')
      ) {
        actionRef.current?.reload();
      }
    },
    matchMutation: (mutation) => mutation.domain === 'aibase',
  });
}
