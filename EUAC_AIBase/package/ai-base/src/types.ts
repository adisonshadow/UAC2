/**
 * AI 助手 UI 展示方式：
 * - sidebar：右侧固定侧边栏，展开时挤压主内容区
 * - float：仅漂浮按钮，面板以浮层打开（不挤压主内容区）
 * - hidden：完全不挂载聊天 UI，DOM 中不存在任何相关节点
 */
export type AIChatDisplayMode = 'sidebar' | 'float' | 'hidden';

export interface AIChatConfig {
  apiBase?: string;
  scopeSlug?: string;
  getToken?: () => string | null;
  fallbackSkillSlugs?: string[];
  systemPromptPrefix?: string;
  welcome?: { title: string; description: string };
  prompts?: Array<{ key: string; description: string }>;
  panelWidth?: number;
  headerOffset?: number;
  /** 聊天面板标题栏文案，默认「AI 助手」 */
  headerCaption?: string;
  defaultOpen?: boolean;
  /**
   * 与路由层 `AIChatDisplay mode="hidden"` 配合：首屏同步判断（路由懒加载前 wrapper 尚未挂载时避免闪烁）。
   * 应与使用 AIChatHidden wrapper 的路径保持一致。
   */
  hiddenPaths?: string[];
}

export interface ResolvedAIChatConfig {
  apiBase: string;
  scopeSlug?: string;
  getToken: () => string | null;
  fallbackSkillSlugs: string[];
  systemPromptPrefix: string;
  welcome: { title: string; description: string };
  prompts: Array<{ key: string; description: string }>;
  panelWidth: number;
  headerOffset: number;
  headerCaption: string;
  defaultOpen: boolean;
  hiddenPaths: string[];
}

export interface AIBaseScope {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface AIBaseTool {
  id: string;
  name: string;
  slug: string;
  functionName: string;
  description?: string;
  executionType: 'client' | 'server_http' | 'server_builtin';
  parametersSchema?: Record<string, unknown>;
  reviewMarkdown?: string;
  openaiTool?: OpenAIToolDefinition;
}

export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface AIBaseSkill {
  id: string;
  name: string;
  slug: string;
  description?: string;
  contentMarkdown: string;
  scopeId?: string | null;
  scopeSlug?: string | null;
  tools?: AIBaseTool[];
  openaiTools?: OpenAIToolDefinition[];
}

export interface AIBaseModelInfo {
  slug: string;
  displayName: string;
  capabilities?: string[];
}

export interface AIBaseClientOptions {
  baseUrl?: string;
  getToken?: () => string | null;
}

export interface ToolInvokeResult {
  executionType?: string;
  result?: unknown;
  message?: string;
}

export interface FunctionCallDef<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: object;
  handler: (args: TArgs) => Promise<TResult>;
}
