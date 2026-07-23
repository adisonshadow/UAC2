import { buildOperationResponsePreview } from './buildOperationResponsePreview';

export type ResponseOverrideEntry = {
  responsesSchema?: Record<string, unknown>;
  responseExample?: unknown;
};

export type ResponseOverridesMap = Record<string, ResponseOverrideEntry>;

/** Response Example 文档禁止 data.item 为 null（运行时可能为 null，示例须展示实体字段） */
export function hasNullItemInResponseExample(example: unknown): boolean {
  if (!example || typeof example !== 'object') return false;
  const data = (example as Record<string, unknown>).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Object.prototype.hasOwnProperty.call(data, 'item')) return false;
  return (data as Record<string, unknown>).item == null;
}

/** 若已保存 Example 含 item:null，用操作预览补全 item 字段 */
export function resolveResponseExample(
  saved: unknown,
  operation?: string,
  entityCode?: string,
  requestParameterInterface?: string,
): unknown {
  if (!hasNullItemInResponseExample(saved)) return saved;
  const preview = buildOperationResponsePreview(operation, entityCode, requestParameterInterface);
  const previewExample = preview?.responseExample;
  if (!previewExample || typeof previewExample !== 'object') return saved;
  const previewData = (previewExample as Record<string, unknown>).data;
  const previewItem = previewData && typeof previewData === 'object' && !Array.isArray(previewData)
    ? (previewData as Record<string, unknown>).item
    : undefined;
  if (previewItem == null) return saved;

  const savedObj = saved as Record<string, unknown>;
  const savedData = savedObj.data && typeof savedObj.data === 'object' && !Array.isArray(savedObj.data)
    ? { ...(savedObj.data as Record<string, unknown>) }
    : {};
  return {
    ...savedObj,
    data: { ...savedData, item: previewItem },
  };
}

export function readResponseOverride(
  securityConfig: Record<string, unknown> | undefined,
  operation?: string,
): ResponseOverrideEntry | null {
  if (!operation) return null;
  const overrides = securityConfig?.responseOverrides as ResponseOverridesMap | undefined;
  const entry = overrides?.[operation];
  return entry && typeof entry === 'object' ? entry : null;
}

export function buildResponseOverridesPayload(
  operation: string,
  responsesSchema: Record<string, unknown>,
  responseExample: unknown,
): ResponseOverridesMap {
  return {
    [operation]: {
      responsesSchema,
      responseExample,
    },
  };
}
