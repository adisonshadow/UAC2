/**
 * 回归场景验证（node --import tsx src/chat/autoContinuePolicy.verify.ts）
 */
import assert from 'node:assert/strict';
import {
  buildAutoContinueNudge,
  shouldAutoContinueAfterTextOnly,
  type AutoContinueContext,
} from './autoContinuePolicy';
import { extractA2uiCommandsPayload } from '../a2ui/parseA2uiCommands';
import type { AIBaseSkill, SkillCompletionStrategy } from '../types';

function makeSkill(slug: string, strategy?: SkillCompletionStrategy): AIBaseSkill {
  return {
    id: slug,
    name: slug,
    slug,
    contentMarkdown: '',
    completionStrategy: strategy,
  };
}

function ctx(partial: Partial<AutoContinueContext> & Pick<AutoContinueContext, 'text'>): AutoContinueContext {
  return {
    skills: [
      makeSkill('bizdata-model-design', {
        requiredTools: ['bizdata_validate_model'],
        completionKeywords: ['建模完成', '校验通过', '任务完成'],
        blockKeywords: ['接下来您可以', '建议您'],
      }),
    ],
    allowedToolNames: new Set([
      'bizdata_create_entity',
      'bizdata_validate_model',
      'bizdata_list_entity_summaries',
    ]),
    invokedToolNames: new Set<string>(),
    toolsExecuted: 1,
    toolOutcomes: [],
    ...partial,
  };
}

// 场景 A：建模-only — 校验完成后含「接下来您可以」不应 auto-continue
{
  const c = ctx({
    text: '全部实体建模完成，校验均已通过。接下来您可以执行物化或创建 API。',
    invokedToolNames: new Set(['bizdata_validate_model', 'bizdata_create_entity']),
    toolsExecuted: 5,
    toolOutcomes: [
      {
        ok: true,
        verified: true,
        kind: 'success',
        meta: { tool: 'bizdata_validate_model' },
      },
    ],
  });
  assert.equal(shouldAutoContinueAfterTextOnly(c), false, '场景 A：建模完成后不应继续');
}

// 场景 B：声称成功但 Tool 未 verified → 应续调纠正
{
  const c = ctx({
    text: 'API 服务已创建成功，发布完成。',
    skills: [
      makeSkill('bizdata-api-service-create', {
        requiredTools: ['apiservice_create_service'],
        completionKeywords: ['创建成功', '发布成功'],
      }),
    ],
    invokedToolNames: new Set(['apiservice_create_service']),
    toolsExecuted: 1,
    toolOutcomes: [
      {
        ok: true,
        verified: false,
        kind: 'business_error',
        error: { message: '列表中未找到服务' },
        meta: { tool: 'apiservice_create_service' },
      },
    ],
  });
  assert.equal(shouldAutoContinueAfterTextOnly(c), true, '场景 B：虚假成功应续调');
}

// 场景 C：收尾句「接下来您可以」不触发 auto-continue
{
  const c = ctx({
    text: '索引与关系已补齐。接下来您可以继续完善其他实体。',
    invokedToolNames: new Set(['bizdata_validate_model']),
    toolsExecuted: 3,
  });
  assert.equal(shouldAutoContinueAfterTextOnly(c), false, '场景 C：收尾引导不应继续');
}

// 场景 D：API test-fix 连续执行 — 写了步骤但未调 run_test 应继续
{
  const apiCtx: AutoContinueContext = {
    skills: [
      makeSkill('bizdata-api-service-test-fix', {
        continuousExecution: true,
      }),
    ],
    allowedToolNames: new Set([
      'apiservice_run_test',
      'apiservice_set_test_params',
      'apiservice_get_service',
    ]),
    invokedToolNames: new Set(['apiservice_update_service']),
    toolsExecuted: 2,
    text: '第三步：运行 apiservice_run_test 验证修复结果',
    toolOutcomes: [],
  };
  assert.equal(shouldAutoContinueAfterTextOnly(apiCtx), true, '场景 D：test-fix 步骤叙述应继续');
}

// 场景 E：声称已发布但未调用 publish → 应续调
{
  const c = ctx({
    text: 'fmms 域全部已发布，0 draft ✅',
    invokedToolNames: new Set(['apiservice_run_test', 'apiservice_list_services']),
    toolsExecuted: 10,
    toolOutcomes: [
      {
        ok: true,
        verified: true,
        kind: 'success',
        meta: { tool: 'apiservice_run_test' },
      },
    ],
    skills: [
      makeSkill('bizdata-api-service-manage', {
        requiredTools: ['apiservice_run_test'],
        completionKeywords: ['全部已发布', '0 draft'],
        claimRules: [
          {
            keywords: ['已发布', '全部已发布', '0 draft'],
            requiredTools: ['apiservice_publish_service'],
          },
        ],
      }),
    ],
  });
  assert.equal(
    shouldAutoContinueAfterTextOnly(c),
    true,
    '场景 E：声称已发布但未调用 publish 应续调',
  );
}

