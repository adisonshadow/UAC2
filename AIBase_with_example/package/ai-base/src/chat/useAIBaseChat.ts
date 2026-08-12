import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { useAIChatLayout } from '../provider/context';
import { useEffectiveAIChatConfig } from '../provider/AIChatPageScope';
import { getAllFunctionCalls, getFunctionCallDef, invokeFunctionCall, subscribeFunctionCalls, toOpenAITools } from '../registry/functionRegistry';
import {
  buildAutoContinueNudge,
  shouldAutoContinueAfterTextOnly,
  decideStructuredTermination,
  buildStructuredNudge,
  reconcilePlan,
} from './autoContinuePolicy';
import { buildCombinedSystemPrompt, loadChatSkillContext } from '../registry/skillLoader';
import { resolveTerminationCompletionStrategy } from '../registry/skillPolicyRegistry';
import { mergeOpenAITools, toOpenAIToolFromMeta } from '../registry/toolManifest';
import {
  ASK_USER_OPENAI_TOOL,
  HARNESS_OPENAI_TOOLS,
  TASK_COMPLETE_TOOL,
  UPDATE_PLAN_TOOL,
} from '../registry/builtinTools';
import { isUserChoiceRequestData } from './userChoice';
import { beginTurn, getPlan, setPlan, recordInvokedTool, recordToolOutcome } from '../registry/agentPlanState';
import type { AIBaseSkill, AIBaseTool, OpenAIToolDefinition } from '../types';
import type { ToolResponse } from '../types/toolResponse';
import { isToolResponse } from '../types/toolResponse';
import type { AIBaseClient } from '../sdk/client';
import { executeToolWithEnvelope } from '../utils/executeToolWithEnvelope';
import { resolveToolStepFromEnvelope } from './resolveToolStepFromEnvelope';
import { upsertSegment, type AssistantSegment, type ChatToolStep } from './chatToolSteps';
import { createEADAFChatProvider, type EADAFChatMessage } from './EADAFChatProvider';
import { streamChatRound } from './streamToolChat';
import { resolveToolDisplayName } from '../utils/toolDisplayName';
import { runWithConcurrency } from '../utils/runWithConcurrency';
import { aggregateToolResults } from '../utils/aggregateToolResults';
import { sleep } from '../utils/sleep';
import { serializeToolResultForContext, resolveToolResultBudget } from '../utils/toolResultBudget';
import { normalizeToolResult } from '../utils/normalizeToolResult';
import { logToolInvoke } from '../utils/toolInvokeLogger';
import {
  buildMultimodalUserContent,
  formatUserDisplayWithAttachments,
} from '../utils/buildMultimodalContent';
import type { Attachment } from '@ant-design/x/es/attachments';
import {
  loadConversationMessages,
  saveConversationMessages,
} from '../storage/chatHistoryDb';
import { useDebouncedEffect } from '../storage/useDebouncedEffect';
import { extractAiChatErrorMessage, friendlifyBurstError } from '../utils/formatAiChatError';
import {
  compactHistoryForApi,
  getContextUsagePercent,
  KEEP_RECENT_MESSAGES,
} from './contextBudget';

/** 单次用户消息内，模型连续 Tool 调用的最大轮次（每轮 = 一次 LLM 请求，可含多个并行 Tool） */
const MAX_TOOL_ROUNDS = 32;

/** 检测到「只写步骤说明、未调 Tool」时，自动注入继续指令的上限 */
const MAX_AUTO_CONTINUE_NUDGES = 16;

export interface SubmitQueryOptions {
  enableThinking?: boolean;
  displayContent?: string;
  attachments?: Attachment[];
  inputTags?: string[];
  /** 外部触发发送时可指定模型，避免 selectedSlug 尚未 hydrate */
  modelSlug?: string;
}
export interface UseAIBaseChatOptions {
  /** 为 true 后才写入 IndexedDB，避免 hydration 前覆盖历史 */
  persistMessages?: boolean;
  storageNamespace?: string;
}

async function loadPersistedMessages(
  namespace: string | undefined,
  conversationKey?: string,
): Promise<Array<{ id: string; message: EADAFChatMessage; status: 'success' }>> {
  if (!namespace || !conversationKey) return [];
  const stored = await loadConversationMessages(namespace, conversationKey);
  return stored.map((item) => ({
    id: item.id,
    status: 'success' as const,
    message: item.message,
  }));
}

const LOADING_PLACEHOLDERS = new Set(['正在思考中...', '正在生成回复...']);

function isLoadingPlaceholder(text: string): boolean {
  return LOADING_PLACEHOLDERS.has(text);
}

/** 稳定序列化 Tool 参数为指纹串（用于收敛检测，key 排序保证语义稳定） */
function stableStringifyArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, Object.keys(args).sort());
  } catch {
    return JSON.stringify(args);
  }
}

