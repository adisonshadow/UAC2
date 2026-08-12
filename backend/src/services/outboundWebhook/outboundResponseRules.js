/**
 * 出站响应判定规则
 *
 * 规则语法（小子集）：`字段路径 运算符 字面量`
 * - 运算符：==  !=
 * - 路径：点号分隔，如 code、data.isOK
 * - 字面量：number / boolean / null / 单引号或双引号字符串 / 裸字符串
 *
 * 任一条「异常规则」匹配 → 视为失败。
 * 默认：HTTP 非 2xx 也视为异常（可用 httpStatusAsException: false 关闭）。
 */

function getByPath(obj, path) {
  if (obj == null || !path) return undefined;
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function parseLiteral(raw) {
  const s = String(raw).trim();
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith("'") && s.endsWith("'"))
    || (s.startsWith('"') && s.endsWith('"'))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * @param {string} ruleText
 * @returns {{ path: string, op: '=='|'!=', value: unknown } | null}
 */
function parseRule(ruleText) {
  const text = String(ruleText || '').trim();
  if (!text) return null;
  const m = text.match(/^([a-zA-Z_][\w.]*)\s*(==|!=)\s*(.+)$/);
  if (!m) return null;
  return {
    path: m[1],
    op: m[2],
    value: parseLiteral(m[3]),
  };
}

function matchRule(parsed, bodyObj) {
  if (!parsed) return false;
  const actual = getByPath(bodyObj, parsed.path);
  if (parsed.op === '==') return actual === parsed.value;
  if (parsed.op === '!=') return actual !== parsed.value;
  return false;
}

function tryParseJsonBody(body) {
  if (body == null || body === '') return null;
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(String(body));
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   httpStatus: number,
 *   responseBody: string|null|object,
 *   responseConfig?: {
 *     success?: { schema?: unknown, example?: unknown },
 *     exception?: { schema?: unknown, example?: unknown, rules?: string[] },
 *     httpStatusAsException?: boolean,
 *   } | null,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   matchedRules: string[],
 *   httpFailed: boolean,
 *   errorMessage: string|null,
 * }}
 */
function evaluateResponse({ httpStatus, responseBody, responseConfig }) {
  const cfg = responseConfig && typeof responseConfig === 'object' ? responseConfig : {};
  const httpStatusAsException = cfg.httpStatusAsException !== false;
  const rules = Array.isArray(cfg.exception?.rules) ? cfg.exception.rules : [];
  const bodyObj = tryParseJsonBody(responseBody);

  const httpFailed = httpStatusAsException
    && (typeof httpStatus !== 'number' || httpStatus < 200 || httpStatus >= 300);

  const matchedRules = [];
  for (const ruleText of rules) {
    const parsed = parseRule(ruleText);
    if (!parsed) continue;
    if (matchRule(parsed, bodyObj)) {
      matchedRules.push(String(ruleText).trim());
    }
  }

  const ok = !httpFailed && matchedRules.length === 0;
  let errorMessage = null;
  if (!ok) {
    const parts = [];
    if (httpFailed) {
      parts.push(httpStatus ? `HTTP 非 2xx: ${httpStatus}` : 'HTTP 请求失败');
    }
    if (matchedRules.length) {
      parts.push(`异常规则命中: ${matchedRules.join(', ')}`);
    }
    errorMessage = parts.join('；');
  }

  return { ok, matchedRules, httpFailed, errorMessage };
}

module.exports = {
  parseRule,
  evaluateResponse,
  tryParseJsonBody,
  getByPath,
};
