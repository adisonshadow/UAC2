import type { FunctionCallDef } from '../types';
import { withToolInvokeLog } from '../utils/toolInvokeLogger';

const registry = new Map<string, FunctionCallDef>();
const listeners = new Set<() => void>();

function notifyRegistryChange() {
  listeners.forEach((listener) => listener());
}

/** 本地 client Tool 注册/注销时订阅，用于刷新可用 Tool 列表 */
export function subscribeFunctionCalls(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerFunctionCall(def: FunctionCallDef): void {
  registry.set(def.name, def);
  notifyRegistryChange();
}

export function unregisterFunctionCall(name: string): void {
  if (registry.delete(name)) {
    notifyRegistryChange();
  }
}

export function getFunctionCallDef(name: string): FunctionCallDef | undefined {
  return registry.get(name);
}

export function getAllFunctionCalls(): FunctionCallDef[] {
  return Array.from(registry.values());
}

export function toOpenAITools(defs: FunctionCallDef[]) {
  return defs.map((def) => ({
    type: 'function' as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  }));
}

export async function invokeFunctionCall(name: string, args: Record<string, unknown>) {
  const def = registry.get(name);
  if (!def) {
    throw new Error(`未注册的 Client Tool: ${name}`);
  }
  return withToolInvokeLog('client', name, args, () => def.handler(args));
}
