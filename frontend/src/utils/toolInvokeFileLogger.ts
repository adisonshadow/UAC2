import type { ToolInvokeLogEntry } from '@eadaf/ai-base';

/** 显式 opt-in：仅 AI_TOOL_LOG_ENABLED=true 时 POST（开发态默认不打，避免代理 502 刷屏） */
const LOG_ENABLED = process.env.AI_TOOL_LOG_ENABLED === 'true';

const LOG_ENDPOINT = process.env.AI_TOOL_LOG_ENDPOINT || '/api/v1/ai/tool-invoke-logs';
const LOG_TIMEOUT_MS = 2000;
const PREVIEW_MAX_CHARS = 2000;

function shouldPersist(entry: ToolInvokeLogEntry): boolean {
  if (entry.envelope) {
    if (entry.envelope.kind !== 'success') return true;
    if (entry.envelope.verified === false) return true;
    if (entry.envelope.ok === false) return true;
  }
  return !entry.success;
}

function previewValue(value: unknown, max = PREVIEW_MAX_CHARS): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
  try {
    const text = JSON.stringify(value);
    if (text.length <= max) return value;
    return { _truncated: true, preview: `${text.slice(0, max)}…` };
  } catch {
    return String(value).slice(0, max);
  }
}

/** 失败或未 verified 的 Client Tool 调用 POST 到后端落盘（需 AI_TOOL_LOG_ENABLED=true） */
export function postToolInvokeLog(entry: ToolInvokeLogEntry) {
  if (!LOG_ENABLED || !shouldPersist(entry)) return;
  if (typeof fetch === 'undefined') return;

  const token = localStorage.getItem('token');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOG_TIMEOUT_MS);

  void fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: controller.signal,
    body: JSON.stringify({
      name: entry.name,
      args: previewValue(entry.args),
      envelope: entry.envelope,
      error: entry.error,
      durationMs: entry.durationMs,
      executionType: entry.executionType,
      conversationKey: entry.conversationKey,
      turnId: entry.turnId,
      round: entry.round,
      result: previewValue(entry.result),
    }),
  })
    .catch(() => {
      // 日志失败不影响主流程
    })
    .finally(() => {
      clearTimeout(timer);
    });
}

/** 生产环境：仅注册失败/未验证 POST 日志（无控制台输出）；需 AI_TOOL_LOG_ENABLED=true */
export function setupAiToolInvokeFileLogger() {
  if (!LOG_ENABLED || process.env.NODE_ENV === 'development') return;

  import('@eadaf/ai-base').then(({ setToolInvokeLogger }) => {
    if (typeof setToolInvokeLogger !== 'function') return;
    setToolInvokeLogger((entry) => {
      postToolInvokeLog(entry);
    });
  });
}
