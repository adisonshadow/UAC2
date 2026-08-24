import {
  getAllFunctionCalls,
  getFunctionCallDef,
} from '../registry/functionRegistry';
import {
  ensureFunctionRegistryContractSource,
  resolveVisibleContracts,
  type ToolContract,
} from '../registry/toolContractRegistry';

/**
 * native / run_code / run_subagent 同源可见集：
 * 当前回合授权名 ∩ 已注册 client Tool（有 functionRegistry handler）。
 *
 * 不把仅授权、无法在浏览器沙箱 invoke 的 server_builtin（如 http_request）列进 tools.list()。
 * 授权集为空时：回退为「全部已注册 client Tool」（调试 / 无 Skill 闸门场景）。
 */
export function resolveRunnableClientToolNames(
  authorizedNames?: Iterable<string> | Set<string> | null,
): { toolNames: string[]; contracts: ToolContract[] } {
  ensureFunctionRegistryContractSource();

  const authorized = authorizedNames
    ? Array.from(authorizedNames)
        .map((n) => String(n || '').trim())
        .filter(Boolean)
    : [];

  const hasAuthGate = authorized.length > 0;

  if (!hasAuthGate) {
    const all = getAllFunctionCalls().filter((d) => Boolean(d.name));
    const toolNames = all.map((d) => d.name).sort();
    const contracts = mergeContractsWithHandlers(toolNames);
    return { toolNames, contracts };
  }

  // 授权 ∩ 已注册 handler（排除 http_request 等仅 server 的名）
  const runnableAuthorized = authorized.filter((name) => Boolean(getFunctionCallDef(name)));
  const toolNames = Array.from(new Set(runnableAuthorized)).sort();
  const contracts = mergeContractsWithHandlers(toolNames);
  return { toolNames, contracts };
}

function mergeContractsWithHandlers(toolNames: string[]): ToolContract[] {
  const fromRegistry = resolveVisibleContracts(toolNames);
  const byName = new Map(fromRegistry.map((c) => [c.name, c]));
  for (const name of toolNames) {
    if (byName.has(name)) continue;
    const def = getFunctionCallDef(name);
    if (!def) continue;
    byName.set(name, {
      name,
      description: def.description || name,
      parameters: (def.parameters && typeof def.parameters === 'object'
        ? def.parameters
        : { type: 'object', properties: {} }) as Record<string, unknown>,
      sourceId: 'function-registry',
    });
  }
  return Array.from(byName.values());
}

/** 断言 tool 在当前授权 ∩ 已注册 client 集合内 */
export function assertRunnableClientTool(
  name: string,
  authorizedNames?: Iterable<string> | Set<string> | null,
): void {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('tool 名不能为空');
  }
  const { toolNames } = resolveRunnableClientToolNames(authorizedNames);
  if (!toolNames.includes(trimmed)) {
    throw new Error(
      `未授权或不在可编排 client Tool 内: ${trimmed}。请直接 native 调用业务 Tool，禁止用 subagent 绕过 Skill 授权。`,
    );
  }
  if (!getFunctionCallDef(trimmed)) {
    throw new Error(`未注册的 client Tool: ${trimmed}`);
  }
}
