import { AIChatPageScope, useAIChatDisplayMode } from '@eadaf/ai-base';
import { Outlet, useLocation } from 'react-router-dom';
import { AI_CHAT_TOOL_VERIFICATION_RULES } from '@/config/aiChat';

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

  const metricsDomainRules = isMetricsDashboard
    ? [
        '你是 EADAF 指标看板助手。看板只展示「指标卡片」(metric_cards)，不自动展示全部指标定义。',
        '【硬区分】指标定义(metrics)=怎么算；指标卡片(metric_cards)=怎么展示。',
        '用户说「创建看板卡片 / 指标卡片 / 看板」时：只用 bizdata_metric_card_*；禁止用 bizdata_metric_upsert。',
        '创建卡片必须调用 bizdata_metric_card_upsert，且信封 verified===true；再用 get_dashboard/card_list 看到非空 cards 才可声称成功。',
        'bizdata_metric_list 只用于查找要绑定的 metricCode，列出指标≠创建卡片。',
      ].join('')
    : [
        '你是 EADAF 业务指标助手，帮助在「指标管理」配置 SQL/公式指标与调度并执行验证。',
        '【硬区分】bizdata_metric_upsert 只创建/更新指标定义，不会出现在看板。',
        '成功须 Tool 信封 verified===true；若用户要看板展示，须另用 bizdata_metric_card_upsert。',
        '页面路径前缀 /business_data/metrics。',
      ].join('');

  const systemPromptPrefix = isMetrics
    ? [AI_CHAT_TOOL_VERIFICATION_RULES, '', metricsDomainRules].join('\n')
    : '你是 EADAF 数据物化助手，帮助预览 SQL、执行物化并解释版本差异。';

  const welcome = isMetrics
    ? {
        title: isMetricsDashboard ? '指标看板' : isMetricsCreate ? '新建指标' : '业务指标',
        description: isMetricsDashboard
          ? '看板展示的是「指标卡片」。可帮你为已有指标创建/建议卡片（card_upsert / card_suggest），并以 verified + get_dashboard 验收。'
          : '支持 SQL 指标与 formula 复合指标；写操作须 Tool verified=true。看板展示需另建指标卡片。',
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
