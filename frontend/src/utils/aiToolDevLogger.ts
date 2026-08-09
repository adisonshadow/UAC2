import type { ToolInvokeLogEntry } from '@eadaf/ai-base';
import { postToolInvokeLog } from './toolInvokeFileLogger';

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
  const failed =
    !entry.success ||
    entry.envelope?.kind === 'business_error' ||
    entry.envelope?.kind === 'system_error' ||
    entry.envelope?.verified === false;
  const icon = failed ? '🤖❌' : '🤖✅';
  const sideLabel = entry.side === 'client' ? 'client' : `server/${entry.executionType || 'unknown'}`;
  const lines = [
    `${icon} [${sideLabel}] ${entry.name} (${entry.durationMs}ms)`,
    `  args: ${previewJson(entry.args)}`,
  ];
  if (entry.envelope) {
    lines.push(`  envelope: ${previewJson(entry.envelope)}`);
  }
  if (entry.success && !failed) {
    lines.push(`  result: ${previewJson(entry.result)}`);
  } else {
    lines.push(`  error: ${entry.error || entry.envelope?.error?.message || 'unknown error'}`);
  }
  return lines.join('\n');
}

/** 开发环境：Client Tool 日志输出到浏览器控制台，失败/未验证时 POST 到后端 */
export function setupAiToolDevLogger() {
  if (process.env.NODE_ENV !== 'development') return;

  import('@eadaf/ai-base').then(({ setToolInvokeLogger }) => {
    if (typeof setToolInvokeLogger !== 'function') {
      // eslint-disable-next-line no-console
      console.warn(
        '[ai-base] setToolInvokeLogger 不可用，Tool 终端日志未启用。请执行 pnpm refresh:ai-base 并重启 dev。',
      );
      return;
    }

    setToolInvokeLogger((entry) => {
      const text = formatToolInvokeLog(entry);
      const failed =
        !entry.success ||
        entry.envelope?.kind !== 'success' ||
        entry.envelope?.verified === false;
      if (failed) {
        // eslint-disable-next-line no-console
        console.error(text);
      } else {
        // eslint-disable-next-line no-console
        console.info(text);
      }
      postToolInvokeLog(entry);
    });
  });
}
