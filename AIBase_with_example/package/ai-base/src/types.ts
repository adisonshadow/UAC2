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
  /**
   * 单次 Tool 结果回灌上下文时的字符预算上限（全局默认值）。
   * 单个 Tool 可通过 resultBudget.maxChars 覆盖此默认。
   * 默认 8000 字符。
   */
  maxToolResultChars?: number;
  /**
   * 续接循环（tool-round / auto-continue）每轮 LLM 请求之间的最小间隔（毫秒）。
   * 防止单次用户消息内密集连发请求打穿上游 Provider 的突发保护。
   * 默认 600ms；对 DeepSeek 等容忍较高的 Provider 可设为 0 关闭节流。
   */
  roundDelayMs?: number;
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
  /** 单次 Tool 结果回灌上下文时的字符预算上限（全局默认值） */
  maxToolResultChars: number;
  /** 续接循环每轮 LLM 请求之间的最小间隔（毫秒），默认 600 */
  roundDelayMs: number;
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
  /**
   * 是否允许本地同名 client Tool handler 覆盖 server 类型（server_http/server_builtin）的执行。
   * 默认 false：按 executionType 声明分派，本地同名 def 不再隐式拦截 server 工具。
   * 显式 true 时，本地存在同名 def 则改由本地执行。
   */
  allowClientOverride?: boolean;
  /** 该 Tool 结果回灌上下文时的字符预算（覆盖 AIChatConfig.maxToolResultChars） */
  resultBudget?: { maxChars: number };
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
  /**
   * 声明式 auto-continue 策略（取代 SDK 内硬编码的业务判定）。
   * 可由后端 Skill 元数据下发，也可由前端 registerSkillCompletionPolicy 覆盖。
   */
  completionStrategy?: SkillCompletionStrategy;
}

/**
 * Skill 完成策略 —— 声明式驱动 auto-continue，取代 SDK 内硬编码的业务正则与工具名集合。
 * 由业务方（而非 SDK）声明：哪些 Tool 必须调用、什么文本算任务完成、是否连续执行。
 */
export interface SkillCompletionStrategy {
  /** 必须全部调用过才算完成的关键 Tool functionName 列表 */
  requiredTools?: string[];
  /** 文本中出现这些关键词时视为「任务完成」，停止 auto-continue */
  completionKeywords?: string[];
  /** 文本中出现这些关键词时禁止 auto-continue（如收尾建议句） */
  blockKeywords?: string[];
  /** 连续执行型 Skill（如 test-fix 循环），不受「一次一事」限制 */
  continuousExecution?: boolean;
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
  /** 该 Tool 结果回灌上下文时的字符预算（覆盖 AIChatConfig.maxToolResultChars） */
  resultBudget?: { maxChars: number };
}
