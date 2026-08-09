import { AIChatPageScope, useAIChatDisplayMode } from '@eadaf/ai-base';
import { Outlet, useLocation } from 'react-router-dom';

export default function BusinessDataMetadataAI() {
  useAIChatDisplayMode('sidebar');
  const location = useLocation();
  const isStandards = location.pathname.includes('/data-standards');

  return (
    <AIChatPageScope
      scopeSlug="business-data"
      fallbackSkillSlugs={
        isStandards ? ['bizdata-data-standards'] : ['bizdata-metadata-catalog']
      }
      headerCaption={isStandards ? '数据标准助手' : '逻辑元数据助手'}
      systemPromptPrefix={
        isStandards
          ? '你是 EADAF 数据标准治理助手，帮助维护标准名、编码、版本与状态。'
          : '你是 EADAF 逻辑元数据助手，帮助维护实体/指标/枚举的逻辑元数据，并关联数据标准。'
      }
      welcome={
        isStandards
          ? {
              title: '数据标准',
              description: '我可以帮你创建、查询和维护数据标准；点击标准名旁的 @ 可更新快捷提示。',
            }
          : {
              title: '逻辑元数据',
              description: '点击左侧条目旁的 @ 添加引用，快捷提示会随选中项更新。',
            }
      }
      prompts={[]}
    >
      <Outlet />
    </AIChatPageScope>
  );
}
