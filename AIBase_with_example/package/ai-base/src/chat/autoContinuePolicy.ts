/** Skill 内标注为「连续执行」的业务（如 API test-fix），不受一次一事限制 */
export const CONTINUOUS_EXECUTION_SKILLS = new Set([
  'bizdata-api-service-test-fix',
]);

/**
 * MOCK 数据相关 Skill：仅当当前页主 Skill 属于此类时，"文本提 MOCK 就续调" 才允许触发。
 * 故意不含 bizdata-materialization——物化页虽会加载 mock 工具，但主任务是物化，
 * 不应因正文提到 MOCK 就自动续调插入数据。MOCK 须由用户明确要求。
 */
const MOCK_SKILLS = new Set(['bizdata-mock-data']);

const TASK_DONE_RE =
  /全部完成|均已?(完成|建立|创建|校验通过)|建模完成|校验通过|无需再|任务完成|已完成建模|全部实体.*校验|当前阶段完成|本阶段.*完成|阶段.*完成/i;

const MOCK_SUCCESS_CLAIM_RE =
  /MOCK|插入.*条|已成功插入|全部.*插入|可用于开发测试|数据关系链路/i;

const APISERVICE_SUCCESS_CLAIM_RE =
  /API 服务.*(已|成功)|已发布|发布成功|测试通过|创建成功|重新创建成功|已成功创建/i;

const APISERVICE_WRITE_TOOLS = new Set([
  'apiservice_create_service',
  'apiservice_create_services_batch',
  'apiservice_publish_service',
  'apiservice_run_test',
  'apiservice_update_service',
  'apiservice_delete_service',
]);

/** 收尾引导句（下一步建议），不应触发 auto-continue */
const PROGRESS_CLOSING_RE =
  /接下来您(?:可以|若|也)?|建议(?:您|可)|可选(?:操作|步骤)?|如需(?:继续|物化|创建|配置)/i;

const VALIDATION_ERROR_RE = /校验失败|存在错误|未通过校验|仍有.*问题|errors/i;

export interface AutoContinueContext {
  skillSlugs: string[];
  allowedToolNames: Set<string>;
  invokedToolNames: Set<string>;
  toolsExecuted: number;
  text: string;
}

function apiserviceClaimedWithoutEvidence(text: string, invokedToolNames: Set<string>): boolean {
  if (!APISERVICE_SUCCESS_CLAIM_RE.test(text)) {
    if (
      /已存在|无需重复|完好运行|存在于系统中/i.test(text)
      && !invokedToolNames.has('apiservice_list_services')
      && !invokedToolNames.has('apiservice_get_service')
    ) {
      return true;
    }
    return false;
  }
  const invokedWrite = [...APISERVICE_WRITE_TOOLS].some((name) => invokedToolNames.has(name));
  if (!invokedWrite) return true;
  if (/测试通过|测试成功/i.test(text) && !invokedToolNames.has('apiservice_run_test')) {
    return true;
  }
  if (/已发布|发布成功/i.test(text) && !invokedToolNames.has('apiservice_publish_service')) {
    return true;
  }
  if (
    /创建成功|重新创建|已成功创建/i.test(text)
    && !invokedToolNames.has('apiservice_create_service')
    && !invokedToolNames.has('apiservice_create_services_batch')
  ) {
    return true;
  }
  if (/完善成功|完善完成|已完善|优化完成/i.test(text)) {
    if (!invokedToolNames.has('apiservice_run_test')) return true;
    if (!invokedToolNames.has('apiservice_get_service')) return true;
  }
  if (
    invokedToolNames.has('apiservice_run_test')
    && !invokedToolNames.has('apiservice_set_test_params')
    && (/测试通过|测试成功|修复成功|mock.*成功|参数.*(已|成功)/i.test(text))
  ) {
    return true;
  }
  return false;
}

function hasIncompleteProgressNarration(text: string): boolean {
  if (PROGRESS_CLOSING_RE.test(text)) return false;
  return /第[一二三四五六七八九十\d]+步|现在进入第?|进入第[三四五]步|最后第?[四五]步|接下来(?!您|可|若|也|建议)/i.test(
    text,
  );
}

function isModelDesignPhaseComplete(ctx: AutoContinueContext): boolean {
  if (!ctx.skillSlugs.includes('bizdata-model-design')) return false;
  if (!ctx.invokedToolNames.has('bizdata_validate_model')) return false;
  if (VALIDATION_ERROR_RE.test(ctx.text)) return false;
  return (
    TASK_DONE_RE.test(ctx.text)
    || /全部实体|每个实体.*校验|建模.*完成|本阶段|当前阶段|已完成.*实体/i.test(ctx.text)
  );
}

