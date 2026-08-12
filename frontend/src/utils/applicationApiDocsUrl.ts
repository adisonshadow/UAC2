function encodeRoutePathSegments(routePath: string): string {
  return routePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** 应用公开 API 文档页路径（站内路由） */
export function buildApplicationApiDocsPath(applicationKey: string, routePath?: string): string {
  const key = String(applicationKey || '').trim();
  if (!key) return '';
  const base = `/public/applications/${encodeURIComponent(key)}/api-docs`;
  const path = String(routePath || '').trim();
  if (!path) return base;
  return `${base}/${encodeRoutePathSegments(path)}`;
}

/** 应用公开 API 文档页完整 URL（供第三方开发人员查看可访问 API） */
export function buildApplicationApiDocsUrl(applicationKey: string, routePath?: string): string {
  const key = String(applicationKey || '').trim();
  if (!key || typeof window === 'undefined') return '';
  return `${window.location.origin}${buildApplicationApiDocsPath(key, routePath)}`;
}

/** 应用异常响应文档页路径（站内路由，所有 API 共享） */
export function buildExceptionResponsesDocsPath(applicationKey: string): string {
  const key = String(applicationKey || '').trim();
  if (!key) return '';
  return `/public/applications/${encodeURIComponent(key)}/api-docs/exception-responses`;
}

/** 应用关联的提交外部 API 文档页路径 */
export function buildOutboundWebhooksDocsPath(applicationKey: string): string {
  const key = String(applicationKey || '').trim();
  if (!key) return '';
  return `/public/applications/${encodeURIComponent(key)}/api-docs/outbound-webhooks`;
}

/** 应用 API Skill 文档页路径（站内路由，EADAF API 调用约定） */
export function buildApiSkillDocsPath(applicationKey: string): string {
  const key = String(applicationKey || '').trim();
  if (!key) return '';
  return `/public/applications/${encodeURIComponent(key)}/api-docs/api-skill`;
}

/** 应用 API Skill 原始 Markdown URL（供 AI / 工具拉取） */
export function buildApiSkillMarkdownUrl(applicationKey: string): string {
  const key = String(applicationKey || '').trim();
  if (!key || typeof window === 'undefined') return '';
  return `${window.location.origin}/api/v1/applications-public/${encodeURIComponent(key)}/api-skill.md`;
}

/** 从公开文档页 URL 解析 route_path（如 equipment/EquipmentUpdate） */
export function parseApiDocsRoutePathFromPathname(pathname: string, applicationKey: string): string | undefined {
  const key = encodeURIComponent(String(applicationKey || '').trim());
  const prefix = `/public/applications/${key}/api-docs/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (!rest) return undefined;
  return rest
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}
