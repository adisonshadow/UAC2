import type { ToolInvokeLogEntry } from '@eadaf/ai-base';

const LOG_ENABLED =
  process.env.AI_TOOL_LOG_ENABLED === 'true' ||
  (process.env.AI_TOOL_LOG_ENABLED !== 'false' && process.env.NODE_ENV === 'development');

const LOG_ENDPOINT = process.env.AI_TOOL_LOG_ENDPOINT || '/api/v1/ai/tool-invoke-logs';

function shouldPersist(entry: ToolInvokeLogEntry): boolean {
  if (entry.envelope) {
    if (entry.envelope.kind !== 'success') return true;
    if (entry.envelope.verified === false) return true;
    if (entry.envelope.ok === false) return true;
  }
  return !entry.success;
}

/** 失败或未 verified 的 Client Tool 调用 POST 到后端落盘 */
export function postToolInvokeLog(entry: ToolInvokeLogEntry) {
  if (!LOG_ENABLED || !shouldPersist(entry)) return;
  if (typeof fetch === 'undefined') return;

  const token = localStorage.getItem('token');
  void fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      name: entry.name,
      args: entry.args,
      envelope: entry.envelope,
      error: entry.error,
      durationMs: entry.durationMs,
      executionType: entry.executionType,
      conversationKey: entry.conversationKey,
      turnId: entry.turnId,
      round: entry.round,
      result: entry.result,
    }),
  }).catch(() => {
    // 日志失败不影响主流程
  });
}

/** 生产环境：仅注册失败/未验证 POST 日志（无控制台输出） */
export function setupAiToolInvokeFileLogger() {
  if (!LOG_ENABLED || process.env.NODE_ENV === 'development') return;

  import('@eadaf/ai-base').then(({ setToolInvokeLogger }) => {
    if (typeof setToolInvokeLogger !== 'function') return;
    setToolInvokeLogger((entry) => {
      postToolInvokeLog(entry);
    });
  });
}
