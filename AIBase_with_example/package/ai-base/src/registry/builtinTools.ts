import { readAllAISurfaces } from './aiSurfaceRegistry';
import { registerFunctionCalls, unregisterFunctionCalls } from './functionRegistry';
import { getCurrent, getPlan, setPlan } from './agentPlanState';
import type { PlanItem } from '../types';
import type { ToolResponse } from '../types/toolResponse';
import {
  ASK_USER_TOOL,
  type AskUserArgs,
  type UserChoiceOption,
  type UserChoiceRequest,
} from '../chat/userChoice';

const BUILTIN_TOOL_NAME = 'aibase_read_surfaces';

/** 结构化终止机制注入的 harness Tool 名 */
export const TASK_COMPLETE_TOOL = 'task_complete';
export const UPDATE_PLAN_TOOL = 'update_plan';
export { ASK_USER_TOOL };
export const HARNESS_TOOL_NAMES = new Set([TASK_COMPLETE_TOOL, UPDATE_PLAN_TOOL, ASK_USER_TOOL]);

/* -------------------------------------------------------------------------- */
/* update_plan —— 结构化任务清单维护                                            */
/* -------------------------------------------------------------------------- */

/**
 * 校验 plan 合法性：
 * - id 唯一
 * - 同时只有一个 in_progress
 * - status 取值合法
 * 返回错误消息，合法时返回 null。
 */
function validatePlan(plan: PlanItem[]): string | null {
  if (!Array.isArray(plan)) return 'plan 必须为数组';
  const ids = new Set<string>();
  let inProgress = 0;
  for (const item of plan) {
    if (!item.id || typeof item.id !== 'string') return '每个 plan 项须有 string 类型 id';
    if (ids.has(item.id)) return `plan 项 id 重复：${item.id}`;
    ids.add(item.id);
    if (!item.content || typeof item.content !== 'string') return `plan 项 ${item.id} 须有 content`;
    if (!['pending', 'in_progress', 'completed'].includes(item.status)) {
      return `plan 项 ${item.id} 的 status 非法：${item.status}`;
    }
    if (item.status === 'in_progress') inProgress += 1;
  }
  if (inProgress > 1) return '同时只能有一个任务处于 in_progress';
  return null;
}

/**
 * merge=true 时基于现有 plan 增量更新（按 id 合并）；false 时全量替换。
 * 合并时保留未提及项，状态以新值为准。
 */
function mergePlan(current: PlanItem[], incoming: PlanItem[]): PlanItem[] {
  const map = new Map<string, PlanItem>();
  for (const item of current) map.set(item.id, item);
  for (const item of incoming) {
    map.set(item.id, { ...map.get(item.id), ...item });
  }
  return Array.from(map.values());
}

function handleUpdatePlan(args: {
  plan?: PlanItem[];
  merge?: boolean;
}): ToolResponse<{ plan: PlanItem[] }> {
  const incoming = Array.isArray(args.plan) ? args.plan : [];
  const error = validatePlan(incoming);
  if (error) {
    return {
      ok: true,
      verified: false,
      kind: 'business_error',
      error: { code: 'INVALID_PLAN', message: error },
      data: { plan: getPlan() },
      meta: { tool: UPDATE_PLAN_TOOL },
    };
  }

  const merge = args.merge !== false; // 默认 merge
  const current = getPlan();
  const next = merge && current.length ? mergePlan(current, incoming) : incoming;
  setPlan(next);

  return {
    ok: true,
    verified: true,
    kind: 'success',
    data: { plan: next },
    meta: { tool: UPDATE_PLAN_TOOL },
  };
}

/* -------------------------------------------------------------------------- */
/* task_complete —— 终止校验（拒绝/通过）                                       */
/* -------------------------------------------------------------------------- */

function isVerifiedOutcome(item: ToolResponse): boolean {
  if (item.kind === 'system_error' || item.ok === false) return false;
  if (item.kind === 'business_error') return false;
  if (item.verified === false) return false;
  return true;
}

/**
 * 终止校验：按 terminationStrictness 返回未完成项。
 * - off：无条件通过
 * - plan-only：只检查 plan 无 pending/in_progress
 * - strict（默认）：plan + 关键 Tool verified + successCriteria
 */
