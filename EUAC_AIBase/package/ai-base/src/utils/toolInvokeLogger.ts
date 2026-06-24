export type ToolInvokeSide = 'client' | 'server';

export interface ToolInvokeLogEntry {
  side: ToolInvokeSide;
  name: string;
  args: Record<string, unknown>;
  success: boolean;
  durationMs: number;
  result?: unknown;
  error?: string;
  executionType?: string;
}

export type ToolInvokeLogger = (entry: ToolInvokeLogEntry) => void;

let toolInvokeLogger: ToolInvokeLogger | null = null;

export function setToolInvokeLogger(logger: ToolInvokeLogger | null) {
  toolInvokeLogger = logger;
}

export function logToolInvoke(entry: ToolInvokeLogEntry) {
  toolInvokeLogger?.(entry);
}

export async function withToolInvokeLog<T>(
  side: ToolInvokeSide,
  name: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>,
  meta?: Pick<ToolInvokeLogEntry, 'executionType'>,
): Promise<T> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const result = await fn();
    logToolInvoke({
      side,
      name,
      args,
      success: true,
      durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start),
      result,
      executionType: meta?.executionType,
    });
    return result;
  } catch (error) {
    logToolInvoke({
      side,
      name,
      args,
      success: false,
      durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start),
      error: error instanceof Error ? error.message : String(error),
      executionType: meta?.executionType,
    });
    throw error;
  }
}
