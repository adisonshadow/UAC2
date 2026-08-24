export type SsoLoginTheme = 'light' | 'dark' | 'system';
export type SsoLoginAsideKind = 'lottie' | 'image';

export type SsoLoginPageStyle = {
  theme?: SsoLoginTheme;
  aside_kind?: SsoLoginAsideKind;
  aside_lottie?: string | null;
  aside_image?: string | null;
  large_text?: boolean;
  /** 登录页副标题；不填则不显示 */
  subtitle?: string | null;
};

export function isDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveLoginTheme(theme?: SsoLoginTheme | null): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'system') return isDarkColorScheme() ? 'dark' : 'light';
  return 'light';
}
