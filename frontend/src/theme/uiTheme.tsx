import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getUserHabit, setUserHabit } from '@/utils/userHabit';
import { isDarkColorScheme } from '@/utils/ssoLoginPage';

export type UiThemePreference = 'system' | 'light' | 'dark';
export type ResolvedUiTheme = 'light' | 'dark';

const STORAGE_KEY = 'ui.theme';

function readPreference(): UiThemePreference {
  const value = getUserHabit<string>(STORAGE_KEY, 'system');
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

function resolveTheme(preference: UiThemePreference): ResolvedUiTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return isDarkColorScheme() ? 'dark' : 'light';
}

function applyDocumentTheme(resolved: ResolvedUiTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
}

/** 模块加载时同步打上 data-theme，减少首屏闪烁 */
if (typeof document !== 'undefined') {
  applyDocumentTheme(resolveTheme(readPreference()));
}


interface UiThemeContextValue {
  preference: UiThemePreference;
  resolved: ResolvedUiTheme;
  setPreference: (next: UiThemePreference) => void;
}

const UiThemeContext = createContext<UiThemeContextValue | null>(null);

export function UiThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<UiThemePreference>(readPreference);
  const [systemIsDark, setSystemIsDark] = useState(isDarkColorScheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = useMemo<ResolvedUiTheme>(() => {
    if (preference === 'dark') return 'dark';
    if (preference === 'light') return 'light';
    return systemIsDark ? 'dark' : 'light';
  }, [preference, systemIsDark]);

  useLayoutEffect(() => {
    applyDocumentTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((next: UiThemePreference) => {
    setPreferenceState((prev) => {
      if (prev === next) return prev;
      setUserHabit(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme(): UiThemeContextValue {
  const ctx = useContext(UiThemeContext);
  if (!ctx) {
    throw new Error('useUiTheme must be used within UiThemeProvider');
  }
  return ctx;
}

/** 在 Provider 外也可解析当前主题（例如首屏脚本式预读） */
export function peekResolvedUiTheme(): ResolvedUiTheme {
  return resolveTheme(readPreference());
}