// 场景 F：发布任务完成（已调 publish、未调 run_test）→ 不应续调
{
  const c = ctx({
    text: '📦 发布结果\n4 个服务全部 published，fmms:production 域下 draft 已清零',
    invokedToolNames: new Set([
      'apiservice_list_draft_services',
      'apiservice_publish_service',
      'apiservice_run_test',
    ]),
    toolsExecuted: 12,
    toolOutcomes: [
      {
        ok: true,
        verified: true,
        kind: 'success',
        meta: { tool: 'apiservice_publish_service' },
      },
      {
        ok: true,
        verified: true,
        kind: 'success',
        meta: { tool: 'apiservice_list_draft_services' },
      },
    ],
    skills: [
      makeSkill('bizdata-api-service-manage', {
        completionKeywords: ['全部 published', 'draft 已清零'],
        claimRules: [
          {
            keywords: ['全部 published', 'draft 已清零'],
            requiredTools: ['apiservice_publish_service'],
          },
        ],
      }),
    ],
  });
  assert.equal(
    shouldAutoContinueAfterTextOnly(c),
    false,
    '场景 F：发布完成后不应因缺少 run_test 而续调',
  );
}

// 场景 G：含 A2UI 下一步建议 → 不应续调
{
  const c = ctx({
    text: '发布完成。\n\n```a2ui-commands\n{"steps":[{"id":"test","label":"运行全量测试"}]}\n```',
    invokedToolNames: new Set(['apiservice_publish_service']),
    toolsExecuted: 5,
    skills: [
      makeSkill('bizdata-api-service-manage', {
        completionKeywords: ['发布完成'],
      }),
    ],
  });
  assert.equal(shouldAutoContinueAfterTextOnly(c), false, '场景 G：A2UI 下一步建议不应续调');
}

// 场景 H：publish 返回 alreadyPublished → 声称全部 published 时不应续调
{
  const c = ctx({
    text: '4 个服务全部 published，draft 已清零',
    invokedToolNames: new Set(['apiservice_publish_service', 'apiservice_list_draft_services']),
    toolsExecuted: 8,
    toolOutcomes: [
      {
        ok: false,
        verified: false,
        kind: 'business_error',
        error: { message: '服务「svc-a」已是 published，未产生 draft→published 变更' },
        data: { alreadyPublished: true },
        meta: { tool: 'apiservice_publish_service' },
      },
    ],
    skills: [
      makeSkill('bizdata-api-service-manage', {
        completionKeywords: ['全部 published', 'draft 已清零'],
        claimRules: [
          {
            keywords: ['全部 published', 'draft 已清零'],
            requiredTools: ['apiservice_publish_service'],
          },
        ],
      }),
    ],
  });
  assert.equal(
    shouldAutoContinueAfterTextOnly(c),
    false,
    '场景 H：alreadyPublished 不应触发续调',
  );
}

// auto-continue nudge 未 verified 时包含错误信息
{
  const nudge = buildAutoContinueNudge(new Set(['apiservice_create_service']), [], [
    {
      ok: true,
      verified: false,
      kind: 'business_error',
      error: { message: '列表中未找到服务' },
      meta: { tool: 'apiservice_create_service' },
    },
  ]);
  assert.match(nudge, /禁止向用户声称已成功/);
  assert.match(nudge, /列表中未找到服务/);
}

// A2UI 解析：流式未闭合块不露出 JSON
{
  const streaming = extractA2uiCommandsPayload(
    '建模已完成。\n\n```a2ui-commands\n{"steps":[{"id":"materialize","label":"执行物化"}',
  );
  assert.equal(streaming.isStreamingBlock, true);
  assert.equal(streaming.displayText.includes('a2ui-commands'), false);
}

// A2UI 解析：完整块剥离并解析 steps
{
  const parsed = extractA2uiCommandsPayload(
    '完成。\n\n```a2ui-commands\n{"steps":[{"id":"materialize","label":"执行物化"}]}\n```',
  );
  assert.equal(parsed.hasSteps, true);
  assert.equal(parsed.steps[0]?.id, 'materialize');
  assert.equal(parsed.displayText.includes('a2ui-commands'), false);
}

console.log('autoContinuePolicy + A2UI 回归场景全部通过');
