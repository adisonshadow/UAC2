import type { ToolInvokeLogEntry } from '@eadaf/ai-base';

export const API_SERVICE_CREATE_PATH = '/api_services/create';

const API_SERVICE_WRITE_TOOL_RE = /^apiservice_(create|update|delete|publish|disable|set_test|create_exception|update_exception|delete_exception)/;

/** 创建 / 编辑 / 测试页（AI 工作流上下文） */
export function isApiServiceWorkflowPath(pathname: string): boolean {
  return (
    pathname === API_SERVICE_CREATE_PATH
    || /^\/api_services\/[^/]+\/(?:edit|test)$/.test(pathname)
  );
}

export function extractApiServiceIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/api_services\/([^/]+)\/(?:edit|test)$/);
  return match?.[1];
}

export function buildApiServiceWorkflowPath(
  target: 'create' | 'edit' | 'test',
  serviceId?: string,
): string | undefined {
  if (target === 'create') return API_SERVICE_CREATE_PATH;
  if (!serviceId) return undefined;
  if (target === 'edit') return `/api_services/${serviceId}/edit`;
  if (target === 'test') return `/api_services/${serviceId}/test`;
  return undefined;
}

function extractServiceIdFromToolResult(entry: ToolInvokeLogEntry): string | undefined {
  const result = entry.result as Record<string, unknown> | undefined;
  if (!result) return undefined;

  const data = (result.data ?? result) as Record<string, unknown>;
  if (typeof data.id === 'string' && data.id) return data.id;

  const created = data.created as Array<{ id?: string }> | undefined;
  if (Array.isArray(created)) {
    const first = created.find((item) => item?.id);
    if (first?.id) return first.id;
  }

  return undefined;
}

/**
 * API 服务工作流页内的 Tool 跳转策略。
 * - `null`：不处理，走全局默认路由
 * - `''`：抑制跳转（留在当前页）
 * - 非空字符串：跳转到指定路径
 */
export function resolveApiServiceWorkflowToolNavigation(
  toolName: string,
  entry: ToolInvokeLogEntry,
  currentPath: string,
): string | null {
  if (!isApiServiceWorkflowPath(currentPath)) return null;
  if (!toolName.startsWith('apiservice_') || toolName.endsWith('_navigate')) return null;

  const serviceId = extractServiceIdFromToolResult(entry)
    || (typeof entry.args.serviceId === 'string' ? entry.args.serviceId : undefined)
    || extractApiServiceIdFromPath(currentPath);

  if (toolName === 'apiservice_create_service' || toolName === 'apiservice_create_services_batch') {
    return serviceId ? buildApiServiceWorkflowPath('edit', serviceId) ?? '' : '';
  }

  if (API_SERVICE_WRITE_TOOL_RE.test(toolName)) {
    return '';
  }

  return null;
}

export function resolveApiServiceNavigateTarget(
  target: string,
  serviceId: string | undefined,
  currentPath: string,
): string {
  if (target === 'list' && isApiServiceWorkflowPath(currentPath)) {
    throw new Error('当前处于创建/编辑/测试流程，请使用 edit、test 或 create 跳转，勿跳转到列表');
  }

  const resolvedId = serviceId || extractApiServiceIdFromPath(currentPath);

  if (target === 'create') {
    return API_SERVICE_CREATE_PATH;
  }
  if (target === 'edit') {
    if (!resolvedId) throw new Error('跳转到 edit 需要提供 serviceId 或 code');
    return `/api_services/${resolvedId}/edit`;
  }
  if (target === 'test') {
    if (!resolvedId) throw new Error('跳转到 test 需要提供 serviceId 或 code');
    return `/api_services/${resolvedId}/test`;
  }

  return '/api_services/list';
}
