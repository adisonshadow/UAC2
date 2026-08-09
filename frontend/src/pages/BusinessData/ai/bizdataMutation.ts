import type { AIMutation } from '@eadaf/ai-base';

/** ModelDesigner 增量应用 bizdata mutation */
export function applyBizdataModelMutation(
  mutation: AIMutation,
  handlers: {
    patchEntity: (entity: API.BusinessDataEntity) => void;
    appendEntity: (entity: API.BusinessDataEntity) => void;
    removeEntity: (entityId: string) => void;
    appendEnum: (enumItem: API.BusinessDataEnum) => void;
    refresh: () => Promise<void>;
  },
): void {
  const payload = mutation.payload as Record<string, unknown> | undefined;

  switch (mutation.type) {
    case 'entity.updated':
      if (payload?.id) {
        handlers.patchEntity(payload as API.BusinessDataEntity);
      } else {
        void handlers.refresh();
      }
      break;
    case 'entity.created':
      if (payload?.id) {
        handlers.appendEntity(payload as API.BusinessDataEntity);
      } else {
        void handlers.refresh();
      }
      break;
    case 'entity.deleted':
      {
        const deletedIds = Array.isArray(payload?.deleteEntityIds)
          ? (payload.deleteEntityIds as string[]).filter(Boolean)
          : [];
        if (deletedIds.length) {
          deletedIds.forEach((id) => handlers.removeEntity(String(id)));
        } else if (mutation.resourceId) {
          handlers.removeEntity(mutation.resourceId);
        } else {
          void handlers.refresh();
        }
      }
      break;
    case 'enum.created':
      if (payload?.id) {
        handlers.appendEnum(payload as API.BusinessDataEnum);
      } else {
        void handlers.refresh();
      }
      break;
    case 'enum.updated':
      void handlers.refresh();
      break;
    case 'relation.created':
    case 'schema.invalidate':
      void handlers.refresh();
      break;
    default:
      void handlers.refresh();
  }
}
