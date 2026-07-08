/** 从多级 code 推导展示/筛选信息，避免单独维护 category、scopeCode */

function splitCode(code) {
  return String(code || '')
    .split(':')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 看板分组：去掉最后一段指标名，如 sales:order:total_count → sales:order */
function deriveDashboardGroup(code) {
  const parts = splitCode(code);
  if (parts.length >= 2) {
    return parts.slice(0, -1).join(':');
  }
  return parts[0] || '未分类';
}

/** Scope 前缀：第一段，如 sales:order:total_count → sales */
function deriveScopePrefix(code) {
  return splitCode(code)[0] || '';
}

module.exports = {
  splitCode,
  deriveDashboardGroup,
  deriveScopePrefix,
};
