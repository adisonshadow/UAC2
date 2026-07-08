import type { AIMutation } from '@EADAF/ai-base';

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
      if (mutation.resourceId) {
        handlers.removeEntity(mutation.resourceId);
      } else {
        void handlers.refresh();
      }
      break;
    case 'enum.created':
      if (payload?.id) {
        handlers.appendEnum(payload as API.BusinessDataEnum);
      } else {
        void handlers.refresh();
      }
      break;
    case 'relation.created':
    case 'schema.invalidate':
      void handlers.refresh();
      break;
    default:
      void handlers.refresh();
  }
}
