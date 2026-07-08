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
