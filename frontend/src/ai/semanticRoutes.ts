import type { SemanticRoute } from '@eadaf/ai-base';

/**
 * 语义化路径解析与白名单（前端执行器）。
 *
 * 安全约束（见 docs/TODOs/AIBase-语义化路由与AI决策跳转方案-v2.md 4.1.5）：
 * - path 必须**逐字等于**清单中的某条模板（禁止清单外字符串）；
 * - params 仅经 encodeURIComponent 替换；拒绝 `..`、`//`、`http(s):`、`javascript:`；
 * - 参数类型对照该条 `params` 声明（number 接受数字或数字字符串）；
 * - 缺参 / 多余参数 / 声明与占位符不一致 → 一律 null（不跳）。
 */

const INJECTION_RE = /\.\.|\/\//;
const SCHEME_RE = /^(https?:|javascript:)/i;

function looksUnsafe(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return true;
  const raw = String(value);
  return INJECTION_RE.test(raw) || SCHEME_RE.test(raw);
}

/** 按声明类型收窄为字符串；类型不符返回 null */
function coerceParam(
  value: unknown,
  def: { type: 'string' | 'number' },
): string | null {
  if (def.type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return String(Number(value));
    }
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return null;
}

/**
 * 把「语义 path + params」解析为真实 URL；任何不满足约束的情况返回 null。
 * 必须对照清单：非法模板 / 缺参 / 多余参数 / 注入 → null。
 */
export function resolveSemanticRoutePath(
  path: string,
  params: Record<string, unknown> | undefined,
  routes: SemanticRoute[],
): string | null {
  if (typeof path !== 'string' || !path.startsWith('/')) return null;

  const route = routes.find((r) => r.path === path);
  if (!route) return null;

  const placeholders = (path.match(/:[a-zA-Z0-9_]+/g) ?? []).map((p) => p.slice(1));
  const declared = route.params ? Object.keys(route.params) : [];

  // 声明一致：占位符 ⊆ 声明 ⊆ 占位符（模板与 params 声明必须完全一致）
  for (const name of placeholders) {
    if (!declared.includes(name)) return null;
  }
  for (const name of declared) {
    if (!placeholders.includes(name)) return null;
  }

  if (placeholders.length === 0) {
    // 无参路由：只要显式传了 params（即使是空对象）即视为非法，强制 AI 使用模板原样
    if (params !== undefined) return null;
    return path;
  }

  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  if (placeholders.length !== Object.keys(params).length) return null;

  let resolved = path;
  for (const name of placeholders) {
    const def = route.params?.[name];
    if (!def) return null;
    const value = params[name];
    if (value === undefined || value === null) return null;
    if (looksUnsafe(value)) return null;
    const coerced = coerceParam(value, def);
    if (coerced === null) return null;
    resolved = resolved.replace(`:${name}`, encodeURIComponent(coerced));
  }
  return resolved;
}

/**
 * 白名单：判断一个（已解析后的）URL 是否属于清单中的页面。
 * 支持清单动态模板的匹配；动态段同样拒绝注入字符。
 */
export function isAllowedNavigationTarget(
  url: string,
  routes: SemanticRoute[],
): boolean {
  if (typeof url !== 'string' || !url.startsWith('/')) return false;

  for (const route of routes) {
    if (route.path === url) return true;
    if (!route.path.includes(':')) continue;

    const templateSegments = route.path.split('/');
    const urlSegments = url.split('/');
    if (templateSegments.length !== urlSegments.length) continue;

    let matched = true;
    for (let i = 0; i < templateSegments.length; i += 1) {
      const template = templateSegments[i];
      const actual = urlSegments[i];
      if (template.startsWith(':')) {
        if (looksUnsafe(actual)) {
          matched = false;
          break;
        }
      } else if (template !== actual) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}
