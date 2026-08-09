import type { AIChatPromptItem } from '@eadaf/ai-base';

/**
 * 表单页的欢迎 prompts（展示在 AI 对话区）
 */
export function buildOutboundWebhookFormPrompts(_references: unknown[]): AIChatPromptItem[] {
  return [
    {
      key: 'ow-generate',
      label: 'AI 一键编写请求结构和脚本',
      description: '根据绑定的业务 API，自动生成请求结构、处置脚本和 Mock Data',
    },
    {
      key: 'ow-help',
      label: '提交外部 API 是什么？',
      description: '了解业务 API HOOK 触发外部 API 提交的工作原理',
    },
  ];
}
