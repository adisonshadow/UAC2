import type { FormInstance } from 'antd';
import { useAISurface } from '@EADAF/ai-base';

export function useAIFormSurface(options: {
  resourceType: 'skill' | 'tool' | 'scope' | 'provider' | 'model';
  resourceId?: string;
  form: FormInstance;
  reloadDetail: () => void | Promise<void>;
}): void {
  const { resourceType, resourceId, form, reloadDetail } = options;
  const surfaceId = resourceId
    ? `aibase.${resourceType}.${resourceId}`
    : `aibase.${resourceType}.create`;

  useAISurface({
    id: surfaceId,
    domain: 'aibase',
    label: `${resourceType} 表单`,
    read: () => form.getFieldsValue(),
    refresh: reloadDetail,
    applyMutation: async (mutation) => {
      if (!mutation.type.startsWith(`${resourceType}.`)) return;
      if (mutation.type.endsWith('.updated') && mutation.resourceId === resourceId) {
        await reloadDetail();
      }
    },
    matchMutation: (mutation) =>
      mutation.domain === 'aibase' && mutation.type.startsWith(`${resourceType}.`),
  });
}