function collectIncomplete(
  plan: PlanItem[],
  ctx: NonNullable<ReturnType<typeof getCurrent>>,
  criteriaSatisfied?: boolean,
): { incomplete: string[]; reason: string } | null {
  // 查询/只读型：允许直接收尾时，只验 plan，不按写操作清单卡死
  // （避免模型在 plan.requiresVerification 中胡填 bizdata/apiservice 等无关 Tool）
  const allowDirect = Boolean(ctx.completionStrategy?.allowDirectAnswerTermination);
  const strictness = allowDirect
    ? 'plan-only'
    : (ctx.completionStrategy?.terminationStrictness ?? 'strict');

  if (strictness === 'off') return null;

  const incomplete: string[] = [];

  // 层 1：plan 未全部完成
  const unfinished = plan.filter((p) => p.status !== 'completed');
  if (unfinished.length > 0) {
    for (const p of unfinished) {
      incomplete.push(`[${p.status}] ${p.content}`);
    }
  }

  if (strictness === 'plan-only') {
    return incomplete.length ? { incomplete, reason: 'plan 尚有未完成任务' } : null;
  }

  // strict：层 2 —— 关键 Tool（plan 项声明 requiresVerification 的）须全部 verified
  const requiredToolNames = new Set<string>();
  const available = ctx.availableToolNames;
  for (const p of plan) {
    for (const name of p.requiresVerification || []) {
      // 忽略当前页 Tool 池里根本不存在的名字（模型胡填）
      if (available && available.size > 0 && !available.has(name)) continue;
      requiredToolNames.add(name);
    }
  }
  // 兼容：也把 skill 声明的 requiredTools 纳入
  for (const name of ctx.completionStrategy?.requiredTools || []) {
    requiredToolNames.add(name);
  }
  if (requiredToolNames.size > 0) {
    for (const name of requiredToolNames) {
      const relevant = ctx.toolOutcomes.filter((o) => o.meta.tool === name);
      if (relevant.length === 0) {
        incomplete.push(`关键 Tool 未调用：${name}`);
      } else if (!relevant.some(isVerifiedOutcome)) {
        const failed = relevant.find((o) => !isVerifiedOutcome(o));
        incomplete.push(
          `关键 Tool 未通过验证：${name}${failed?.error?.message ? `（${failed.error.message}）` : ''}`,
        );
      }
    }
  }

  // strict：层 3 —— successCriteria（由模型在 args.criteriaSatisfied 声明）
  const criteria = ctx.completionStrategy?.successCriteria;
  if (criteria && criteria.length > 0 && !criteriaSatisfied) {
    incomplete.push('successCriteria 未全部满足');
  }

  return incomplete.length ? { incomplete, reason: '任务尚未通过验收' } : null;
}

function handleTaskComplete(args: {
  summary?: string;
  next_steps?: Array<{ id: string; label: string }>;
  criteriaSatisfied?: boolean;
}): ToolResponse<{ incomplete?: string[] }> {
  const ctx = getCurrent();
  if (!ctx) {
    // 非活跃 turn 调用（理论上不应发生）：宽松放行，避免阻塞
    return {
      ok: true,
      verified: true,
      kind: 'success',
      data: {},
      meta: { tool: TASK_COMPLETE_TOOL },
    };
  }

  const result = collectIncomplete(getPlan(), ctx, args.criteriaSatisfied);
  if (result) {
    return {
      ok: true,
      verified: false,
      kind: 'business_error',
      error: {
        code: 'TASK_INCOMPLETE',
        message: `${result.reason}：${result.incomplete.join('；')}`,
        hint: '请先完成上述任务并通过验证，再调用 task_complete。禁止用自由文本声称完成。',
      },
      data: { incomplete: result.incomplete },
      meta: { tool: TASK_COMPLETE_TOOL },
    };
  }

  return {
    ok: true,
    verified: true,
    kind: 'success',
    data: {},
    meta: { tool: TASK_COMPLETE_TOOL },
  };
}

/* -------------------------------------------------------------------------- */
/* ask_user —— mid-task HITL 选择门                                            */
/* -------------------------------------------------------------------------- */

