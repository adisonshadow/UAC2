import type { AIMutation, ToolMutationResult } from '@eadaf/ai-base';
import { emitAIMutation, getAllAISurfaces, subscribeAIMutation, subscribeToolInvoke } from '@eadaf/ai-base';
import { resolveApiServiceWorkflowToolNavigation } from '@/pages/ApiServices/ai/apiServiceWorkflowNavigation';
import { history } from '@/utils/navigation';

export interface MutatingHandlerOptions<TArgs, TData> {
  domain: string;
  type: string | ((args: TArgs, data: TData) => string);
  scope?: string | ((args: TArgs, data: TData) => string | undefined);
  buildResourceId?: (args: TArgs, data: TData) => string | undefined;
  buildPayload?: (args: TArgs, data: TData) => unknown;
  handler: (args: TArgs) => Promise<TData>;
}

/** 包装 Tool handler：成功后附加标准 mutation 元数据 */
export function createMutatingHandler<TArgs extends Record<string, unknown>, TData>(
  options: MutatingHandlerOptions<TArgs, TData>,
): (args: Record<string, unknown>) => Promise<ToolMutationResult<TData>> {
  const { domain, type, scope, buildResourceId, buildPayload, handler } = options;

  return async (args) => {
    const typedArgs = args as TArgs;
    const data = await handler(typedArgs);
    const mutationType = typeof type === 'function' ? type(typedArgs, data) : type;
    const mutation: AIMutation = {
      domain,
      type: mutationType,
      resourceId: buildResourceId?.(typedArgs, data),
      payload: buildPayload ? buildPayload(typedArgs, data) : data,
      scope: typeof scope === 'function' ? scope(typedArgs, data) : scope,
    };
    return { data, mutation };
  };
}

async function routeMutationToSurfaces(mutation: AIMutation): Promise<void> {
  const surfaces = getAllAISurfaces();
  const domainSurfaces = surfaces.filter((surface) => surface.domain === mutation.domain);
  const candidates = mutation.scope
    ? domainSurfaces.filter(
        (surface) =>
          surface.id === mutation.scope ||
          (surface.matchMutation?.(mutation) ?? false),
      )
    : domainSurfaces;

  const matched = candidates.filter(
    (surface) => !surface.matchMutation || surface.matchMutation(mutation),
  );
  if (!matched.length) return;

  let anyApplied = false;
  for (const surface of matched) {
    if (surface.applyMutation) {
      await surface.applyMutation(mutation);
      anyApplied = true;
    }
  }

  if (!anyApplied) {
    for (const surface of matched) {
      if (surface.refresh) {
        await surface.refresh();
      }
    }
  }
}

let routerInstalled = false;

const SERVER_TOOL_MUTATION_MAP: Record<string, AIMutation> = {
  bizdata_execute_materialization: {
    domain: 'bizdata',
    type: 'materialization.executed',
    scope: 'bizdata.materialization.execute',
  },
  bizdata_preview_materialization: {
    domain: 'bizdata',
    type: 'materialization.previewed',
    scope: 'bizdata.materialization.execute',
  },
  bizdata_insert_mock_data: {
    domain: 'bizdata',
    type: 'materialization.mock_data.inserted',
    scope: 'bizdata.materialization.browse',
  },
};

function emitMaterializationMutations() {
  emitAIMutation({
    domain: 'bizdata',
    type: 'materialization.executed',
    scope: 'bizdata.database.status',
  });
}

function installServerToolMutationBridge(): void {
  subscribeToolInvoke((entry) => {
    if (!entry.success) return;
    const result = entry.result;
    if (result && typeof result === 'object' && 'mutation' in (result as object)) return;
    const mapped = SERVER_TOOL_MUTATION_MAP[entry.name];
    if (mapped) {
      emitAIMutation(mapped);
      if (entry.name === 'bizdata_execute_materialization') {
        emitMaterializationMutations();
      }
    }
  });
}

/**
 * ApiServices 工作流页内导航（自旧硬跳桥剥离的独立订阅，逻辑不变，见 D2）。
 * 仅在工作流页（创建/编辑/测试）处理 apiservice_* 写工具；非工作流页返回 null 不干预。
 */
function installApiServiceWorkflowNavigation(): void {
  subscribeToolInvoke((entry) => {
    if (!entry.success) return;

    const workflowNav = resolveApiServiceWorkflowToolNavigation(
      entry.name,
      entry,
      window.location.pathname,
    );
    if (workflowNav !== null) {
      if (workflowNav) history.push(workflowNav);
    }
  });
}

/** App 启动时安装 mutation 路由（按 domain 分发到已注册 Surface） */
export function setupAIMutationRouter(): void {
  if (routerInstalled) return;
  routerInstalled = true;

  subscribeAIMutation((mutation) => {
    void routeMutationToSurfaces(mutation);
  });

  installServerToolMutationBridge();
  installApiServiceWorkflowNavigation();
}
