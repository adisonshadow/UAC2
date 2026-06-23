import type { AIChatConfig, ResolvedAIChatConfig } from '../types';

const DEFAULT_SYSTEM_PROMPT_PREFIX =
  '你是 EUAC 销售管理系统 Demo 的 AI 助手，已接入后端 SQLite 业务库与 Tool。\n' +
  '遇到订单、投诉、统计类问题，必须先调用 Tool 获取数据再回答，禁止说无法访问数据库或 CRM。';

const DEFAULT_WELCOME = {
  title: '你好，我是 AI 助手',
  description: '我会根据你的任务自动选择合适的 Skill 与工具，直接描述需求即可。',
};

const DEFAULT_PROMPTS = [
  { key: '1', description: '查询订单 SO202501001 的详情' },
  { key: '2', description: '统计各状态订单数量和金额' },
  { key: '3', description: '近 30 天订单趋势' },
  { key: '4', description: '列出所有 open 状态的投诉' },
  { key: '5', description: '按类型统计投诉分布' },
];

const defaultGetToken = () => localStorage.getItem('token');

export function resolveConfig(config: AIChatConfig = {}): ResolvedAIChatConfig {
  return {
    apiBase: config.apiBase || '/api',
    scopeSlug: config.scopeSlug,
    getToken: config.getToken || defaultGetToken,
    fallbackSkillSlugs: config.fallbackSkillSlugs || ['order-analysis', 'after-sales-analysis'],
    systemPromptPrefix: config.systemPromptPrefix || DEFAULT_SYSTEM_PROMPT_PREFIX,
    welcome: config.welcome || DEFAULT_WELCOME,
    prompts: config.prompts || DEFAULT_PROMPTS,
    panelWidth: config.panelWidth ?? 420,
    headerOffset: config.headerOffset ?? 64,
    headerCaption: config.headerCaption ?? 'AI 助手',
    defaultOpen: config.defaultOpen ?? true,
    hiddenPaths: config.hiddenPaths ?? [],
  };
}
