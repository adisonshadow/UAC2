import type { AgentPlugin, AgentToolsApi, FunctionCallDef } from '@eadaf/ai-base';
import { registerToolDisplayNames } from '@eadaf/ai-base';

export interface BusinessPluginPackOptions {
  /** 插件名，建议 `org-domain-ai` */
  name: string;
  /** 业务 Tool 定义（运行时权威 schema + handler） */
  tools?: FunctionCallDef[];
  /** 业务 Tool 语义化展示名（functionName → 中文短标题） */
  toolDisplayNames?: Record<string, string>;
  /**
   * 可选：额外 apply 钩子（注册 Surface、Skill provider 等）。
   * ctx.tools 已由内核提供。
   */
  apply?: (ctx: { tools: AgentToolsApi }) => void;
}

/**
 * 创建业务系统 Agent 插件包（MS5）。
 *
 * @example
 * ```ts
 * export const fmmsAiPack = createBusinessPluginPack({
 *   name: 'fmms-ai-pack',
 *   tools: [{ name: 'fmms_list_workorders', description: '列出工单', parameters: {}, handler: async () => ({}) }],
 *   toolDisplayNames: { fmms_list_workorders: '列出工单' },
 * });
 *
 * <AIChatProvider plugins={[eadafHostToolsPlugin, fmmsAiPack]} applicationId={FMMS_APP_ID} />
 * ```
 */
export function createBusinessPluginPack(options: BusinessPluginPackOptions): AgentPlugin {
  const { name, tools = [], toolDisplayNames, apply: extraApply } = options;
  return {
    name,
    inject: ['tools'],
    apply(ctx) {
      if (tools.length) {
        ctx.tools.registerMany(tools);
      }
      if (toolDisplayNames && Object.keys(toolDisplayNames).length > 0) {
        const disposeNames = registerToolDisplayNames(toolDisplayNames);
        ctx.effect(() => disposeNames);
      }
      if (typeof extraApply === 'function') {
        extraApply(ctx);
      }
    },
  };
}