async function invokeToolByMeta(
  client: AIBaseClient,
  tools: AIBaseTool[],
  functionName: string,
  args: Record<string, unknown>,
  logContext?: { conversationKey?: string; turnId?: string; round?: number },
): Promise<ToolResponse> {
  const toolMeta = tools.find((t) => t.functionName === functionName);
  const localDef = getFunctionCallDef(functionName);
  const requiresVerification =
    localDef?.requiresVerification ?? toolMeta?.requiresVerification;

  // 1. 声明为 client → 本地执行（必经路径）
  if (toolMeta?.executionType === 'client') {
    if (!localDef) {
      throw new Error(`Client Tool 未注册 handler: ${functionName}`);
    }
    return invokeFunctionCall(functionName, args, undefined, logContext);
  }

  // 2. 显式允许本地覆盖（allowClientOverride）且本地有 def → 本地执行
  if (toolMeta?.allowClientOverride && localDef) {
    return invokeFunctionCall(functionName, args, undefined, logContext);
  }

  // 3. server_http / server_builtin → 走后端
  if (toolMeta) {
    return executeToolWithEnvelope({
      side: 'server',
      name: functionName,
      args,
      requiresVerification,
      executionType: toolMeta.executionType || 'server',
      logContext,
      fn: async () => {
        const res = await client.invokeServerTool(functionName, args);
        const payload = res.result ?? res;
        if (isToolResponse(payload)) return payload;
        return payload;
      },
    });
  }

  // 4. 无 meta 但本地有 def（exposeAllClientTools 场景）→ 本地执行
  if (localDef) {
    return invokeFunctionCall(functionName, args, undefined, logContext);
  }

  throw new Error(`Tool 不可用: ${functionName}`);
}

