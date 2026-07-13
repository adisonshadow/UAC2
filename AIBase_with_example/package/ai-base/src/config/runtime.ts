import type { AIChatConfig, ResolvedAIChatConfig } from '../types';

const DEFAULT_SYSTEM_PROMPT_PREFIX =
  '你是 企业数据底座的 AI 助手，已接入各类数据服务与Tool。\n' +
  '遇到统计类问题，必须先调用 Tool 获取数据再回答。';

const DEFAULT_WELCOME = {
  title: '我是您的AI助手',
  description: '我会根据你的任务自动选择合适的专家技能与工具，直接描述需求即可。',
};

const DEFAULT_PROMPTS = [
  { key: '1', description: '了解一下我可以做什么' },
];

const defaultGetToken = () => localStorage.getItem('token');

export function resolveConfig(config: AIChatConfig = {}): ResolvedAIChatConfig {
  return {
    apiBase: config.apiBase || '/api',
    scopeSlug: config.scopeSlug,
    applicationId: config.applicationId,
    getToken: config.getToken || defaultGetToken,
    fallbackSkillSlugs: config.fallbackSkillSlugs ?? [],
    topLevelSkillMarkdown: config.topLevelSkillMarkdown ?? '',
    systemPromptPrefix: config.systemPromptPrefix || DEFAULT_SYSTEM_PROMPT_PREFIX,
    welcome: config.welcome || DEFAULT_WELCOME,
    prompts: config.prompts || DEFAULT_PROMPTS,
    panelWidth: config.panelWidth ?? 420,
    headerOffset: config.headerOffset ?? 64,
    headerCaption: config.headerCaption ?? 'AI 助手',
    defaultOpen: config.defaultOpen ?? true,
    hiddenPaths: config.hiddenPaths ?? [],
    exposeAllClientTools: config.exposeAllClientTools ?? false,
    nextStepPrompts: config.nextStepPrompts ?? {},
    maxToolResultChars: config.maxToolResultChars ?? 8000,
    roundDelayMs: config.roundDelayMs ?? 600,
  };
}
