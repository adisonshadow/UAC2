import {
  App,
  message as staticMessage,
  Modal as StaticModal,
  notification as staticNotification,
} from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ReactNode } from 'react';

type ModalInstance = Omit<ModalStaticFunctions, 'warn'>;

let messageApi: MessageInstance | null = null;
let modalApi: ModalInstance | null = null;
let notificationApi: NotificationInstance | null = null;

/**
 * 在 antd App 内挂载，把 useApp() 实例同步到模块导出，
 * 供拦截器等非组件代码与业务侧统一使用。
 */
export function AntdAppApiBridge({ children }: { children?: ReactNode }) {
  const api = App.useApp();
  messageApi = api.message;
  modalApi = api.modal;
  notificationApi = api.notification;
  return children ?? null;
}

function createProxy<T extends object>(get: () => T | null, fallback: T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const api = get() ?? fallback;
      const value = Reflect.get(api as object, prop, receiver);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(api) : value;
    },
  });
}

/** 优先使用 App.useApp() 实例；未挂载时回退到静态 API */
export const message = createProxy(() => messageApi, staticMessage);
export const modal = createProxy(
  () => modalApi,
  StaticModal as unknown as ModalInstance,
);
export const notification = createProxy(() => notificationApi, staticNotification);

export function useAntdApp() {
  return App.useApp();
}
