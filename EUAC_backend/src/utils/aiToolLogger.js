/**
 * AI Tool 执行日志：输出到 EUAC_backend 终端
 */

const PREVIEW_MAX = 800;

function previewJson(value, max = PREVIEW_MAX) {
  if (value === undefined) return '(undefined)';
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return String(value);
  }
}

function formatToolInvokeLog({ success, name, args, durationMs, result, error, executionType }) {
  const icon = success ? '🤖✅' : '🤖❌';
  const sideLabel = executionType ? `server/${executionType}` : 'server';
  const lines = [
    `${icon} [${sideLabel}] ${name} (${durationMs}ms)`,
    `  args: ${previewJson(args)}`,
  ];
  if (success) {
    lines.push(`  result: ${previewJson(result)}`);
  } else {
    lines.push(`  error: ${error || 'unknown error'}`);
  }
  return lines.join('\n');
}

function logToolInvoke(entry) {
  // eslint-disable-next-line no-console
  console.log(formatToolInvokeLog(entry));
}

async function withToolInvokeLog(name, args, executionType, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    logToolInvoke({
      success: true,
      name,
      args,
      durationMs: Date.now() - start,
      result,
      executionType,
    });
    return result;
  } catch (error) {
    logToolInvoke({
      success: false,
      name,
      args,
      durationMs: Date.now() - start,
      error: error.message || String(error),
      executionType,
    });
    throw error;
  }
}

module.exports = {
  logToolInvoke,
  withToolInvokeLog,
  formatToolInvokeLog,
};
