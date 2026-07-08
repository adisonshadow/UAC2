import { AIChatPageScope, useAIChatDisplayMode } from '@EADAF/ai-base';
import { Outlet, useLocation } from 'react-router-dom';

const COLLECTION_PIPELINE_SKILL = 'api-services-collection-pipeline';

export default function ApiServicesAI() {
  useAIChatDisplayMode('sidebar');
  const location = useLocation();
  const pathname = location.pathname;

  const isCollectionPipeline = pathname.includes('/api_services/collection-pipelines');
  const isCollectionTest = /\/api_services\/collection-pipelines\/[^/]+\/test/.test(pathname);
  const isCollectionEdit = /\/api_services\/collection-pipelines\/[^/]+\/edit/.test(pathname);
  const isCollectionCreate = pathname.endsWith('/collection-pipelines/create');

  const isApiServiceCreate = pathname === '/api_services/create';
  const isApiServiceTest = !isCollectionPipeline && /\/api_services\/[^/]+\/test/.test(pathname);
  const isApiServiceEdit = !isCollectionPipeline && /\/api_services\/[^/]+\/edit/.test(pathname);

  const fallbackSkillSlugs = isCollectionPipeline
    ? [COLLECTION_PIPELINE_SKILL]
    : isApiServiceCreate
      ? ['bizdata-api-service-create']
      : isApiServiceTest || isApiServiceEdit
        ? ['bizdata-api-service-test-fix', 'bizdata-api-service-manage']
        : ['bizdata-api-service-manage'];

  const headerCaption = isCollectionPipeline
    ? isCollectionTest
      ? '采集管道测试助手'
      : isCollectionEdit || isCollectionCreate
        ? '采集管道配置助手'
        : '采集数据结构化助手'
    : isApiServiceCreate
      ? 'API 服务设计助手'
      : isApiServiceTest
        ? 'API 测试与自动修复'
        : isApiServiceEdit
          ? 'API 服务编辑助手'
          : 'API 服务助手';

  const systemPromptPrefix = isCollectionPipeline
    ? '你是 EADAF 采集数据结构化助手，帮助用户在 API 服务菜单下的「采集数据结构化」页配置管道、编写 parse/store 脚本并完成测试。页面路径前缀 /api_services/collection-pipelines。'
    : isApiServiceCreate
      ? '你是 EADAF API 服务设计助手。禁止向用户询问数据库连接或 connectionId；仅一个连接时自动使用，多个连接时根据引用 Scope/Entity 的物化记录自动推断。'
      : isApiServiceTest || isApiServiceEdit
        ? '你是 EADAF API 服务测试与修复助手。测试失败时必须通过 Tool 自动修复（改 mock 或改 SQL/配置），禁止只给文字建议。配置类问题应跳转编辑页修改并保存，再返回测试页自动重测。'
        : '你是 EADAF API 服务助手，帮助用户查看、发布与管理基于 SQL 的数据 API 服务。';

  const welcome = isCollectionPipeline
    ? {
        title: '采集数据结构化',
        description: isCollectionTest
          ? '我可读取测试页样本与脚本，执行 collection_pipeline_run_test 并解读结果。'
          : '配置样本数据、目标结构与 parse/store 脚本；可用 collection_pipeline_suggest_scripts 写入脚本草稿。',
      }
    : {
        title: isApiServiceCreate ? '新建 API 服务' : isApiServiceTest ? 'API 测试' : 'API 服务',
        description: isApiServiceCreate
          ? '从左侧数据模型树添加 Scope 或实体引用，快捷提示会随引用自动更新。'
          : isApiServiceTest
            ? '测试失败时可点击「自动修复」，我会分析错误并修改 mock 或 SQL 后自动重测。'
            : '我可以帮你查看 API 服务列表；点击名称旁的 @ 后快捷提示会更新。',
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
