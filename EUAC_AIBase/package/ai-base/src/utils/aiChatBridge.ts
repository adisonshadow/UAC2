export const AI_CHAT_MESSAGE_EVENT = 'aibase:send-chat-message';

type Listener = (text: string) => void;

let pendingMessage: string | null = null;
let openPanel: (() => void) | null = null;

export interface AIChatControls {
  openPanel: () => void;
}

/** AIChatProvider 注册面板控制（打开侧栏等） */
export function registerAIChatControls(controls: AIChatControls | null) {
  openPanel = controls?.openPanel ?? null;
}

/** 向 AI 聊天面板发送消息（window 事件 + pending，兼容 MFSU / 面板未挂载） */
export function sendAIChatMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed || typeof window === 'undefined') return;
  pendingMessage = trimmed;
  window.dispatchEvent(new CustomEvent(AI_CHAT_MESSAGE_EVENT, { detail: trimmed }));
}

/**
 * 模拟用户发送一条消息：打开 AI 面板并触发与手动提交相同的发送流程。
 */
export function sendMockUserMessage(text: string) {
  openPanel?.();
  sendAIChatMessage(text);
}

/** AIChatPanel 订阅外部消息 */
export function subscribeAIChatMessage(listener: Listener) {
  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (!detail) return;
    pendingMessage = null;
    listener(detail);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(AI_CHAT_MESSAGE_EVENT, onEvent);
  }

  if (pendingMessage) {
    const msg = pendingMessage;
    pendingMessage = null;
    queueMicrotask(() => listener(msg));
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(AI_CHAT_MESSAGE_EVENT, onEvent);
    }
  };
}
