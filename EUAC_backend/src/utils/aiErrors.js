const ERROR_CODES = {
  INVALID_REQUEST: { status: 400, code: 'INVALID_REQUEST' },
  CAPABILITY_MISMATCH: { status: 400, code: 'CAPABILITY_MISMATCH' },
  MODEL_NOT_FOUND: { status: 404, code: 'MODEL_NOT_FOUND' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED' },
  UPSTREAM_ERROR: { status: 502, code: 'UPSTREAM_ERROR' },
  TIMEOUT: { status: 504, code: 'TIMEOUT' }
};

class AIBaseError extends Error {
  constructor(code, message, traceId) {
    super(message);
    this.name = 'AIBaseError';
    this.code = code;
    this.traceId = traceId;
    this.httpStatus = ERROR_CODES[code]?.status || 500;
  }
}

function sendAiError(ctx, code, message, traceId) {
  const meta = ERROR_CODES[code] || { status: 500, code: 'INTERNAL_ERROR' };
  ctx.status = meta.status;
  ctx.set('X-Trace-Id', traceId);
  ctx.body = {
    error: {
      code: meta.code,
      message,
      traceId
    }
  };
}

module.exports = {
  ERROR_CODES,
  AIBaseError,
  sendAiError
};
