import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useXChat } from '@ant-design/x-sdk';
import { useAIChatLayout } from '../provider/context';
import { useEffectiveAIChatConfig } from '../provider/AIChatPageScope';
import { getAllFunctionCalls, invokeFunctionCall, toOpenAITools } from '../registry/functionRegistry';
import { buildCombinedSystemPrompt, loadAllSkills } from '../registry/skillLoader';
import { mergeOpenAITools, toOpenAIToolFromMeta } from '../registry/toolManifest';
import type { AIBaseSkill, AIBaseTool, OpenAIToolDefinition } from '../types';
import type { AIBaseClient } from '../sdk/client';
import { createEuacChatProvider, type EuacChatMessage } from './EuacChatProvider';
import { streamChatRound } from './streamToolChat';

async function invokeToolByMeta(
  client: AIBaseClient,
  tools: AIBaseTool[],
  functionName: string,
  args: Record<string, unknown>,
) {
  const toolMeta = tools.find((t) => t.functionName === functionName);
  if (toolMeta?.executionType === 'client' || (!toolMeta && getAllFunctionCalls().some((d) => d.name === functionName))) {
    return invokeFunctionCall(functionName, args);
  }
  const res = await client.invokeServerTool(functionName, args);
  return res.result ?? res;
}

export function useAIBaseChat(conversationKey: string) {
  const { client } = useAIChatLayout();
  const config = useEffectiveAIChatConfig();
  const provider = useMemo(
    () => createEuacChatProvider(config.apiBase, config.getToken),
    [config.apiBase, config.getToken],
  );
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [skills, setSkills] = useState<AIBaseSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const allTools = useMemo(
    () => skills.flatMap((skill) => skill.tools || []),
    [skills],
  );

  const openaiTools = useMemo(() => {
    const apiTools = allTools.map(toOpenAIToolFromMeta) as OpenAIToolDefinition[];
    const clientTools = toOpenAITools(getAllFunctionCalls()) as OpenAIToolDefinition[];
    return mergeOpenAITools(apiTools, clientTools);
  }, [allTools]);

  const systemPrompt = useMemo(() => buildCombinedSystemPrompt(skills, config), [skills, config]);

  useEffect(() => {
    let mounted = true;
    setSkillsLoading(true);
    loadAllSkills(client, config)
      .then((loaded) => {
        if (mounted) setSkills(loaded);
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
    requestPlaceholder: () => ({ role: 'assistant' as const, content: '正在思考中...' }),
    requestFallback: (_, { error, messageInfo }) => {
      if (error.name === 'AbortError') {
        return {
          role: 'assistant' as const,
          content: messageInfo?.message?.content || '已取消回复',
        };
      }
      const msg = error.message || '';
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

  const { messages, setMessages, isRequesting: chatRequesting, abort: chatAbort } = chat;

  const abort = useCallback(() => {
    abortRef.current?.abort();
    chatAbort();
  }, [chatAbort]);

  const submitQuery = useCallback(
    async (query: string, options?: { enableThinking?: boolean; displayContent?: string }) => {
      if (!selectedSlug) throw new Error('请先选择模型');
      if (skillsLoading) throw new Error('Skill/Tool 正在加载，请稍候');
      if (!openaiTools.length) {
        throw new Error('未加载到 Skill/Tool，请确认后端已迁移 aibase.skills.scope_id 并刷新页面');
      }

      const enableThinking = Boolean(options?.enableThinking);
      const displayContent = options?.displayContent ?? query;
      abortRef.current = new AbortController();
      setStreaming(true);

      const userId = `user-${Date.now()}`;
      const assistantId = `assistant-${Date.now() + 1}`;
      const history = messages.map((item) => item.message);
      const loadingText = enableThinking ? '正在思考中...' : '正在生成回复...';

      setMessages((ori) => [
        ...ori,
        { id: userId, message: { role: 'user' as const, content: displayContent }, status: 'success' as const },
        {
          id: assistantId,
          message: { role: 'assistant' as const, content: loadingText },
          status: 'loading' as const,
        },
      ]);

      let loopMessages: EuacChatMessage[] = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...history,
        { role: 'user', content: query },
      ];

      try {
        for (let round = 0; round < 4; round += 1) {
          if (round > 0) {
            setMessages((ori) =>
              ori.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      status: 'loading' as const,
                      message: { role: 'assistant' as const, content: '正在调用工具...' },
                    }
                  : item,
              ),
            );
          }

          const result = await streamChatRound(
            {
              slug: selectedSlug,
              messages: loopMessages,
              tools: openaiTools.length ? openaiTools : undefined,
              enableThinking,
              signal: abortRef.current?.signal,
              apiBase: config.apiBase,
              getToken: config.getToken,
            },
            ({ content, reasoningContent }) => {
              setMessages((ori) =>
                ori.map((item) =>
                  item.id === assistantId
                    ? {
                        ...item,
                        status: 'updating' as const,
                        message: {
                          role: 'assistant' as const,
                          content,
                          ...(enableThinking && reasoningContent ? { reasoningContent } : {}),
                        },
                      }
                    : item,
                ),
              );
            },
          );

          if (!result.toolCalls.length) {
            setMessages((ori) =>
              ori.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      status: 'success' as const,
                      message: {
                        role: 'assistant' as const,
                        content: result.content || '（无文本回复）',
                        ...(enableThinking && result.reasoningContent
                          ? { reasoningContent: result.reasoningContent }
                          : {}),
                      },
                    }
                  : item,
              ),
            );
            return result.content;
          }

          loopMessages = [...loopMessages, result.assistantMessage as unknown as EuacChatMessage];

          for (const call of result.toolCalls) {
            const functionName = call.function?.name;
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.function?.arguments || '{}');
            } catch {
              args = {};
            }
            const toolResult = await invokeToolByMeta(client, allTools, functionName, args);
            loopMessages.push({
              role: 'tool',
              content: JSON.stringify(toolResult),
              tool_call_id: call.id,
              name: functionName,
            });
          }
        }

        setMessages((ori) =>
          ori.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  status: 'success' as const,
                  message: {
                    role: 'assistant' as const,
                    content: item.message.content || '（无文本回复）',
                  },
                }
              : item,
          ),
        );
        return '';
      } catch (error) {
        const message = error instanceof Error ? error.message : '请求失败';
        const isAbort = error instanceof Error && error.name === 'AbortError';

        setMessages((ori) =>
          ori.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  status: isAbort ? ('abort' as const) : ('error' as const),
                  message: {
                    role: 'assistant' as const,
                    content: isAbort ? '已取消回复' : message,
                  },
                }
              : item,
          ),
        );

        if (!isAbort) throw error;
        return '';
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [allTools, client, config, messages, openaiTools, selectedSlug, setMessages, skillsLoading, systemPrompt],
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
  };
}
