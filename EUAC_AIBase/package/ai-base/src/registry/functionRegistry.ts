import type { FunctionCallDef } from '../types';

const registry = new Map<string, FunctionCallDef>();

export function registerFunctionCall(def: FunctionCallDef): void {
  registry.set(def.name, def);
}

export function unregisterFunctionCall(name: string): void {
  registry.delete(name);
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
  return def.handler(args);
}
