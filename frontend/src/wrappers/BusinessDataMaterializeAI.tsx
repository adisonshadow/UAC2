import { AIChatPageScope, useAIChatDisplayMode } from '@EADAF/ai-base';
import { Outlet, useLocation } from 'react-router-dom';

const METRICS_SKILL = 'bizdata-metrics';

export default function BusinessDataMaterializeAI() {
  useAIChatDisplayMode('sidebar');
  const { pathname } = useLocation();

  const isMetrics = pathname.includes('/business_data/metrics');
  const isMetricsDashboard = pathname.endsWith('/metrics/dashboard');
  const isMetricsEdit = /\/business_data\/metrics\/[^/]+\/edit/.test(pathname);
  const isMetricsCreate = pathname.endsWith('/metrics/create');

  const fallbackSkillSlugs = isMetrics ? [METRICS_SKILL] : ['bizdata-materialization'];

  const headerCaption = isMetrics
    ? isMetricsDashboard
      ? '指标看板助手'
      : isMetricsEdit || isMetricsCreate
        ? '指标配置助手'
        : '业务指标助手'
    : '数据物化助手';

  const systemPromptPrefix = isMetrics
    ? '你是 EADAF 业务指标助手，帮助用户在「指标管理 / 指标看板」页创建 SQL 聚合与复合公式指标、配置调度并执行验证。页面路径前缀 /business_data/metrics。'
    : '你是 EADAF 数据物化助手，帮助预览 SQL、执行物化并解释版本差异。';

  const welcome = isMetrics
    ? {
        title: isMetricsDashboard ? '指标看板' : isMetricsCreate ? '新建指标' : '业务指标',
        description: isMetricsDashboard
          ? '我可解读看板数值、刷新指标并排查未更新问题。'
          : '支持 SQL 指标与 formula 复合指标；可用 bizdata_metric_suggest_definition 写入 SQL/公式草稿。',
      }
    : {
        title: '数据物化',
        description: '从实体树引用实体或勾选实体后，快捷提示会给出物化相关建议。',
      };

  return (
    <AIChatPageScope
      scopeSlug="business-data"
      fallbackSkillSlugs={fallbackSkillSlugs}
      headerCaption={headerCaption}
      systemPromptPrefix={systemPromptPrefix}
      welcome={welcome}
      prompts={[]}
    >
      <Outlet />
    </AIChatPageScope>
  );
}
