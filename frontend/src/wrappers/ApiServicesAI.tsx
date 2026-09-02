import { AIChatPageScope, useAIChatDisplayMode } from '@eadaf/ai-base';
import { Outlet, useLocation } from 'react-router-dom';
import { AI_CHAT_TOOL_VERIFICATION_RULES } from '@/config/aiChat';

const COLLECTION_PIPELINE_SKILL = 'api-services-collection-pipeline';
const HOOK_CENTER_SKILL = 'hook-center-manage';

export default function ApiServicesAI() {
  useAIChatDisplayMode('sidebar');
  const location = useLocation();
  const pathname = location.pathname;

  const isCollectionPipeline = pathname.includes('/api_services/collection-pipelines');
  const isCollectionTest = /\/api_services\/collection-pipelines\/[^/]+\/test/.test(pathname);
  const isCollectionEdit = /\/api_services\/collection-pipelines\/[^/]+\/edit/.test(pathname);
  const isCollectionCreate = pathname.endsWith('/collection-pipelines/create');

  const isHooks = pathname.includes('/api_services/hooks');
  const isHookEdit = /\/api_services\/hooks\/[^/]+\/edit/.test(pathname);
  const isHookCreate = pathname.endsWith('/hooks/create');
  const isHookRuns = /\/api_services\/hooks\/[^/]+\/runs/.test(pathname);

  const isApiServiceCreate = pathname === '/api_services/create';
  const isApiServiceTest = !isCollectionPipeline && !isHooks && /\/api_services\/[^/]+\/test/.test(pathname);
  const isApiServiceEdit = !isCollectionPipeline && !isHooks && /\/api_services\/[^/]+\/edit/.test(pathname);

  const fallbackSkillSlugs = isCollectionPipeline
    ? [COLLECTION_PIPELINE_SKILL]
    : isHooks
      ? [HOOK_CENTER_SKILL]
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
    : isHooks
      ? isHookCreate || isHookEdit
        ? '钩子配置助手'
        : isHookRuns
          ? '钩子运行排查助手'
          : '钩子管理助手'
      : isApiServiceCreate
        ? 'API 服务设计助手'
        : isApiServiceTest
          ? 'API 测试与自动修复'
          : isApiServiceEdit
            ? 'API 服务编辑助手'
            : 'API 服务助手';

  const collectionRules = [
    AI_CHAT_TOOL_VERIFICATION_RULES,
    '',
    '你是 EADAF 采集数据结构化助手。列表路径：/api_services/collection-pipelines（不在业务数据菜单）。',
    '【持久化】collection_pipeline_suggest_scripts 只写编辑页草稿；run_test 读库内脚本。改脚本后必须 collection_pipeline_upsert 再测。',
    '【脚本】parse(raw,ctx) / store(data,ctx)；ctx 仅有 protocolType、pipeline、entity、tableQualified、queryPg。禁止未声明变量（channel/val/idx 等）；禁止 ctx.bizdata。',
    '【成功】upsert 须 verified===true 且 listedOk；创建后 navigate list，并提示用户左侧选对应域（如 fmms）。',
  ].join('\n');

  const hookRules = [
    AI_CHAT_TOOL_VERIFICATION_RULES,
    '',
    '你是 EADAF 钩子管理助手。列表路径：/api_services/hooks。',
    '【事件】创建/修改钩子前必须 hook_list_event_types 获取真实事件目录与 payload 结构，禁止编造事件类型或字段。',
    '【脚本】script 动作签名 handler(event, ctx)；可用 event.payload / ctx.log(...) / db(实体code)；无网络访问。保存前必须 hook_check_script 通过。',
    '【草稿与保存】表单页用 hook_suggest_config 同步草稿由用户确认；仅当用户明确要求时才 hook_create_hook / hook_update_hook 直接保存。',
    '【验证】已保存的钩子必须 hook_test_hook 用事件目录 example 构造 mock 试跑，失败须自动修复重测至 success；未验证通过禁止声称已配置完成。',
    '【状态】新建钩子为草稿，须启用后才触发；连续失败 10 次会被自动停用（auto_disabled）。',
  ].join('\n');

  const systemPromptPrefix = isCollectionPipeline
    ? collectionRules
    : isHooks
      ? hookRules
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
          : '脚本须经 upsert 落库后再测试；suggest_scripts 仅草稿。列表在 API 服务 → 采集数据结构化。',
      }
    : isHooks
      ? {
          title: isHookCreate || isHookEdit ? '钩子配置' : '钩子管理',
          description: isHookCreate || isHookEdit
            ? '直接用自然语言描述需求（如"订单金额超 1 万就通知我"），我会查询事件目录并组装完整配置。'
            : isHookRuns
              ? '我可解读运行记录与失败原因，并用原始负载重放验证修复。'
              : '我可以帮你创建、试跑、启用钩子；说一句"当 XX 发生时做 YY"即可开始。',
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
      semanticRouteDomains={['api_services']}
      headerCaption={headerCaption}
      systemPromptPrefix={systemPromptPrefix}
      welcome={welcome}
      prompts={[]}
    >
      <Outlet />
    </AIChatPageScope>
  );
}