export function useAIBaseChat(conversationKey: string, options: UseAIBaseChatOptions = {}) {
  const { persistMessages = false, storageNamespace } = options;
  const { client } = useAIChatLayout();
  const config = useEffectiveAIChatConfig();
  const provider = useMemo(
    () => createEADAFChatProvider(config.apiBase, config.getToken),
    [config.apiBase, config.getToken],
  );
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [skills, setSkills] = useState<AIBaseSkill[]>([]);
  const [topLevelSkillMarkdown, setTopLevelSkillMarkdown] = useState('');
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [localToolVersion, setLocalToolVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // 同一个 Tool 可能被关联到多个 Skill（skill↔tool 多对多），按 functionName 去重，
  // 否则最终发给 LLM 的 tools 清单会含重复名，触发 "Tool names must be unique."。
  // first-wins：保留 skill 顺序中最早出现的版本。
  const allTools = useMemo(() => {
    const map = new Map<string, AIBaseTool>();
    for (const skill of skills) {
      for (const tool of skill.tools || []) {
        if (tool.functionName && !map.has(tool.functionName)) {
          map.set(tool.functionName, tool);
        }
      }
    }
    return Array.from(map.values());
  }, [skills]);

  const allowedToolNames = useMemo(
    () => new Set(allTools.map((tool) => tool.functionName)),
    [allTools],
  );

  const openaiTools = useMemo(() => {
    const skillTools = allTools.map(toOpenAIToolFromMeta) as OpenAIToolDefinition[];
    // ask_user 始终注入（mid-task HITL）；update_plan / task_complete 仅在结构化终止开启时注入。
    // 无视当前激活的 Skill（它们是 Agent 循环的内置机制，非业务能力）。
    const harnessTools = (
      config.enableStructuredTermination
        ? HARNESS_OPENAI_TOOLS
        : [ASK_USER_OPENAI_TOOL]
    ) as unknown as OpenAIToolDefinition[];
    // 始终经过 mergeOpenAITools：既保证按 function.name 去重（防御性），
    // 又在开启 exposeAllClientTools 时让本地 client tool 覆盖 DB schema。
    // harness Tool 放在 localTools 之前，允许同名 local def 覆盖（一般不需要）。
    const localTools = config.exposeAllClientTools
      ? (toOpenAITools(getAllFunctionCalls()) as OpenAIToolDefinition[])
      : [];
    return mergeOpenAITools([...skillTools, ...harnessTools], localTools);
  }, [allTools, config.exposeAllClientTools, config.enableStructuredTermination, localToolVersion]);

  // exposeAllClientTools 逃生舱告警：仅在首次开启时输出一次，提醒不要用于生产。
  const warnedExposeAllRef = useRef(false);
  if (config.exposeAllClientTools && !warnedExposeAllRef.current) {
    warnedExposeAllRef.current = true;
    console.warn(
      '[AIBase] exposeAllClientTools 已启用：将向 LLM 暴露全部本地 client Tool，忽略 Skill 关联限制。仅建议调试环境使用，生产请通过 Skill 关联 Tool 控制可见性。',
    );
  }

  useEffect(() => subscribeFunctionCalls(() => setLocalToolVersion((v) => v + 1)), []);

  const systemPrompt = useMemo(
    () => buildCombinedSystemPrompt(skills, config, topLevelSkillMarkdown),
    [skills, config, topLevelSkillMarkdown],
  );

  useEffect(() => {
    let mounted = true;
    setSkillsLoading(true);
    loadChatSkillContext(client, config)
      .then((loaded) => {
        if (mounted) {
          setSkills(loaded.skills);
          setTopLevelSkillMarkdown(loaded.topLevelSkillMarkdown);
        }
      })
      .finally(() => {
        if (mounted) setSkillsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [client, config]);

  // 水合锁：挂载后异步从 IndexedDB 读取历史并注入 store。
  // —— 把 defaultMessages 从「store 构造期异步读 IDB」改为「挂载后 effect 读」，
  //    避免 store 冷启动时 defaultMessagesRequesting 在数百毫秒内反复 emit 触发渲染抖动。
  // hydratedRef.current=false 期间，持久化 effect 不会写回 IDB，防止用空消息覆盖历史。
  const hydratedRef = useRef(false);

  const chat = useXChat({
    provider,
    conversationKey,
    // 同步返回空数组：store 的 initializeMessages 仍会 emit，但两次 emit 紧贴在一个
    // microtask 内快速 settle，不再有「等待 IDB 读盘」造成的数百毫秒渲染抖动窗口。
    // 历史水合改由下面的挂载 effect 负责。
    defaultMessages: () => [],
    requestPlaceholder: () => ({ role: 'assistant' as const, content: '正在思考中...' }),
    requestFallback: (_, { error, messageInfo }) => {
      if (error.name === 'AbortError') {
        return {
          role: 'assistant' as const,
          content: messageInfo?.message?.content || '已取消回复',
        };
      }
      const msg = friendlifyBurstError(extractAiChatErrorMessage(error));
      if (msg.includes('content-type') && msg.includes('not support')) {
        return {
          role: 'assistant' as const,
          content: 'AI 服务返回异常（非 JSON/SSE），请检查 Provider API Key 与 base_url 配置是否正确',
        };
      }
      return {
        role: 'assistant' as const,
        content: msg || '请求失败，请稍后重试',
      };
    },
  });

  const { messages, setMessages, isRequesting: chatRequesting, abort: chatAbort, isDefaultMessagesRequesting } = chat;

  // messages 的同步镜像：submitQuery 仅在「调用时」读取当前 messages（构建 history），
  // 不需要在 messages 变化时重建 callback。用 ref 读取即可移除依赖，避免每个流式 chunk
  // 都重建 submitQuery 及其下游闭包。通过 effect 同步，符合 React 19 禁止在 render 期写 ref 的约束。
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const contextUsagePercent = useMemo(() => {
    const history = messages.map((item) => item.message as EADAFChatMessage);
    return getContextUsagePercent(history, systemPrompt);
  }, [messages, systemPrompt]);

  useDebouncedEffect(
    () => {
      if (!persistMessages || !storageNamespace || !conversationKey) return;
      if (isDefaultMessagesRequesting) return;
      // 水合未完成前不写回：此时 messages 可能为空，写入会覆盖 IDB 里的历史。
      if (!hydratedRef.current) return;
      void saveConversationMessages(storageNamespace, conversationKey, messages);
    },
    [persistMessages, storageNamespace, conversationKey, messages, isDefaultMessagesRequesting],
    400,
  );

  // 历史水合：挂载后（或切换会话时）异步从 IndexedDB 读取历史，一次性注入 store。
  // 与原 defaultMessages 异步读盘相比：store 不再在构造期承担异步读盘 + 反复 emit，
  // 水合动作收敛为一次 setMessages，渲染抖动窗口显著收窄。
  // 幂等：用 hydratedRef 保证每个会话只注入一次，避免 StrictMode 双挂载 / store 缓存预填
  // 导致 persisted 被反复追加（曾出现历史被复制成 4×4 的脏数据）。
  useEffect(() => {
    // 未开启持久化 / 无会话 key：无需水合，直接标记为已水合，放开持久化 gate。
    if (!persistMessages || !storageNamespace || !conversationKey) {
      hydratedRef.current = true;
      return undefined;
    }
    let cancelled = false;
    hydratedRef.current = false;
    // 本轮水合的幂等锁：即使 .then 被多次触发也只注入一次
    let injected = false;
    loadPersistedMessages(storageNamespace, conversationKey)
      .then((persisted) => {
        if (cancelled || injected) return;
        injected = true;
        if (persisted.length === 0) return;
        // 幂等替换：直接用持久化历史替换 store，绝不追加。
        // 水合发生在挂载后、用户发消息前；若 store 已被缓存预填（chatMessagesStoreHelper），
        // 替换它正是期望行为（重新水合当前会话的真实历史）。
        setMessages(persisted);
      })
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // 切换会话需重新水合：依赖 conversationKey / storageNamespace。
    // setMessages 来自 useXChat，引用稳定（其内部用 useCallback）。
  }, [persistMessages, storageNamespace, conversationKey, setMessages]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    chatAbort();
  }, [chatAbort]);

  const submitQuery = useCallback(
    async (query: string, options?: SubmitQueryOptions) => {
      const slug = options?.modelSlug ?? selectedSlug;
      if (!slug) throw new Error('请先选择模型');
      if (skillsLoading) throw new Error('Skill/Tool 正在加载，请稍候');
      if (!openaiTools.length) {
        throw new Error('未加载到 Skill/Tool，请确认已配置 applicationId 或本地 fallbackSkillSlugs');
      }

      const enableThinking = Boolean(options?.enableThinking);
      const displayText = options?.displayContent ?? query;
      const { content: apiContent, attachmentMeta } = await buildMultimodalUserContent(
        query,
        options?.attachments || [],
        options?.inputTags,
      );
      const bubbleContent = formatUserDisplayWithAttachments(displayText, attachmentMeta);

      abortRef.current = new AbortController();
      setStreaming(true);

      // 用 UUID 生成消息 id，避免 Date.now()+偏移 在快速重发/StrictMode 双调用/
      // 自动续跑等场景下产生相同 key（曾出现 Bubble.List "two children with same key" 报错）。
      const userId = `user-${crypto.randomUUID()}`;
      const assistantId = `assistant-${crypto.randomUUID()}`;
      let history = messagesRef.current.map((item) => {
        const msg = item.message as EADAFChatMessage;
        return {
          ...msg,
          content: msg.apiContent ?? msg.content,
        };
      });

      const compactResult = compactHistoryForApi(history);
      if (compactResult.compacted) {
        history = compactResult.history.filter(
          (item) =>
            item.role !== 'system' ||
            !String(item.content).startsWith('[Context compacted]'),
        );
        setMessages((ori) => {
          const chatMessages = ori.filter(
            (item) => item.message.role === 'user' || item.message.role === 'assistant',
          );
          return chatMessages.slice(-KEEP_RECENT_MESSAGES);
        });
      }

      const loadingText = enableThinking ? '正在思考中...' : '正在生成回复...';

      const userMessage: EADAFChatMessage = {
        role: 'user',
        content: bubbleContent,
        apiContent,
        ...(attachmentMeta.length ? { attachments: attachmentMeta } : {}),
      };

      setMessages((ori) => [
        ...ori,
        { id: userId, message: userMessage, status: 'success' as const },
        {
          id: assistantId,
          message: { role: 'assistant' as const, content: loadingText },
          status: 'loading' as const,
        },
      ]);

      let loopMessages: EADAFChatMessage[] = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...(compactResult.compacted ? compactResult.history : history),
        { role: 'user', content: apiContent },
      ];

      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let currentRoundContent = '';
      let currentRoundReasoning = '';
      let assistantDisplayContent = '';
      /** 本轮回复的有序 segment 视图；与 content 平行维护，供 UI 按输出顺序渲染 */
      let assistantSegments: AssistantSegment[] = [];

      /** 把本轮文本 upsert 到 segments（同 id 反复更新，保持位置稳定，避免碎片化） */
      const upsertRoundTextSegment = (round: number, text: string) => {
        const trimmed = text.trim();
        assistantSegments = upsertSegment(assistantSegments, {
          kind: 'text',
          id: `text-round-${round}`,
          content: trimmed,
        });
      };

      const resolveDisplayContent = (fallback?: string): string => {
        const fromRef = assistantDisplayContent.trim();
        if (fromRef) return fromRef;
        const fb = typeof fallback === 'string' ? fallback.trim() : '';
        if (fb && !isLoadingPlaceholder(fb) && fb !== loadingText) return fb;
        return '';
      };

      const mergeRoundContent = (roundContent: string): string => {
        if (accumulatedContent) {
          return roundContent ? `${accumulatedContent}\n\n${roundContent}` : accumulatedContent;
        }
        return roundContent;
      };

      const mergeRoundReasoning = (roundReasoning: string): string | undefined => {
        if (!enableThinking) return undefined;
        const merged = [accumulatedReasoning, roundReasoning].filter(Boolean).join('\n\n');
        return merged || undefined;
      };

      type AssistantMessageStatus = 'loading' | 'updating' | 'success' | 'error' | 'abort';

      const patchAssistantMessage = (
        patch: {
          content?: string;
          reasoningContent?: string;
          segments?: AssistantSegment[];
        },
        opts?: { status?: AssistantMessageStatus },
      ) => {
        setMessages((ori) =>
          ori.map((item) => {
            if (item.id !== assistantId) return item;
            const prev = item.message as EADAFChatMessage & {
              reasoningContent?: string;
              segments?: AssistantSegment[];
            };
            const content =
              patch.content !== undefined
                ? patch.content
                : resolveDisplayContent(typeof prev.content === 'string' ? prev.content : '');
            if (content.trim()) {
              assistantDisplayContent = content;
            }
            const segments = patch.segments ?? prev.segments;
            const reasoningContent =
              patch.reasoningContent !== undefined
                ? patch.reasoningContent
                : prev.reasoningContent;
            const hasBody = !!content.trim() || !!segments?.length;
            const status = opts?.status ?? (hasBody ? 'updating' : 'loading');

            return {
              ...item,
              status,
              message: {
                ...prev,
                role: 'assistant' as const,
                content,
                ...(reasoningContent ? { reasoningContent } : {}),
                ...(segments?.length ? { segments } : {}),
              },
            };
          }),
        );
      };

      // 结构化终止：本回合 harness 上下文清理句柄。在 try 之前声明，
      // 保证 finally 能稳定访问（即使 try 体内 beginTurn 前就抛错）。
      let endTurn: (() => void) | null = null;

      try {
        const structuredTermination = config.enableStructuredTermination;
        let lastRoundHadToolCalls = false;
        let toolsExecutedThisTurn = 0;
        let autoContinueNudges = 0;
        const invokedToolNames = new Set<string>();
        const toolOutcomes: ToolResponse[] = [];
        const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // 结构化终止：本回合的权威 plan 状态。由 update_plan Tool 维护，
        // task_complete / 每轮对账 / nudge 读取（经 getPlan() 取最新值）。结构化终止关闭时不用。
        // 最近一次 task_complete 的返回：verified=true 才允许终止
        let lastTaskCompleteVerified: boolean | null = null;
        // 收敛检测：最近若干轮的 (toolName + argsHash) 签名 + 最近若干次错误指纹
        const recentToolSignatures: string[] = [];
        const recentErrorFingerprints: string[] = [];
        const CONVERGENCE_WINDOW = 3;
        // 当前页主 Skill 的完成策略（禁止跨 Skill 并集 requiredTools，避免查询页被写操作清单误伤）
        const activeCompletionStrategy = resolveTerminationCompletionStrategy(
          skills,
          config.fallbackSkillSlugs,
        );

        // Planning next moves：结构化执行过程的可视化段（用户可感知的“接下来做什么”）
        const PLANNING_SEGMENT_ID = 'planning-next-moves-latest';
        const upsertPlanningSegment = (plan: ReturnType<typeof getPlan>): void => {
          if (!structuredTermination) return;

          const isQueryTask = Boolean(activeCompletionStrategy?.allowDirectAnswerTermination);
          const maxItems = isQueryTask ? 1 : 3;

          const inProgress = plan.find((p) => p.status === 'in_progress');
          const pending = plan.filter((p) => p.status === 'pending');
          const completed = plan.filter((p) => p.status === 'completed');

          const picked: typeof plan = [];
          if (inProgress && picked.length < maxItems) picked.push(inProgress);
          for (const p of pending) {
            if (picked.length >= maxItems) break;
            picked.push(p);
          }
          if (picked.length === 0 && completed[0]) {
            picked.push(completed[0]);
          }

          const items = picked.map((p) => ({
            id: p.id,
            label: p.content,
            status: p.status,
          }));

          const lead = picked[0];
          const lastNonHarnessToolOutcome = [...toolOutcomes].reverse().find(
            (o) => ![UPDATE_PLAN_TOOL, TASK_COMPLETE_TOOL].includes(o.meta.tool),
          );
          const shouldShowRetryHint =
            lastNonHarnessToolOutcome &&
            (lastNonHarnessToolOutcome.kind !== 'success' ||
              lastNonHarnessToolOutcome.ok === false ||
              lastNonHarnessToolOutcome.verified === false);

          assistantSegments = upsertSegment(assistantSegments, {
            kind: 'planning',
            id: PLANNING_SEGMENT_ID,
            title: 'Planning next moves',
            items,
            hint: shouldShowRetryHint && lead ? `接下来准备重试：${lead.content}` : undefined,
          });
        };

        // 注入本回合上下文给 harness Tool handler（task_complete / update_plan）
        endTurn = beginTurn({
          plan: [],
          toolOutcomes,
          invokedToolNames,
          completionStrategy: activeCompletionStrategy,
          availableToolNames: allowedToolNames,
        });

        /**
         * 收敛检测：识别「原地打转」——同一签名连续出现，或同一错误连续重复。
         * 命中时返回 {kind, detail}，未命中返回 null。
         */
        const detectConvergence = ():
          | { kind: 'repeat-tool' | 'repeat-error'; detail: string }
          | null => {
          // 同一签名连续出现 CONVERGENCE_WINDOW 次
          const sigs = recentToolSignatures;
          if (sigs.length >= CONVERGENCE_WINDOW) {
            const tail = sigs.slice(-CONVERGENCE_WINDOW);
            if (tail.every((s) => s === tail[0])) {
              return { kind: 'repeat-tool', detail: `连续 ${CONVERGENCE_WINDOW} 次调用 ${tail[0]}` };
            }
          }
          // 同一错误指纹连续出现 CONVERGENCE_WINDOW 次（忽略 __ok__ 哨兵）
          const errs = recentErrorFingerprints.filter((e) => e !== '__ok__');
          if (errs.length >= CONVERGENCE_WINDOW) {
            const tail = errs.slice(-CONVERGENCE_WINDOW);
            if (tail.every((e) => e === tail[0])) {
              return { kind: 'repeat-error', detail: `连续 ${CONVERGENCE_WINDOW} 次相同错误 ${tail[0]}` };
            }
          }
          return null;
        };

        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          currentRoundContent = '';
          currentRoundReasoning = '';

          if (round > 0) {
            // 轮次间最小间隔：把"零间隔连发"打散成"每秒约 1-2 次"，
            // 避免单次用户消息内的续接循环密集打穿上游 Provider 突发保护。
            // 可被用户取消（abort）立即中断，不卡满整个 delay。
            await sleep(config.roundDelayMs, abortRef.current?.signal);

            patchAssistantMessage(
              {
                content: mergeRoundContent(''),
                reasoningContent: mergeRoundReasoning(''),
                segments: assistantSegments,
              },
              { status: 'updating' },
            );
          }

          const result = await streamChatRound(
            {
              slug,
              messages: loopMessages,
              tools: openaiTools.length ? openaiTools : undefined,
              enableThinking,
              signal: abortRef.current?.signal,
              apiBase: config.apiBase,
              getToken: config.getToken,
            },
            ({ content, reasoningContent }) => {
              currentRoundContent = content;
              currentRoundReasoning = reasoningContent;
              const mergedContent = mergeRoundContent(content);
              if (mergedContent.trim()) {
                assistantDisplayContent = mergedContent;
              }
              // 本轮文本写成本轮专属 segment，保证多轮间文本与工具按顺序交错
              upsertRoundTextSegment(round, content);
              patchAssistantMessage(
                {
                  content: mergedContent || assistantDisplayContent,
                  reasoningContent: mergeRoundReasoning(reasoningContent),
                  segments: assistantSegments,
                },
                { status: 'updating' },
              );
            },
          );

          const roundText = result.content.trim() || currentRoundContent.trim();
          const roundReasoning = result.reasoningContent.trim() || currentRoundReasoning.trim();

          if (!result.toolCalls.length) {
            lastRoundHadToolCalls = false;
            const finalContent = accumulatedContent
              ? roundText
                ? `${accumulatedContent}\n\n${roundText}`.trim()
                : accumulatedContent
              : roundText || '（无文本回复）';

            // ── 结构化终止分支：信号反转（默认续命，task_complete verified=true 才停）──
            if (structuredTermination) {
              const decision = decideStructuredTermination({
                lastTaskCompleteVerified,
                autoContinueNudges,
                round,
                finishReason: result.finishReason,
                latestText: roundText,
                convergenceDetected: detectConvergence(),
                plan: getPlan(),
                completionStrategy: activeCompletionStrategy,
                toolsExecuted: toolsExecutedThisTurn,
                toolOutcomes,
              });

              // 终止原因埋点：terminate / continue / hard-stop 命中路径
              logToolInvoke({
                side: 'client',
                name: `ai_termination_reason:${decision.action}`,
                args: {
                  conversationKey,
                  turnId,
                  round,
                  skillSlugs: skills.map((s) => s.slug),
                  reason: decision.action === 'hard-stop' ? decision.reason : undefined,
                },
                success: false, // 复用 tool-invoke 日志落盘链路（失败才持久化）
                durationMs: 0,
                error: decision.action === 'hard-stop' ? decision.reason : undefined,
                conversationKey,
                turnId,
                round,
              });

              if (decision.action === 'terminate') {
                // task_complete 已通过：正常终止
                const finalReasoning =
                  enableThinking && (accumulatedReasoning || roundReasoning)
                    ? [accumulatedReasoning, roundReasoning].filter(Boolean).join('\n\n')
                    : undefined;
                assistantDisplayContent = finalContent;
                if (roundText) upsertRoundTextSegment(round, roundText);
                patchAssistantMessage(
                  {
                    content: finalContent,
                    reasoningContent: finalReasoning,
                    segments: assistantSegments,
                  },
                  { status: 'success' },
                );
                return finalContent;
              }

              if (decision.action === 'hard-stop') {
                // 命中硬停止：终止并附原因
                const annotated = `${finalContent}\n\n⚠️ ${decision.reason}`;
                assistantDisplayContent = annotated;
                if (roundText) upsertRoundTextSegment(round, roundText);
                patchAssistantMessage(
                  { content: annotated, segments: assistantSegments },
                  { status: 'success' },
                );
                return annotated;
              }

              // continue：注入基于剩余 plan 的 nudge，并先做一次 plan 对账
              autoContinueNudges += 1;
              const currentPlanSnapshot = getPlan();
              const reconciled = reconcilePlan(currentPlanSnapshot, toolOutcomes);
              // 对账结果回写 holder（供 task_complete / 后续 nudge 读取）
              if (reconciled !== currentPlanSnapshot) {
                setPlan(reconciled);
              }

              // 每轮对账后更新 Planning next moves
              upsertPlanningSegment(getPlan());

              if (finalContent) {
                accumulatedContent = finalContent;
                assistantDisplayContent = finalContent;
                loopMessages.push({ role: 'assistant', content: finalContent });
              }
              if (roundText) upsertRoundTextSegment(round, roundText);
              loopMessages.push({
                role: 'user',
                content: buildStructuredNudge(getPlan(), toolOutcomes),
              });
              patchAssistantMessage(
                {
                  content: finalContent,
                  reasoningContent:
                    enableThinking && roundReasoning
                      ? mergeRoundReasoning(roundReasoning)
                      : undefined,
                  segments: assistantSegments,
                },
                { status: 'updating' },
              );
              continue;
            }

            // ── 传统 auto-continue 分支（灰度关闭时保持原行为）──
            const autoContinueCtx = {
              skills,
              allowedToolNames,
              invokedToolNames,
              toolsExecuted: toolsExecutedThisTurn,
              text: finalContent,
              /** 语言模式只看本轮纯文本，避免早期「第N步」毒化收尾汇总 */
              latestText: roundText,
              toolOutcomes,
            };

            if (
              autoContinueNudges < MAX_AUTO_CONTINUE_NUDGES &&
              shouldAutoContinueAfterTextOnly(autoContinueCtx)
            ) {
              autoContinueNudges += 1;
              if (finalContent) {
                accumulatedContent = finalContent;
                assistantDisplayContent = finalContent;
                loopMessages.push({ role: 'assistant', content: finalContent });
              }
              if (roundText) upsertRoundTextSegment(round, roundText);
              loopMessages.push({
                role: 'user',
                content: buildAutoContinueNudge(allowedToolNames, skills, toolOutcomes),
              });
              patchAssistantMessage(
                {
                  content: finalContent,
                  reasoningContent:
                    enableThinking && roundReasoning
                      ? mergeRoundReasoning(roundReasoning)
                      : undefined,
                  segments: assistantSegments,
                },
                { status: 'updating' },
              );
              continue;
            }

            const finalReasoning =
              enableThinking && (accumulatedReasoning || roundReasoning)
                ? [accumulatedReasoning, roundReasoning].filter(Boolean).join('\n\n')
                : undefined;

            assistantDisplayContent = finalContent;
            if (roundText) upsertRoundTextSegment(round, roundText);
            patchAssistantMessage(
              {
                content: finalContent,
                reasoningContent: finalReasoning,
                segments: assistantSegments,
              },
              { status: 'success' },
            );
            return finalContent;
          }

          lastRoundHadToolCalls = true;

          if (roundText) {
            accumulatedContent = accumulatedContent
              ? `${accumulatedContent}\n\n${roundText}`
              : roundText;
            assistantDisplayContent = accumulatedContent;
            // 本轮文本（工具调用前）落成本轮 segment，保证其在后续工具段之前
            upsertRoundTextSegment(round, roundText);
          }
          if (enableThinking && roundReasoning) {
            accumulatedReasoning = accumulatedReasoning
              ? `${accumulatedReasoning}\n\n${roundReasoning}`
              : roundReasoning;
          }

          patchAssistantMessage(
            {
              content: accumulatedContent || assistantDisplayContent,
              reasoningContent:
                enableThinking && accumulatedReasoning ? accumulatedReasoning : undefined,
              segments: assistantSegments,
            },
            { status: 'updating' },
          );

          loopMessages = [...loopMessages, result.assistantMessage as unknown as EADAFChatMessage];

          // 同一轮内多个 tool_calls 通常彼此独立，可并发执行（上限 TOOLS_CONCURRENCY），
          // 显著降低多工具场景下的端到端延迟。每个 call 用唯一 stepId，upsertSegment 按 id
          // 就地更新，并发不互相干扰。
          const TOOLS_CONCURRENCY = 6;

          // 把单条工具调用（loading → 执行 → success/error）封装为独立函数，
          // 返回要回灌 loopMessages 的 role:'tool' 消息（按预算序列化结果）。
          const executeOneToolCall = async (
            call: { id?: string; function?: { name?: string; arguments?: string } },
          ): Promise<EADAFChatMessage> => {
            const functionName = call.function?.name || 'unknown_tool';
            const stepId = call.id || `${functionName}-${Date.now()}`;
            const displayName = resolveToolDisplayName(functionName, allTools);

            const appendToolStep = (step: ChatToolStep) => {
              assistantSegments = upsertSegment(assistantSegments, {
                kind: 'tool',
                id: step.id,
                step,
              });

              // update_plan 成功后展示 Planning next moves（查询/写操作都适用）
              if (structuredTermination && functionName === UPDATE_PLAN_TOOL && step.status === 'success') {
                upsertPlanningSegment(getPlan());
              }

              setMessages((ori) =>
                ori.map((item) => {
                  if (item.id !== assistantId) return item;
                  const prev = item.message as EADAFChatMessage & {
                    reasoningContent?: string;
                    segments?: AssistantSegment[];
                  };
                  const content = resolveDisplayContent(
                    typeof prev.content === 'string' ? prev.content : '',
                  );
                  if (content.trim()) {
                    assistantDisplayContent = content;
                  }
                  return {
                    ...item,
                    status: 'updating' as const,
                    message: {
                      ...prev,
                      role: 'assistant' as const,
                      content,
                      ...(enableThinking && accumulatedReasoning
                        ? { reasoningContent: accumulatedReasoning }
                        : prev.reasoningContent
                          ? { reasoningContent: prev.reasoningContent }
                          : {}),
                      segments: assistantSegments,
                    },
                  };
                }),
              );
            };

            appendToolStep({
              id: stepId,
              functionName,
              displayName,
              status: 'loading',
            });

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.function?.arguments || '{}');
            } catch {
              args = {};
            }

            const startedAt = Date.now();
            invokedToolNames.add(functionName);
            recordInvokedTool(functionName);
            toolsExecutedThisTurn += 1;

            const toolMeta = allTools.find((t) => t.functionName === functionName);
            const budget = resolveToolResultBudget(
              getFunctionCallDef(functionName),
              toolMeta,
              config.maxToolResultChars,
            );

            // 收敛检测：记录本次调用的签名（toolName + 参数指纹）
            const argsFingerprint = stableStringifyArgs(args).slice(0, 120);
            recentToolSignatures.push(`${functionName}::${argsFingerprint}`);

            try {
              const envelope = await invokeToolByMeta(client, allTools, functionName, args, {
                conversationKey,
                turnId,
                round,
              });
              toolOutcomes.push(envelope);
              recordToolOutcome(envelope);

              // 结构化终止：跟踪 task_complete 的校验结果
              if (structuredTermination && functionName === TASK_COMPLETE_TOOL) {
                lastTaskCompleteVerified = envelope.verified === true;
              }
              // 收敛检测：记录错误指纹（成功则推入哨兵，打断「连续相同错误」计数）
              // user_choice_request 是合法挂起，不当作错误
              if (
                envelope.kind === 'user_choice_request' ||
                (envelope.kind === 'success' && envelope.verified !== false)
              ) {
                recentErrorFingerprints.push('__ok__');
              } else {
                recentErrorFingerprints.push(
                  `${functionName}::${envelope.error?.message?.slice(0, 80) ?? envelope.kind}`,
                );
              }

              const stepOutcome = resolveToolStepFromEnvelope(envelope);
              appendToolStep({
                id: stepId,
                functionName,
                displayName,
                status: stepOutcome.status,
                durationMs: Date.now() - startedAt,
                error: stepOutcome.error,
              });

              // ask_user：写入 Choice Card segment（挂起在工具轮结束后统一 hard-stop）
              if (
                envelope.kind === 'user_choice_request' &&
                isUserChoiceRequestData(envelope.data)
              ) {
                const req = envelope.data;
                assistantSegments = upsertSegment(assistantSegments, {
                  kind: 'user_choice',
                  id: `user-choice-${req.requestId}`,
                  requestId: req.requestId,
                  question: req.question,
                  mode: req.mode,
                  options: req.options,
                  allowCustom: req.allowCustom,
                  minSelect: req.minSelect,
                  ...(req.maxSelect != null ? { maxSelect: req.maxSelect } : {}),
                });
              }

              return {
                role: 'tool',
                content: serializeToolResultForContext(envelope, budget),
                tool_call_id: call.id,
                name: functionName,
              };
            } catch (toolError) {
              const errorMessage =
                toolError instanceof Error ? toolError.message : 'Tool 执行失败';
              const envelope = normalizeToolResult({
                tool: functionName,
                thrownError: toolError,
                durationMs: Date.now() - startedAt,
              });
              toolOutcomes.push(envelope);
              recordToolOutcome(envelope);
              recentErrorFingerprints.push(`${functionName}::${errorMessage.slice(0, 80)}`);

              appendToolStep({
                id: stepId,
                functionName,
                displayName,
                status: 'error',
                durationMs: Date.now() - startedAt,
                error: errorMessage,
              });
              return {
                role: 'tool',
                content: serializeToolResultForContext(envelope, budget),
                tool_call_id: call.id,
                name: functionName,
              };
            }
          };

          const toolMessages = await runWithConcurrency(
            result.toolCalls,
            TOOLS_CONCURRENCY,
            executeOneToolCall,
          );
          // 阶段 E：同性质批量结果聚合——把同名 Tool 的批量结果压缩成摘要，
          // 只压缩回灌 LLM 的上下文（UI 段 assistantSegments 不变，用户仍看到每步）。
          // 合并所有 Skill 声明的 resultAggregation.tools，按 name 触发。
          const aggregationTools = new Set<string>();
          let aggregationMinBatch: number | undefined;
          for (const s of skills) {
            const ra = s.completionStrategy?.resultAggregation;
            if (ra?.tools) for (const t of ra.tools) aggregationTools.add(t);
            if (ra?.minBatchSize) aggregationMinBatch = ra.minBatchSize;
          }
          const aggregated =
            aggregationTools.size > 0
              ? aggregateToolResults(toolMessages, {
                  resultAggregation: {
                    tools: Array.from(aggregationTools),
                    ...(aggregationMinBatch ? { minBatchSize: aggregationMinBatch } : {}),
                  },
                })
              : toolMessages;
          loopMessages.push(...aggregated);

          // ask_user 已登记 Choice Card → hard-stop，等用户提交后再续跑
          const pendingChoice = toolOutcomes.find(
            (item) =>
              item.kind === 'user_choice_request' && isUserChoiceRequestData(item.data),
          );
          if (pendingChoice) {
            logToolInvoke({
              side: 'client',
              name: 'ai_termination_reason:hard-stop',
              args: {
                conversationKey,
                turnId,
                round,
                skillSlugs: skills.map((s) => s.slug),
                reason: 'waiting_user_choice',
              },
              success: false,
              durationMs: 0,
              error: 'waiting_user_choice',
              conversationKey,
              turnId,
              round,
            });
            const pausedContent = accumulatedContent || assistantDisplayContent || '';
            assistantDisplayContent = pausedContent;
            patchAssistantMessage(
              {
                content: pausedContent,
                reasoningContent:
                  enableThinking && accumulatedReasoning ? accumulatedReasoning : undefined,
                segments: assistantSegments,
              },
              { status: 'success' },
            );
            return pausedContent;
          }
        }

        const roundLimitNote = lastRoundHadToolCalls
          ? `\n\n⚠️ 本轮 Tool 调用已达上限（${MAX_TOOL_ROUNDS} 轮），索引/关系/校验等可能尚未完成。请回复「继续」以接着执行。`
          : '';
        const finalContent =
          (accumulatedContent || assistantDisplayContent || '（无文本回复）') + roundLimitNote;
        assistantDisplayContent = finalContent;
        patchAssistantMessage(
          { content: finalContent, segments: assistantSegments },
          { status: 'success' },
        );
        return accumulatedContent;
      } catch (error) {
        const message = friendlifyBurstError(extractAiChatErrorMessage(error));
        const isAbort = error instanceof Error && error.name === 'AbortError';

        patchAssistantMessage(
          { content: isAbort ? '已取消回复' : message, segments: assistantSegments },
          { status: isAbort ? 'abort' : 'error' },
        );

        if (!isAbort) throw error;
        return '';
      } finally {
        endTurn?.();
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      allTools,
      allowedToolNames,
      client,
      config,
      openaiTools,
      selectedSlug,
      setMessages,
      skills,
      skillsLoading,
      systemPrompt,
    ],
  );

  return {
    messages,
    setMessages,
    isRequesting: streaming || chatRequesting,
    abort,
    selectedSlug,
    setSelectedSlug,
    skills,
    skillsLoading,
    openaiTools,
    systemPrompt,
    submitQuery,
    contextUsagePercent,
  };
}
