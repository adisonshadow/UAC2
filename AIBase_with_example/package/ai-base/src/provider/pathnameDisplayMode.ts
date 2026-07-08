import type { AIChatDisplayMode } from '../types';

export function getCurrentPathname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname;
}

export function isHiddenPath(pathname: string, hiddenPaths: string[]): boolean {
  return hiddenPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getDisplayModeForPath(pathname: string, hiddenPaths: string[]): AIChatDisplayMode {
  return isHiddenPath(pathname, hiddenPaths) ? 'hidden' : 'sidebar';
}

/** 监听 SPA 路由变化（不依赖 react-router，与 AIChatDisplay 配合避免首屏闪烁） */
export function subscribePathname(onChange: () => void): () => void {
  const handleChange = () => onChange();

  window.addEventListener('popstate', handleChange);

  const { pushState, replaceState } = history;
  history.pushState = function (...args: Parameters<typeof pushState>) {
    pushState.apply(this, args);
    handleChange();
  };
  history.replaceState = function (...args: Parameters<typeof replaceState>) {
    replaceState.apply(this, args);
    handleChange();
  };

  return () => {
    window.removeEventListener('popstate', handleChange);
    history.pushState = pushState;
    history.replaceState = replaceState;
  };
}
