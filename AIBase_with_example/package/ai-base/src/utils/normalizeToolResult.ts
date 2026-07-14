import type { ToolResponse, ToolResponseError, ToolResultKind } from '../types/toolResponse';
import { isToolResponse } from '../types/toolResponse';
import { formatToolInvokeError } from './toolInvokeLogger';

const MAX_ERROR_MESSAGE = 120;

function truncateMessage(text: string, max = MAX_ERROR_MESSAGE): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildError(partial: Partial<ToolResponseError> & { message: string }): ToolResponseError {
  return {
    code: partial.code,
    message: truncateMessage(partial.message),
    hint: partial.hint ? truncateMessage(partial.hint, 200) : undefined,
  };
}

function extractVerification(payload: unknown): { verified?: boolean; message?: string } {
  if (!payload || typeof payload !== 'object') return {};
  const row = payload as Record<string, unknown>;
  const verification = row._verification as Record<string, unknown> | undefined;
  if (verification && typeof verification.verified === 'boolean') {
    const message =
      typeof verification.message === 'string'
        ? verification.message
        : typeof row.error === 'string'
          ? row.error
          : undefined;
    return { verified: verification.verified, message };
  }
  if (typeof row.verified === 'boolean') {
    return {
      verified: row.verified,
      message: typeof row.error === 'string' ? row.error : undefined,
    };
  }
  return {};
}

function unwrapMutationData(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const row = raw as Record<string, unknown>;
  if ('data' in row && 'mutation' in row) return row.data;
  return raw;
}

function inferFromPayload(
  payload: unknown,
): Pick<ToolResponse, 'ok' | 'verified' | 'kind' | 'data' | 'error'> {
  if (payload == null) {
    return { ok: true, kind: 'success', data: payload };
  }

  if (typeof payload === 'object') {
    const row = payload as Record<string, unknown>;

    if (typeof row.error === 'string' && row.error.trim()) {
      return {
        ok: false,
        kind: 'business_error',
        error: buildError({ message: row.error }),
      };
    }

    if (row.error && typeof row.error === 'object') {
      const errObj = row.error as Record<string, unknown>;
      const message = typeof errObj.message === 'string' ? errObj.message : '操作失败';
      return {
        ok: false,
        kind: 'business_error',
        error: buildError({
          code: typeof errObj.code === 'string' ? errObj.code : undefined,
          message,
          hint: typeof errObj.hint === 'string' ? errObj.hint : undefined,
        }),
      };
    }

    if (row.success === false) {
      const message =
        typeof row.error === 'string'
          ? row.error
          : typeof row.message === 'string'
            ? row.message
            : '操作未成功';
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({ message }),
      };
    }

    if (row.isValid === false) {
      const errors = Array.isArray(row.errors) ? row.errors.filter(Boolean).join('；') : '';
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({
          code: 'VALIDATION_FAILED',
          message: errors || '校验未通过',
        }),
      };
    }

    const { verified, message: verificationMessage } = extractVerification(row);
    if (verified === false) {
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({
          code: 'VERIFICATION_FAILED',
          message: verificationMessage || '业务校验未通过',
        }),
      };
    }

    if (verified === true) {
      return {
        ok: true,
        verified: true,
        kind: 'success',
        data: payload,
      };
    }

    if (row.success === true && row.verified === false) {
      const message = typeof row.error === 'string' ? row.error : '操作未通过验证';
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({ message }),
      };
    }

    if (row.success === true) {
      return {
        ok: true,
        verified: row.verified === true ? true : undefined,
        kind: 'success',
        data: payload,
      };
    }
  }

  return {
    ok: true,
    kind: 'success',
    data: payload,
  };
}

export interface NormalizeToolResultOptions {
  tool: string;
  rawResult?: unknown;
  thrownError?: unknown;
  durationMs?: number;
  requiresVerification?: boolean;
}

/** 将 handler 原始返回值或异常规范为 ToolResponse 信封 */
export function normalizeToolResult(options: NormalizeToolResultOptions): ToolResponse {
  const { tool, rawResult, thrownError, durationMs, requiresVerification } = options;

  if (thrownError !== undefined) {
    return {
      ok: false,
      kind: 'system_error',
      error: buildError({
        code: 'SYSTEM_ERROR',
        message: formatToolInvokeError(thrownError),
        hint: '请根据错误信息修正参数或重试',
      }),
      meta: { tool, durationMs },
    };
  }

  if (isToolResponse(rawResult)) {
    return {
      ...rawResult,
      meta: { ...rawResult.meta, tool: rawResult.meta.tool || tool, durationMs },
    };
  }

  const unwrapped = unwrapMutationData(rawResult);
  const inferred = inferFromPayload(unwrapped);

  let kind: ToolResultKind = inferred.kind;
  let verified = inferred.verified;
  let error = inferred.error;

  if (requiresVerification && verified !== true) {
    kind = 'business_error';
    verified = false;
    error =
      error ||
      buildError({
        code: 'VERIFICATION_REQUIRED',
        message: '写操作未完成业务校验（verified 不为 true）',
        hint: '请调用校验 Tool 或检查返回数据后再汇报',
      });
  }

  return {
    ok: inferred.ok,
    verified,
    kind,
    data: inferred.data,
    error,
    meta: { tool, durationMs },
  };
}

/** 从信封中提取用于 LLM 的精简视图（超预算时优先保留） */
export function toToolResponseContextView(envelope: ToolResponse): ToolResponse {
  return {
    ok: envelope.ok,
    verified: envelope.verified,
    kind: envelope.kind,
    error: envelope.error,
    meta: envelope.meta,
    data: envelope.data,
  };
}
