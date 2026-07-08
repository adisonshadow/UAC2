/**
 * AI 助手 UI 展示方式：
 * - sidebar：右侧固定侧边栏，展开时挤压主内容区
 * - float：仅漂浮按钮，面板以浮层打开（不挤压主内容区）
 * - hidden：完全不挂载聊天 UI，DOM 中不存在任何相关节点
 */
export type AIChatDisplayMode = 'sidebar' | 'float' | 'hidden';

export interface AIChatPromptItem {
  key: string;
  description: string;
}

export interface AIChatConfig {
  apiBase?: string;
  scopeSlug?: string;
  /**
   * 当前业务应用系统 ID（应用列表中的 application_id，可选）。
   * 配置后：加载「全局 Skill + 绑定该应用的专用 Skill + fallbackSkillSlugs 本地 Skill」；
   * 未配置：仅加载 fallbackSkillSlugs 指定的本地 Skill。
   */
  applicationId?: string;
  getToken?: () => string | null;
  /** 本地 client 代码显式配置的 Skill slug 列表（如页面 AIChatPageScope 传入） */
  fallbackSkillSlugs?: string[];
  /**
   * 应用顶层 Skill 说明（Markdown）。非空时优先于远端 applicationId 对应内容。
   * 可在 AIChatProvider 或 AIChatPageScope 初始化时直接注入。
   */
  topLevelSkillMarkdown?: string;
  systemPromptPrefix?: string;
  welcome?: { title: string; description: string };
  prompts?: AIChatPromptItem[];
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
  /** 调试：向 LLM 暴露全部已注册 client Tool，忽略 Skill 关联限制 */
  exposeAllClientTools?: boolean;
  /** A2UI 下一步 Action id → 用户消息（点击按钮时发送） */
  nextStepPrompts?: Record<string, string | ((context: Record<string, unknown>) => string)>;
}

export interface ResolvedAIChatConfig {
  apiBase: string;
  scopeSlug?: string;
  applicationId?: string;
  getToken: () => string | null;
  fallbackSkillSlugs: string[];
  topLevelSkillMarkdown: string;
  systemPromptPrefix: string;
  welcome: { title: string; description: string };
  prompts: AIChatPromptItem[];
  panelWidth: number;
  headerOffset: number;
  headerCaption: string;
  defaultOpen: boolean;
  hiddenPaths: string[];
  exposeAllClientTools: boolean;
  nextStepPrompts: Record<string, string | ((context: Record<string, unknown>) => string)>;
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
  inputTags?: string[];
  outputTags?: string[];
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
  /** functionName，与 Skill 关联 Tool 同名时可提供 client 执行实现 */
  name: string;
  description: string;
  parameters: object;
  handler: (args: TArgs) => Promise<TResult>;
}
