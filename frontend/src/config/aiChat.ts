import type { AIChatConfig } from '@EADAF/ai-base';

/** 全站 Tool 成功汇报硬约束；页面 systemPromptPrefix 覆盖根配置时须自行拼接本段 */
export const AI_CHAT_TOOL_VERIFICATION_RULES = [
  '## Tool 结果汇报（硬约束）',
  '- 写操作（创建/更新/删除/执行/发布）**禁止**在未调用 Tool，或 Tool 信封中 `verified !== true` / `kind !== success` 时向用户声称成功',
  '- 必须以最近一次相关 Tool 返回的 `ok`、`verified`、`kind`、`error.message`、`_verification` 为准；禁止编造 id、code、lastValue、卡片数量',
  '- Tool 返回 `business_error` 或 `verified: false` 时，向用户说明失败原因（引用 error.message），不要脑补成功',
  '- 「列出已有数据」≠「创建成功」；创建后必须看到写操作 Tool 的 `verified: true`，必要时再 list/get/dashboard 回读',
].join('\n');

const AI_CHAT_SYSTEM_PROMPT_PREFIX = [
  '你是 EADAF 的 AI 助手，已接入后端 API、Skill 与 Tool。',
  '涉及成员组织、权限、业务数据、物化状态等可查询信息时，必须先调用 Tool 获取数据再回答，禁止编造或声称无法访问系统。',
  '若当前页面有专属助手（如业务数据模型设计/物化），优先遵循页面上下文与用户添加的引用内容。',
  '',
  AI_CHAT_TOOL_VERIFICATION_RULES,
].join('\n');

const AI_CHAT_WELCOME = {
  title: 'Hi，我是您的AI助手',
  description:
    '我会根据你的任务自动选择合适的专家技能与工具，直接描述需求即可，也可点击下方的快捷提示。',
};

const AI_CHAT_PROMPTS = [
  { key: '1', description: '了解一下我可以帮你做什么' },
  { key: '2', description: '当前系统配置了哪些 AI 技能与工具？' },
  { key: '3', description: '成员与组织有哪些常用操作？' },
  { key: '4', description: '业务数据模块能做什么？' },
];

export function createAIChatConfig(
  getToken: NonNullable<AIChatConfig['getToken']>,
): AIChatConfig {
  return {
    apiBase: '/api',
    getToken,
    headerOffset: 64,
    hiddenPaths: ['/auth/login', '/auth/reset-password', '/account/center'],
    systemPromptPrefix: AI_CHAT_SYSTEM_PROMPT_PREFIX,
    welcome: AI_CHAT_WELCOME,
    prompts: AI_CHAT_PROMPTS,
    applicationId: '10000000-0000-4000-8000-000000000002',
    // topLevelSkillMarkdown: '本应用 Skill 使用说明…', // 开发期硬编码注入，覆盖 DB
  };
}
