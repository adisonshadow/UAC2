const { formatToolInvokeError } = require('./aiToolLogger');

const MAX_ERROR_MESSAGE = 120;

function truncateMessage(text, max = MAX_ERROR_MESSAGE) {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildError(partial) {
  return {
    code: partial.code,
    message: truncateMessage(partial.message),
    hint: partial.hint ? truncateMessage(partial.hint, 200) : undefined,
  };
}

function isToolResponse(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.ok === 'boolean' &&
    typeof value.kind === 'string' &&
    value.meta &&
    typeof value.meta.tool === 'string'
  );
}

function extractVerification(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const verification = payload._verification;
  if (verification && typeof verification.verified === 'boolean') {
    return {
      verified: verification.verified,
      message: verification.message || (typeof payload.error === 'string' ? payload.error : undefined),
    };
  }
  if (typeof payload.verified === 'boolean') {
    return {
      verified: payload.verified,
      message: typeof payload.error === 'string' ? payload.error : undefined,
    };
  }
  return {};
}

function unwrapMutationData(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if ('data' in raw && 'mutation' in raw) return raw.data;
  if (raw.result !== undefined && raw.executionType !== undefined) return raw.result;
  return raw;
}

function inferFromPayload(payload) {
  if (payload == null) {
    return { ok: true, kind: 'success', data: payload };
  }

  if (typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return {
        ok: false,
        kind: 'business_error',
        error: buildError({ message: payload.error }),
      };
    }

    if (payload.success === false) {
      const message =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.message === 'string'
            ? payload.message
            : '操作未成功';
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({ message }),
      };
    }

    if (payload.isValid === false) {
      const errors = Array.isArray(payload.errors) ? payload.errors.filter(Boolean).join('；') : '';
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

    const { verified, message: verificationMessage } = extractVerification(payload);
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

    if (payload.executed === false) {
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({ message: '物化未执行成功' }),
      };
    }

    if (payload.success === true && payload.verified === false) {
      return {
        ok: true,
        verified: false,
        kind: 'business_error',
        data: payload,
        error: buildError({
          message: typeof payload.error === 'string' ? payload.error : '操作未通过验证',
        }),
      };
    }

    if (payload.success === true) {
      return {
        ok: true,
        verified: payload.verified === true ? true : undefined,
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

function normalizeToolResult({ tool, rawResult, thrownError, durationMs, requiresVerification }) {
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

  let kind = inferred.kind;
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

module.exports = {
  normalizeToolResult,
  isToolResponse,
};
