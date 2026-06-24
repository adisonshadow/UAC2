import { AIChatPageScope, useAIChatDisplayMode } from '@euac/ai-base';
import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { registerBizDataTools, unregisterBizDataTools } from '@/pages/BusinessData/ai/registerBizDataTools';

export default function BusinessDataDesignAI() {
  useAIChatDisplayMode('sidebar');

  useEffect(() => {
    registerBizDataTools();
    return () => unregisterBizDataTools();
  }, []);

  return (
    <AIChatPageScope
      scopeSlug="business-data"
      fallbackSkillSlugs={['bizdata-model-design']}
      headerCaption="模型设计助手"
      systemPromptPrefix="你是 EUAC 业务数据建模助手，帮助用户设计 Scope:Entity 层级模型。"
      welcome={{
        title: '业务数据模型设计',
        description: '描述你要创建的实体、字段或关系，我会调用工具帮你完成建模。',
      }}
      prompts={[
        { key: '1', description: '列出当前所有业务实体' },
        { key: '2', description: '创建一个 sales:order:Order 订单实体' },
        { key: '3', description: '为 Order 实体添加 status 和 amount 字段' },
      ]}
    >
      <Outlet />
    </AIChatPageScope>
  );
}
