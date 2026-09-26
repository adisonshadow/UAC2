import { useEffect, useRef } from 'react';
import {
  getAIBaseTheme,
  setAIBaseTheme,
  subscribeAIBaseTheme,
  type AIBaseThemeMode,
} from '@eadaf/ai-base';
import { getUserHabit } from '@/utils/userHabit';
import { useUiTheme, type UiThemePreference } from './uiTheme';

/** EADAF 界面主题 → AIBase 外观 */
export function uiThemeToAiBase(preference: UiThemePreference): AIBaseThemeMode {
  return preference === 'system' ? 'auto' : preference;
}

/** AIBase 外观 → EADAF 界面主题 */
export function aiBaseToUiTheme(mode: AIBaseThemeMode): UiThemePreference {
  return mode === 'auto' ? 'system' : mode;
}

function peekUiPreference(): UiThemePreference {
  const value = getUserHabit<string>('ui.theme', 'system');
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

/** 模块加载时先对齐 chat.theme，避免侧栏首屏仍用旧外观 */
if (typeof window !== 'undefined') {
  const next = uiThemeToAiBase(peekUiPreference());
  if (getAIBaseTheme() !== next) {
    setAIBaseTheme(next);
  }
}

/**
 * 将系统设置「界面主题」与 AI 助手侧栏外观双向同步。
 * AIBase 单独存 `chat.theme`，不接会仍用旧习惯值，看起来「没跟随 EADAF」。
 */
export function SyncUiThemeWithAiBase() {
  const { preference, setPreference } = useUiTheme();
  const syncingRef = useRef(false);

  useEffect(() => {
    const next = uiThemeToAiBase(preference);
    if (getAIBaseTheme() === next) return;
    syncingRef.current = true;
    setAIBaseTheme(next);
    syncingRef.current = false;
  }, [preference]);

  useEffect(() => {
    return subscribeAIBaseTheme((mode) => {
      if (syncingRef.current) return;
      setPreference(aiBaseToUiTheme(mode));
    });
  }, [setPreference]);

  return null;
}
