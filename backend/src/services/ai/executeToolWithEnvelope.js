const { logToolInvoke, formatToolInvokeError } = require('../../utils/aiToolLogger');
const { logAiToolInvokeFailure } = require('./aiToolInvokeLogService');
const { normalizeToolResult } = require('../../utils/normalizeToolResult');

async function executeToolWithEnvelope({
  name,
  args,
  executionType,
  requiresVerification,
  fn,
  logContext = {},
}) {
  const start = Date.now();
  try {
    const rawResult = await fn();
    const durationMs = Date.now() - start;
    const envelope = normalizeToolResult({
      tool: name,
      rawResult,
      durationMs,
      requiresVerification,
    });

    logToolInvoke({
      success: envelope.ok && envelope.kind !== 'system_error',
      name,
      args,
      durationMs,
      result: rawResult,
      executionType,
      envelope: {
        ok: envelope.ok,
        verified: envelope.verified,
        kind: envelope.kind,
        error: envelope.error,
      },
    });

    if (envelope.kind !== 'success' || envelope.verified === false || envelope.ok === false) {
      logAiToolInvokeFailure({
        ...logContext,
        tool: name,
        args,
        envelope,
        rawResult,
        executionType,
        durationMs,
      });
    }

    return envelope;
  } catch (error) {
    const durationMs = Date.now() - start;
    const envelope = normalizeToolResult({
      tool: name,
      thrownError: error,
      durationMs,
      requiresVerification,
    });

    logToolInvoke({
      success: false,
      name,
      args,
      durationMs,
      error: formatToolInvokeError(error),
      executionType,
      envelope: {
        ok: envelope.ok,
        verified: envelope.verified,
        kind: envelope.kind,
        error: envelope.error,
      },
    });

    logAiToolInvokeFailure({
      ...logContext,
      tool: name,
      args,
      envelope,
      error: formatToolInvokeError(error),
      executionType,
      durationMs,
    });

    return envelope;
  }
}

module.exports = {
  executeToolWithEnvelope,
};
