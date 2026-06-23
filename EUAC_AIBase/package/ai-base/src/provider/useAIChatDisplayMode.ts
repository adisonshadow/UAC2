import { useLayoutEffect } from 'react';
import type { AIChatDisplayMode } from '../types';
import { useAIChatLayout } from './context';

/**
 * 在当前页面设置 AI 助手展示形式，卸载后恢复为侧边栏（默认）。
 *
 * 渲染阶段同步写入 displayMode，避免 Provider 在首帧挂载聊天 UI（useEffect/useLayoutEffect 会晚一拍）。
 */
export function useAIChatDisplayMode(mode: AIChatDisplayMode) {
  const { displayMode, setDisplayMode, chatOpen, setChatOpen } = useAIChatLayout();

  if (displayMode !== mode) {
    setDisplayMode(mode);
  }
  if ((mode === 'float' || mode === 'hidden') && chatOpen) {
    setChatOpen(false);
  }

  useLayoutEffect(() => {
    return () => {
      setDisplayMode('sidebar');
    };
  }, [setDisplayMode]);
}