/** 物化阶段已完成：物化页主 Skill + 已执行物化 + 文本表完成语义 + 无错误 → 早退，不再续调 */
function isMaterializationPhaseComplete(ctx: AutoContinueContext): boolean {
  if (!ctx.skillSlugs.includes('bizdata-materialization')) return false;
  if (!ctx.invokedToolNames.has('bizdata_execute_materialization')) return false;
  if (VALIDATION_ERROR_RE.test(ctx.text)) return false;
  return (
    TASK_DONE_RE.test(ctx.text)
    || /物化.*(完成|成功|执行成功)|本阶段|当前阶段|已.*物化/i.test(ctx.text)
  );
}

/** 当前页主 Skill 是否为 MOCK 相关（用于收紧 MOCK 续调分支） */
function hasMockSkill(skillSlugs: string[]): boolean {
  return skillSlugs.some((slug) => MOCK_SKILLS.has(slug));
}

function hasApiserviceTools(allowedToolNames: Set<string>): boolean {
  return [...allowedToolNames].some((name) => name.startsWith('apiservice_'));
}

export function buildAutoContinueNudge(allowedToolNames: Set<string>): string {
  const examples: string[] = [];
  if (allowedToolNames.has('bizdata_validate_model')) {
    examples.push('bizdata_validate_model');
  }
  if (allowedToolNames.has('bizdata_insert_mock_data')) {
    examples.push('bizdata_insert_mock_data');
  }
  if (allowedToolNames.has('bizdata_execute_materialization')) {
    examples.push('bizdata_execute_materialization');
  }
  const apiTools = [...allowedToolNames].filter((name) => name.startsWith('apiservice_'));
  if (apiTools.length) {
    examples.push(...apiTools.slice(0, 4));
  }
  const toolHint = examples.length ? examples.join('、') : '当前 Skill 允许的 Tool';
  return `[系统] 请立即调用 Tool 完成尚未执行的步骤（如 ${toolHint}），不要只输出步骤说明或虚假成功汇总。API 测试参数修复成功后须 apiservice_set_test_params 保存 mock。必须以 Tool 返回的 _verification / success / verified 字段为准汇报结果。`;
}

export function shouldAutoContinueAfterTextOnly(ctx: AutoContinueContext): boolean {
  const { text, toolsExecuted, invokedToolNames, allowedToolNames, skillSlugs } = ctx;
  if (toolsExecuted === 0 || !text.trim()) return false;

  if (isModelDesignPhaseComplete(ctx)) return false;
  if (isMaterializationPhaseComplete(ctx)) return false;
  if (TASK_DONE_RE.test(text)) return false;

  // MOCK 续调收紧：仅当当前页主 Skill 是 MOCK 相关时，"文本提 MOCK 但未调用" 才续调。
  // 物化页等会加载 mock 工具但主任务不是 MOCK，不应因正文提到 MOCK 就自动续插数据。
  if (
    hasMockSkill(skillSlugs)
    && allowedToolNames.has('bizdata_insert_mock_data')
    && MOCK_SUCCESS_CLAIM_RE.test(text)
    && !invokedToolNames.has('bizdata_insert_mock_data')
  ) {
    return true;
  }

  if (hasApiserviceTools(allowedToolNames) && apiserviceClaimedWithoutEvidence(text, invokedToolNames)) {
    return true;
  }

  const isContinuous = skillSlugs.some((slug) => CONTINUOUS_EXECUTION_SKILLS.has(slug));
  if (hasIncompleteProgressNarration(text)) {
    return true;
  }

  if (
    allowedToolNames.has('bizdata_validate_model')
    && /校验|validate/i.test(text)
    && !invokedToolNames.has('bizdata_validate_model')
  ) {
    return true;
  }

  if (
    hasMockSkill(skillSlugs)
    && allowedToolNames.has('bizdata_insert_mock_data')
    && /MOCK|mock.?data|测试数据/i.test(text)
    && !invokedToolNames.has('bizdata_insert_mock_data')
  ) {
    return true;
  }

  if (isContinuous && /完善|修复|测试/i.test(text) && toolsExecuted > 0) {
    return hasIncompleteProgressNarration(text);
  }

  return false;
}
