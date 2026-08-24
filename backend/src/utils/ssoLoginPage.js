const LOGIN_THEMES = ['light', 'dark', 'system'];
const ASIDE_KINDS = ['lottie', 'image'];

function trimAsset(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function trimSubtitle(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

/** 规范化 SSO 登录页样式；非法或空对象返回 undefined */
function normalizeSsoLoginPage(input) {
  if (!input || typeof input !== 'object') return undefined;
  return {
    theme: LOGIN_THEMES.includes(input.theme) ? input.theme : 'light',
    aside_kind: ASIDE_KINDS.includes(input.aside_kind) ? input.aside_kind : 'lottie',
    aside_lottie: trimAsset(input.aside_lottie),
    aside_image: trimAsset(input.aside_image),
    large_text: Boolean(input.large_text),
    subtitle: trimSubtitle(input.subtitle),
  };
}

function mergeSsoLoginPage(existing, incoming) {
  if (incoming === undefined) {
    return normalizeSsoLoginPage(existing);
  }
  return normalizeSsoLoginPage({ ...(existing || {}), ...incoming });
}

module.exports = {
  LOGIN_THEMES,
  ASIDE_KINDS,
  normalizeSsoLoginPage,
  mergeSsoLoginPage,
};
