import { AIChatPageScope, useAIChatDisplayMode } from '@EADAF/ai-base';
import { useMemo } from 'react';
import { Outlet } from 'react-router-dom';

const MODEL_DESIGN_NEXT_STEP_PROMPTS: Record<
  string,
  string | ((context: Record<string, unknown>) => string)
> = {
  materialize:
    '请对当前已建模且校验通过的实体执行物化：先查看物化状态与预览 SQL，确认后执行物化。若需选择连接，请根据实体 Scope 自动推断。',
  create_api:
    '请为当前已建模的业务实体批量创建 CRUD API 服务：先 list 实体与已有服务，再 create_services_batch，并 publish + run_test 验证。',
  create_metrics:
    '请基于当前业务实体设计业务指标：列出实体后，为关键实体创建 SQL 聚合或 formula 复合指标，并执行验证。',
  refine_model:
    '请继续完善当前业务实体的字段、索引与关系，并对每个实体调用 bizdata_validate_model 直至全部通过。',
};

export default function BusinessDataDesignAI() {
  useAIChatDisplayMode('sidebar');

  const nextStepPrompts = useMemo(() => MODEL_DESIGN_NEXT_STEP_PROMPTS, []);

  return (
    <AIChatPageScope
      scopeSlug="business-data"
      fallbackSkillSlugs={['bizdata-model-design']}
      headerCaption="模型设计助手"
      systemPromptPrefix="你是 EADAF 业务数据建模助手，帮助用户设计 Scope:Entity 层级模型。调整 Scope 或重命名实体 code 时必须用 bizdata_rename_entity_code（仅 entityCode + code），禁止 delete + create。默认只完成逻辑建模（枚举/字段/索引/关系/校验），物化与 API 等下游步骤须用户明确请求或通过下一步按钮触发。"
      welcome={{
        title: '业务数据模型设计',
        description: '选中实体或点击 @ 添加引用后，快捷提示会随上下文更新。',
      }}
      prompts={[]}
      nextStepPrompts={nextStepPrompts}
    >
      <Outlet />
    </AIChatPageScope>
  );
}
