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

function ctx(partial: Partial<AutoContinueContext> & Pick<AutoContinueContext, 'text'>): AutoContinueContext {
  return {
    skillSlugs: ['bizdata-model-design'],
    allowedToolNames: new Set([
      'bizdata_create_entity',
      'bizdata_validate_model',
      'bizdata_list_entities',
    ]),
    invokedToolNames: new Set<string>(),
    toolsExecuted: 1,
    ...partial,
  };
}

// 场景 A：建模-only — 校验完成后含「接下来您可以」不应 auto-continue
{
  const c = ctx({
    text: '全部实体建模完成，校验均已通过。接下来您可以执行物化或创建 API。',
    invokedToolNames: new Set(['bizdata_validate_model', 'bizdata_create_entity']),
    toolsExecuted: 5,
  });
  assert.equal(shouldAutoContinueAfterTextOnly(c), false, '场景 A：建模完成后不应继续');
}

// 场景 B：用户明确要求全套 — Skill 层约束；运行时建模页无下游 Tool
{
  const modelTools = new Set(['bizdata_validate_model', 'bizdata_create_entity']);
  assert.equal(modelTools.has('bizdata_execute_materialization'), false, '场景 B：建模 Skill 无物化 Tool');
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

// 场景 D：API test-fix 连续执行 — 写了步骤但未调 run_test 应继续（在 apiservice Skill 下）
{
  const apiCtx: AutoContinueContext = {
    skillSlugs: ['bizdata-api-service-test-fix'],
    allowedToolNames: new Set([
      'apiservice_run_test',
      'apiservice_set_test_params',
      'apiservice_get_service',
    ]),
    invokedToolNames: new Set(['apiservice_update_service']),
    toolsExecuted: 2,
    text: '第三步：运行 apiservice_run_test 验证修复结果',
  };
  assert.equal(shouldAutoContinueAfterTextOnly(apiCtx), true, '场景 D：test-fix 步骤叙述应继续');
}

// auto-continue nudge 仅列举当前 Skill 允许的工具
{
  const nudge = buildAutoContinueNudge(new Set(['bizdata_validate_model']));
  assert.match(nudge, /bizdata_validate_model/);
  assert.doesNotMatch(nudge, /apiservice_create_service/);
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
