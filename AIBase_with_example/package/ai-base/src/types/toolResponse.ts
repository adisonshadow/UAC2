export type ToolResultKind = 'success' | 'business_error' | 'system_error';

export interface ToolResponseError {
  code?: string;
  message: string;
  hint?: string;
}

export interface ToolResponse<T = unknown> {
  /** 执行完成（含业务失败；未捕获异常时为 false） */
  ok: boolean;
  /** 写操作：业务侧二次校验通过 */
  verified?: boolean;
  kind: ToolResultKind;
  data?: T;
  error?: ToolResponseError;
  meta: {
    tool: string;
    durationMs?: number;
  };
}

export function isToolResponse(value: unknown): value is ToolResponse {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.ok === 'boolean' &&
    typeof row.kind === 'string' &&
    row.meta != null &&
    typeof (row.meta as Record<string, unknown>).tool === 'string'
  );
}
