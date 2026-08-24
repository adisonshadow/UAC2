/**
 * @deprecated 请改用 AIChatProvider `plugins={[eadafHostToolsPlugin]}`。
 * 保留空组件以免旧引用崩溃。
 */
export default function AIChatClientToolsRegistrar() {
  return null;
}

export { eadafHostToolsPlugin } from '@/ai/eadafHostToolsPlugin';
