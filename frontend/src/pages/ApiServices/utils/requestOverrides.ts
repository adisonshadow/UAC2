export type RequestOverrideEntry = {
  requestExample?: unknown;
};

export type RequestOverridesMap = Record<string, RequestOverrideEntry>;

/** 请求参数 Example 与测试 mock 为同一数据（security_config.requestOverrides[op].requestExample） */
export const REQUEST_EXAMPLE_FIELD_LABEL = '请求参数 Example';

export function readRequestOverride(
  securityConfig: Record<string, unknown> | undefined,
  operation?: string,
): RequestOverrideEntry | null {
  if (!operation) return null;
  const overrides = securityConfig?.requestOverrides as RequestOverridesMap | undefined;
  const entry = overrides?.[operation];
  if (entry && typeof entry === 'object') {
    return entry;
  }
  const legacy = (securityConfig?.testMockParameters as Record<string, unknown> | undefined)?.[operation];
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    return { requestExample: legacy };
  }
  return null;
}

export function buildRequestOverridesPayload(
  operation: string,
  requestExample: unknown,
): RequestOverridesMap {
  return {
    [operation]: { requestExample },
  };
}

export function extractRequestExampleFromPayload(payload: unknown): {
  operation?: string;
  requestExample?: Record<string, unknown>;
} {
  if (!payload || typeof payload !== 'object') return {};
  const row = payload as Record<string, unknown>;
  const candidate = row.mockParameters
    ?? row.parameters
    ?? row.requestExample
    ?? row.savedMockParameters;
  const operation = typeof row.operation === 'string' ? row.operation : undefined;
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return { operation, requestExample: candidate as Record<string, unknown> };
  }
  return { operation };
}

export function formatRequestExampleText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}
