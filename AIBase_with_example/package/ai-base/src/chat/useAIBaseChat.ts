import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { useAIChatLayout } from '../provider/context';
import { useEffectiveAIChatConfig } from '../provider/AIChatPageScope';
import { getAllFunctionCalls, getFunctionCallDef, invokeFunctionCall, subscribeFunctionCalls, toOpenAITools } from '../registry/functionRegistry';
import { buildAutoContinueNudge, shouldAutoContinueAfterTextOnly } from './autoContinuePolicy';
import { buildCombinedSystemPrompt, loadChatSkillContext } from '../registry/skillLoader';
import { mergeOpenAITools, toOpenAIToolFromMeta } from '../registry/toolManifest';
import type { AIBaseSkill, AIBaseTool, OpenAIToolDefinition } from '../types';
import type { AIBaseClient } from '../sdk/client';
import { upsertSegment, type AssistantSegment, type ChatToolStep } from './chatToolSteps';
import { createEADAFChatProvider, type EADAFChatMessage } from './EADAFChatProvider';
import { streamChatRound } from './streamToolChat';
import { resolveToolDisplayName } from '../utils/toolDisplayName';
import { runWithConcurrency } from '../utils/runWithConcurrency';
import { sleep } from '../utils/sleep';
import { withToolInvokeLog } from '../utils/toolInvokeLogger';
import { serializeToolResultForContext, resolveToolResultBudget } from '../utils/toolResultBudget';
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

async function invokeToolByMeta(
  client: AIBaseClient,
  tools: AIBaseTool[],
  functionName: string,
  args: Record<string, unknown>,
) {
  const toolMeta = tools.find((t) => t.functionName === functionName);
  const localDef = getFunctionCallDef(functionName);

  // 1. 声明为 client → 本地执行（必经路径）
  if (toolMeta?.executionType === 'client') {
    if (!localDef) {
      throw new Error(`Client Tool 未注册 handler: ${functionName}`);
    }
    return invokeFunctionCall(functionName, args);
  }

  // 2. 显式允许本地覆盖（allowClientOverride）且本地有 def → 本地执行
  if (toolMeta?.allowClientOverride && localDef) {
    return invokeFunctionCall(functionName, args);
  }

  // 3. server_http / server_builtin → 走后端（按声明执行，本地同名 def 不再隐式拦截）。
  //    走到这里时 executionType 必非 'client'（已被分支 1 拦截），无需重复比较。
  if (toolMeta) {
    return withToolInvokeLog(
      'server',
      functionName,
      args,
      async () => {
        const res = await client.invokeServerTool(functionName, args);
        return res.result ?? res;
      },
      { executionType: toolMeta.executionType || 'server' },
    );
  }

  // 4. 无 meta 但本地有 def（exposeAllClientTools 场景）→ 本地执行
  if (localDef) {
    return invokeFunctionCall(functionName, args);
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
    // 始终经过 mergeOpenAITools：既保证按 function.name 去重（防御性），
    // 又在开启 exposeAllClientTools 时让本地 client tool 覆盖 DB schema。
    const localTools = config.exposeAllClientTools
      ? (toOpenAITools(getAllFunctionCalls()) as OpenAIToolDefinition[])
      : [];
    return mergeOpenAITools(skillTools, localTools);
  }, [allTools, config.exposeAllClientTools, localToolVersion]);

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

  const chat = useXChat({
    provider,
    conversationKey,
    defaultMessages: async (info?: { conversationKey?: string }) =>
      loadPersistedMessages(storageNamespace, info?.conversationKey),
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

  const contextUsagePercent = useMemo(() => {
    const history = messages.map((item) => item.message as EADAFChatMessage);
    return getContextUsagePercent(history, systemPrompt);
  }, [messages, systemPrompt]);

  useDebouncedEffect(
    () => {
      if (!persistMessages || !storageNamespace || !conversationKey) return;
      if (isDefaultMessagesRequesting) return;
      void saveConversationMessages(storageNamespace, conversationKey, messages);
    },
    [persistMessages, storageNamespace, conversationKey, messages, isDefaultMessagesRequesting],
    400,
  );

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

      const userId = `user-${Date.now()}`;
      const assistantId = `assistant-${Date.now() + 1}`;
      let history = messages.map((item) => {
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

      try {
        let lastRoundHadToolCalls = false;
        let toolsExecutedThisTurn = 0;
        let autoContinueNudges = 0;
        const invokedToolNames = new Set<string>();

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

            const autoContinueCtx = {
              skills,
              allowedToolNames,
              invokedToolNames,
              toolsExecuted: toolsExecutedThisTurn,
              text: finalContent,
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
                content: buildAutoContinueNudge(allowedToolNames, skills),
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
            toolsExecutedThisTurn += 1;

            const toolMeta = allTools.find((t) => t.functionName === functionName);
            const budget = resolveToolResultBudget(
              getFunctionCallDef(functionName),
              toolMeta,
              config.maxToolResultChars,
            );

            try {
              const toolResult = await invokeToolByMeta(client, allTools, functionName, args);
              appendToolStep({
                id: stepId,
                functionName,
                displayName,
                status: 'success',
                durationMs: Date.now() - startedAt,
              });
              return {
                role: 'tool',
                content: serializeToolResultForContext(toolResult, budget),
                tool_call_id: call.id,
                name: functionName,
              };
            } catch (toolError) {
              const errorMessage =
                toolError instanceof Error ? toolError.message : 'Tool 执行失败';
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
                content: serializeToolResultForContext({ error: errorMessage }, budget),
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
          loopMessages.push(...toolMessages);
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
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [
      allTools,
      allowedToolNames,
      client,
      config,
      messages,
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
