import type { ToolInvokeLogEntry } from '@euac/ai-base';
import { setToolInvokeLogger } from '@euac/ai-base';

const DEV_LOG_PATH = '/__dev/ai-tool-log';
const PREVIEW_MAX = 800;

function previewJson(value: unknown, max = PREVIEW_MAX): string {
  if (value === undefined) return '(undefined)';
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return String(value);
  }
}

export function formatToolInvokeLog(entry: ToolInvokeLogEntry): string {
  const icon = entry.success ? '🤖✅' : '🤖❌';
  const sideLabel = entry.side === 'client' ? 'client' : `server/${entry.executionType || 'unknown'}`;
  const lines = [
    `${icon} [${sideLabel}] ${entry.name} (${entry.durationMs}ms)`,
    `  args: ${previewJson(entry.args)}`,
  ];
  if (entry.success) {
    lines.push(`  result: ${previewJson(entry.result)}`);
  } else {
    lines.push(`  error: ${entry.error || 'unknown error'}`);
  }
  return lines.join('\n');
}

function postDevToolLog(entry: ToolInvokeLogEntry, text: string) {
  if (typeof fetch === 'undefined') return;
  void fetch(DEV_LOG_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entry, text }),
  }).catch(() => {
    // dev server 未启动 middleware 时忽略
  });
}

/** 开发环境：Client Tool 日志输出到浏览器控制台，并转发到 Umi dev 终端 */
export function setupAiToolDevLogger() {
  if (process.env.NODE_ENV !== 'development') return;

  if (typeof setToolInvokeLogger !== 'function') {
    // eslint-disable-next-line no-console
    console.warn(
      '[ai-base] setToolInvokeLogger 不可用，Tool 终端日志未启用。请执行 pnpm refresh:ai-base 并重启 dev。',
    );
    return;
  }

  setToolInvokeLogger((entry) => {
    const text = formatToolInvokeLog(entry);
    if (entry.success) {
      // eslint-disable-next-line no-console
      console.info(text);
    } else {
      // eslint-disable-next-line no-console
      console.error(text);
    }
    postDevToolLog(entry, text);
  });
}