function normalizeAskUserArgs(args: AskUserArgs):
  | { ok: true; request: UserChoiceRequest }
  | { ok: false; message: string } {
  const question = String(args.question || '').trim();
  if (!question) return { ok: false, message: 'question 不能为空' };

  const mode = args.mode === 'multi' ? 'multi' : 'single';
  const rawOptions = Array.isArray(args.options) ? args.options : [];
  if (rawOptions.length < 1) return { ok: false, message: 'options 至少需要 1 项' };

  const options: UserChoiceOption[] = [];
  const ids = new Set<string>();
  for (const item of rawOptions) {
    const id = String(item?.id || '').trim();
    const label = String(item?.label || '').trim();
    if (!id || !label) return { ok: false, message: '每个 option 须有 id 与 label' };
    if (ids.has(id)) return { ok: false, message: `option id 重复：${id}` };
    ids.add(id);
    const description = item?.description != null ? String(item.description).trim() : '';
    options.push(description ? { id, label, description } : { id, label });
  }

  const allowCustom =
    typeof args.allowCustom === 'boolean' ? args.allowCustom : mode === 'single';
  const minSelect =
    mode === 'multi'
      ? Math.max(1, Math.min(options.length, Number(args.minSelect) || 1))
      : 1;
  let maxSelect: number | undefined;
  if (mode === 'multi') {
    const rawMax = args.maxSelect != null ? Number(args.maxSelect) : options.length;
    maxSelect = Math.max(minSelect, Math.min(options.length, rawMax || options.length));
  }

  return {
    ok: true,
    request: {
      requestId: `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question,
      mode,
      options,
      allowCustom,
      minSelect,
      ...(maxSelect != null ? { maxSelect } : {}),
    },
  };
}

function handleAskUser(args: AskUserArgs): ToolResponse<UserChoiceRequest> {
  const normalized = normalizeAskUserArgs(args);
  if (!normalized.ok) {
    return {
      ok: true,
      verified: false,
      kind: 'business_error',
      error: {
        code: 'INVALID_ASK_USER',
        message: normalized.message,
        hint: '请修正 question / options 后重试 ask_user。',
      },
      meta: { tool: ASK_USER_TOOL },
    };
  }

  return {
    ok: true,
    verified: true,
    kind: 'user_choice_request',
    data: normalized.request,
    meta: { tool: ASK_USER_TOOL },
  };
}

/* -------------------------------------------------------------------------- */
/* 注册 / 注销                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * harness Tool 的 OpenAI function 定义。
 * update_plan / task_complete 仅在 enableStructuredTermination 时注入；
 * ask_user 始终注入（mid-task HITL，与结构化终止开关无关）。
 */
export const ASK_USER_OPENAI_TOOL = {
  type: 'function' as const,
  function: {
    name: ASK_USER_TOOL,
    description:
      '向用户展示结构化选择题并暂停 Agent，直到用户在聊天卡片中确认选择。' +
      '用于方案取舍、危险写操作前确认、多路径决策。禁止仅用「请确认后回复」代替本 Tool。' +
      'mode=single 为单选（默认允许自定义「其他」）；mode=multi 为多选（默认不允许自定义）。' +
      '调用后循环会挂起；用户提交后系统会注入【用户选择】消息并续跑。',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '展示给用户的问题（简洁明确）',
        },
        mode: {
          type: 'string',
          enum: ['single', 'multi'],
          description: 'single=单选；multi=多选',
        },
        options: {
          type: 'array',
          description: '候选项，通常 2–5 个（推荐 3）',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '稳定 id（如 opt_a）' },
              label: { type: 'string', description: '按钮/选项主文案' },
              description: { type: 'string', description: '可选补充说明' },
            },
            required: ['id', 'label'],
          },
        },
        allowCustom: {
          type: 'boolean',
          description: '是否显示「其他」自由输入。single 默认 true，multi 默认 false',
        },
        minSelect: {
          type: 'number',
          description: 'multi 最少选择数，默认 1',
        },
        maxSelect: {
          type: 'number',
          description: 'multi 最多选择数，默认等于 options 长度',
        },
      },
      required: ['question', 'mode', 'options'],
    },
  },
};

export const HARNESS_OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: UPDATE_PLAN_TOOL,
      description:
        '维护结构化任务清单（Plan）。任务开始时拆解为 3-7 个里程碑步骤；每完成一步或状态变化时增量更新。' +
        '同一时间只能有一个任务处于 in_progress。merge=true（默认）按 id 增量合并，false 时全量替换。',
      parameters: {
        type: 'object',
        properties: {
          plan: {
            type: 'array',
            description: '任务清单',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '任务唯一 id（稳定标识，如 t1/t2）' },
                content: { type: 'string', description: '任务描述（做什么）' },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: '当前状态',
                },
                requiresVerification: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '完成该任务须调用的关键 Tool functionName 列表',
                },
              },
              required: ['id', 'content', 'status'],
            },
          },
          merge: {
            type: 'boolean',
            description: '是否增量合并（默认 true）。false 时全量替换清单。',
          },
        },
        required: ['plan'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: TASK_COMPLETE_TOOL,
      description:
        '声明整个任务完成并终止本轮 Agent 循环。调用前必须确保：plan 全部 completed、关键 Tool 全部 verified=true、successCriteria 全部满足。' +
        '禁止用自由文本声称完成——必须调用本 Tool。校验不通过时会返回未完成项，须继续推进后重试。',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: '面向用户的交付总结（做了什么、验证结果、注意事项）',
          },
          next_steps: {
            type: 'array',
            description: '可选的下一步建议（渲染为可点击按钮）',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string', description: '按钮文案（<30 字）' },
              },
              required: ['id', 'label'],
            },
          },
          criteriaSatisfied: {
            type: 'boolean',
            description: '声明 successCriteria 是否全部满足（strict 模式下必填且须为 true）',
          },
        },
        required: ['summary'],
      },
    },
  },
  ASK_USER_OPENAI_TOOL,
];

export function registerBuiltinTools(): void {
  // 批量注册：4 个内置 Tool 一次性注册，notifyRegistryChange 只触发一次，
  // 避免冷启动 4 次注册 → 4 次 setLocalToolVersion → 4 次重渲染 → 4 次 openaiTools 重算。
  registerFunctionCalls([
    {
      name: BUILTIN_TOOL_NAME,
      description: '读取当前页面已注册的 AI Surface 快照（选中实体、表单状态等页面上下文）',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: '可选，按 domain 过滤，如 bizdata、aibase',
          },
          surfaceId: {
            type: 'string',
            description: '可选，指定 Surface id',
          },
        },
      },
      handler: async (args) => {
        let snapshots = await readAllAISurfaces();
        const domain = args.domain as string | undefined;
        const surfaceId = args.surfaceId as string | undefined;
        if (domain) {
          snapshots = snapshots.filter((item) => item.domain === domain);
        }
        if (surfaceId) {
          snapshots = snapshots.filter((item) => item.id === surfaceId);
        }
        return { surfaces: snapshots, count: snapshots.length };
      },
    },
    {
      name: UPDATE_PLAN_TOOL,
      description: HARNESS_OPENAI_TOOLS[0].function.description,
      parameters: HARNESS_OPENAI_TOOLS[0].function.parameters,
      handler: async (args) => handleUpdatePlan(args as { plan?: PlanItem[]; merge?: boolean }),
    },
    {
      name: TASK_COMPLETE_TOOL,
      description: HARNESS_OPENAI_TOOLS[1].function.description,
      parameters: HARNESS_OPENAI_TOOLS[1].function.parameters,
      handler: async (args) =>
        handleTaskComplete(args as {
          summary?: string;
          next_steps?: Array<{ id: string; label: string }>;
          criteriaSatisfied?: boolean;
        }),
    },
    {
      name: ASK_USER_TOOL,
      description: ASK_USER_OPENAI_TOOL.function.description,
      parameters: ASK_USER_OPENAI_TOOL.function.parameters,
      handler: async (args) => handleAskUser(args as AskUserArgs),
    },
  ]);
}

export function unregisterBuiltinTools(): void {
  unregisterFunctionCalls([BUILTIN_TOOL_NAME, UPDATE_PLAN_TOOL, TASK_COMPLETE_TOOL, ASK_USER_TOOL]);
}
