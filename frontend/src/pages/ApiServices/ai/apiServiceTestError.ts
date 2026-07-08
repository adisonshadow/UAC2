import { getApiErrorMessage } from '@/utils/apiResponse';

type ValidationIssue = { path?: string; message?: string };

function readValidationErrors(source: unknown): ValidationIssue[] | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const record = source as Record<string, unknown>;
  const nested = record.data;
  const fromNested =
    nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>).validationErrors
      : undefined;
  const direct = record.validationErrors;
  const issues = (fromNested ?? direct) as ValidationIssue[] | undefined;
  return Array.isArray(issues) && issues.length ? issues : undefined;
}

/** 从 axios 异常或 API 响应体提取校验错误 */
export function extractApiServiceValidationErrors(source: unknown): ValidationIssue[] | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const err = source as { response?: { data?: unknown } };
  return readValidationErrors(err.response?.data) ?? readValidationErrors(source);
}

/** 格式化测试失败信息（含校验明细） */
export function formatApiServiceTestError(source: unknown, fallback = '测试请求失败'): string {
  const message = getApiErrorMessage(source, fallback);
  const issues = extractApiServiceValidationErrors(source);
  if (!issues?.length) return message;
  const detail = issues
    .map((item) => `${item.path || '(root)'}: ${item.message || '校验失败'}`)
    .join('；');
  return `${message}${detail ? `（${detail}）` : ''}`;
}

/** 判断测试结果是否应视为失败（用于 UI 与 AI 上下文） */
export function isApiServiceTestFailure(
  result: API.ApiServiceTestResult | null | undefined,
  httpError?: unknown,
): boolean {
  if (httpError) return true;
  if (!result) return false;
  if (result.executable === false && result.executableReason) return true;
  if (Array.isArray(result.validationErrors) && result.validationErrors.length > 0) return true;
  return false;
}

export function describeApiServiceTestFailure(
  result: API.ApiServiceTestResult | null | undefined,
  httpError?: unknown,
): string | null {
  if (httpError) return formatApiServiceTestError(httpError);
  if (!result) return null;
  if (result.executable === false && result.executableReason) {
    return result.executableReason;
  }
  if (Array.isArray(result.validationErrors) && result.validationErrors.length) {
    return result.validationErrors
      .map((item) => `${item.path || '(root)'}: ${item.message || '校验失败'}`)
      .join('；');
  }
  return null;
}
