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
 * 写/改类工具 → 目标路由。
 *
 * 匹配策略（健壮，不依赖逐个精确名——避免工具改名为 upsert/delete 时漏跳）：
 * 1. 先按「功能域前缀 + 动作词」匹配，命中即跳到该域的入口页；
 * 2. 域内子类（如 aibase 的 provider/model/scope/tool/skill）再按子关键词二级区分；
 * 3. 查询类（list/get/browse/read/status/suggest/run_test/runs/values）不跳，避免查一下就把用户拉走；
 * 4. 自带导航的 *_navigate 工具不在此重复跳转。
 *
 * 动作词：create/update/delete/upsert/publish/disable/execute/insert/validate。
 */
const WRITE_ACTIONS = ['create', 'update', 'delete', 'upsert', 'publish', 'disable', 'execute', 'insert', 'validate'];
const READ_ACTION_RE = /^(list|get|browse|read|status|suggest|run_test|runs|values|resolve_connection)/;

/** 域前缀 → 入口路由（命中即跳，子类覆盖见 domainRoutes 二级判断） */
const DOMAIN_ROUTES: Array<{ test: RegExp; path: string }> = [
  // 业务数据 - 建模（实体/枚举/关系/索引/校验）
  { test: /^bizdata_(create|update|delete|upsert|rename)_?(entity|enum|relation|indexes)|^bizdata_validate_model/, path: '/business_data/model-design' },
  // 业务数据 - 元数据（表/字段）
  { test: /^bizdata_(create|update|delete|upsert)_metadata/, path: '/business_data/metadata' },
  // 业务数据 - 数据标准
  { test: /^bizdata_(create|update|delete|upsert)_data_standard/, path: '/business_data/data-standards' },
  // 业务数据 - 物化执行
  { test: /^bizdata_(execute|preview)_materialization/, path: '/business_data/materialization/execute' },
  // 业务数据 - MOCK 数据 / 物化结果浏览（insert_mock 写入数据，跳库浏览）
  { test: /^bizdata_(insert_mock|browse_materialized)/, path: '/business_data/database' },
  // 业务数据 - 指标（create/update/delete/upsert/execute 共用）
  { test: /^bizdata_metric_(create|update|delete|upsert|execute)/, path: '/business_data/metrics' },
  // API 服务写（工作流页 create/edit/test 由 resolveApiServiceWorkflowToolNavigation 接管，不跳列表）
  { test: /^apiservice_(create|update|delete|publish|disable)/, path: '/api_services/list' },
  // 采集管道写（含 upsert/publish/disable/delete）
  { test: /^collection_pipeline_(create|update|delete|upsert|publish|disable)/, path: '/api_services/collection-pipelines' },
  // 提交外部API写
  { test: /^outbound_webhook_(upsert|delete|publish|disable)/, path: '/api_services/outbound-webhooks' },
  // AI 管理 - 按子类型二级区分
  { test: /^aibase_(create|update|delete)_provider/, path: '/ai_management/providers' },
  { test: /^aibase_(create|update|delete)_model/, path: '/ai_management/models' },
  { test: /^aibase_(create|update)_scope/, path: '/ai_management/scopes' },
  { test: /^aibase_(create|update)_tool/, path: '/ai_management/tools' },
  { test: /^aibase_(create|update)_skill/, path: '/ai_management/skills' },
  // 会员组织 - 按子类型二级区分（权限类暂归 permissions）
  { test: /^uac_(create|update|delete)_user/, path: '/member_org/member' },
  { test: /^uac_(create|update|delete)_role/, path: '/member_org/role' },
  { test: /^uac_(create|update|delete)_(department|organization)/, path: '/member_org/organization' },
  { test: /^uac_(create|update)_(permission|data_rule)/, path: '/permissions/menu' },
];

/** 导航类工具（自带 history.push），不在此重复跳转，避免冲突 */
const NAVIGATION_TOOL_SUFFIX = '_navigate';

/** 取工具名的「动作段」：bizdata_metric_upsert → upsert；apiservice_create_service → create */
function extractAction(name: string): string | undefined {
  // 优先用显式动作词列表扫描，命中第一个
  for (const action of WRITE_ACTIONS) {
    const re = new RegExp(`_(?:${action})(?:_|$)`);
    if (re.test(name)) return action;
  }
  return undefined;
}

function resolveToolNavigationPath(name: string): string | undefined {
  if (name.endsWith(NAVIGATION_TOOL_SUFFIX)) return undefined;
  // 查询类一律不跳
  if (READ_ACTION_RE.test(name)) return undefined;
  // 仅写/改类触发跳转
  if (!extractAction(name)) return undefined;
  return DOMAIN_ROUTES.find((rule) => rule.test.test(name))?.path;
}

/**
 * 工具成功执行后自动跳转到对应页面（仅写/改类工具；查询类与自带导航的 *_navigate 工具不跳）。
 * history 来自全局 navigation ref，任何页面都可用。
 */
function installToolNavigationBridge(): void {
  subscribeToolInvoke((entry) => {
    if (!entry.success) return;

    const workflowNav = resolveApiServiceWorkflowToolNavigation(
      entry.name,
      entry,
      window.location.pathname,
    );
    if (workflowNav !== null) {
      if (workflowNav) history.push(workflowNav);
      return;
    }

    const path = resolveToolNavigationPath(entry.name);
    if (path) history.push(path);
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
  installToolNavigationBridge();
}
