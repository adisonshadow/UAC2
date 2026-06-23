import { AIChatPageScope, useAIChatDisplayMode } from '@euac/ai-base';
import { Outlet } from '@umijs/max';
import { useEffect } from 'react';
import { registerBizDataTools, unregisterBizDataTools } from '@/pages/BusinessData/ai/registerBizDataTools';

export default function BusinessDataMaterializeAI() {
  useAIChatDisplayMode('sidebar');

  useEffect(() => {
    registerBizDataTools();
    return () => unregisterBizDataTools();
  }, []);

  return (
    <AIChatPageScope
      scopeSlug="business-data"
      fallbackSkillSlugs={['bizdata-materialization']}
      headerCaption="数据物化助手"
      systemPromptPrefix="你是 EUAC 数据物化助手，帮助预览 SQL、执行物化并解释版本差异。"
      welcome={{
        title: '数据物化',
        description: '我可以帮你查看物化状态、预览 DDL 并执行物化。',
      }}
      prompts={[
        { key: '1', description: '查看各实体的物化版本状态' },
        { key: '2', description: '预览所有 ER 实体的物化 SQL' },
        { key: '3', description: '哪些表物化版本不是最新？' },
      ]}
    >
      <Outlet />
    </AIChatPageScope>
  );
}
