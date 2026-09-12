/**
 * 应用导出/导入 的统一 Scope 前缀筛选工具。
 *
 * 规则(review 方案 §3.5):一律使用「应用已配置的 scope 原值前缀」匹配,
 * 禁止按冒号首段膨胀成顶层域(会把 CRM:* 整个域带进来)。
 */

/**
 * 判断 code 是否命中 scopes 中的任意前缀(精确相等或以 `prefix:` 开头)。
 * 与 applicationApiCatalogService.matchesApiDataScope 的 domain 前缀语义同形。
 * @param {string} code
 * @param {string[]|undefined|null} scopes
 * @returns {boolean}
 */
function prefixHit(code, scopes) {
  const c = String(code || '');
  if (!c) return false;
  return (scopes || []).some((s) => {
    const p = String(s || '').trim();
    if (!p) return false;
    return c === p || c.startsWith(`${p}:`);
  });
}

/**
 * 解析 api_data_scope JSONB → { domainCodes, serviceCodes },兼容 legacy 对象键格式。
 * (与 applicationApiCatalogService.parseApiDataScope 同形,此处独立实现避免循环依赖)
 * @param {unknown} scope
 * @returns {{ domainCodes: string[], serviceCodes: string[] }}
 */
function parseApiDataScope(scope) {
  const empty = { domainCodes: [], serviceCodes: [] };
  if (!scope || typeof scope !== 'object') return empty;
  const domainCodes = Array.isArray(scope.domainCodes)
    ? scope.domainCodes.filter((c) => typeof c === 'string' && c.trim())
    : [];
  const serviceCodes = Array.isArray(scope.serviceCodes)
    ? scope.serviceCodes.filter((c) => typeof c === 'string' && c.trim())
    : [];
  // legacy: { 'IPS': true, 'CRM:bom': { read: true } } 形式,对象键视为 domain
  if (!domainCodes.length && !serviceCodes.length) {
    const legacyKeys = Object.keys(scope).filter((k) => typeof scope[k] !== 'function');
    if (legacyKeys.length) return { domainCodes: legacyKeys, serviceCodes: [] };
  }
  return { domainCodes, serviceCodes };
}

/**
 * API 服务筛选:api_data_scope 优先(精确 serviceCodes + domain 前缀),
 * 为空则回退「应用 bizdata_scope_codes 原值前缀」。
 * @param {string} serviceCode
 * @param {{domainCodes: string[], serviceCodes: string[]}|null} apiDataScope
 * @param {string[]} bizdataScopeCodes
 */
function matchApiServiceByScope(serviceCode, apiDataScope, bizdataScopeCodes) {
  const code = String(serviceCode || '');
  if (!code) return false;
  if (apiDataScope && (apiDataScope.domainCodes.length || apiDataScope.serviceCodes.length)) {
    if (apiDataScope.serviceCodes.includes(code)) return true;
    return apiDataScope.domainCodes.some((d) => code === d || code.startsWith(`${d}:`));
  }
  return prefixHit(code, bizdataScopeCodes);
}

/**
 * Webhook 筛选:outbound_webhook_scope 优先(webhookCodes 精确 + domainCodes 前缀)。
 * @param {string} webhookCode
 * @param {{domainCodes: string[], webhookCodes: string[]}|null} webhookScope
 * @returns {boolean} false 表示 scope 非空但未命中;调用方需先判空以走回退分支
 */
function matchWebhookByScope(webhookCode, webhookScope) {
  const code = String(webhookCode || '');
  if (!code) return false;
  const scope = webhookScope && typeof webhookScope === 'object' ? webhookScope : {};
  const domainCodes = Array.isArray(scope.domainCodes) ? scope.domainCodes : [];
  const webhookCodes = Array.isArray(scope.webhookCodes) ? scope.webhookCodes : [];
  if (!domainCodes.length && !webhookCodes.length) return false;
  if (webhookCodes.includes(code)) return true;
  return domainCodes.some((d) => code === d || code.startsWith(`${d}:`));
}

/**
 * outbound_webhook_scope 是否整体为空(用于回退到「绑定的 API 服务」判断)。
 */
function isWebhookScopeEmpty(webhookScope) {
  const scope = webhookScope && typeof webhookScope === 'object' ? webhookScope : {};
  const domainCodes = Array.isArray(scope.domainCodes) ? scope.domainCodes : [];
  const webhookCodes = Array.isArray(scope.webhookCodes) ? scope.webhookCodes : [];
  return !domainCodes.length && !webhookCodes.length;
}

/**
 * 计算 code 的冒号祖先路径(不含自身)。
 * 'IPS:bom:item' → ['IPS', 'IPS:bom']
 * @param {string} code
 * @returns {string[]}
 */
function buildScopeAncestorCodes(code) {
  const c = String(code || '');
  if (!c) return [];
  const parts = c.split(':');
  const ancestors = [];
  for (let i = 1; i < parts.length; i += 1) {
    ancestors.push(parts.slice(0, i).join(':'));
  }
  return ancestors;
}

/**
 * hooks 的 event_filter 命中判断:event_filter 的 JSON 序列化中出现
 * 本次导出的 entity / api service code。
 * @param {object|undefined|null} eventFilter
 * @param {Set<string>} exportedCodes
 * @returns {boolean}
 */
function hookEventFilterHits(eventFilter, exportedCodes) {
  if (!eventFilter || !exportedCodes.size) return false;
  let text;
  try {
    text = JSON.stringify(eventFilter);
  } catch {
    return false;
  }
  if (!text) return false;
  for (const code of exportedCodes) {
    if (text.includes(code)) return true;
  }
  return false;
}

module.exports = {
  prefixHit,
  parseApiDataScope,
  matchApiServiceByScope,
  matchWebhookByScope,
  isWebhookScopeEmpty,
  buildScopeAncestorCodes,
  hookEventFilterHits,
};
