import type { OpenAIToolDefinition } from '../types';
import type { EuacChatMessage } from './EuacChatProvider';

export interface StreamUpdate {
  content: string;
  reasoningContent: string;
}

export interface ToolCallResult {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface StreamRoundResult {
  content: string;
  reasoningContent: string;
  toolCalls: ToolCallResult[];
  assistantMessage: Record<string, unknown>;
}

type ToolCallAccumulator = Record<
  number,
  { id?: string; type?: string; function: { name: string; arguments: string } }
>;

function mergeToolCallDelta(
  acc: ToolCallAccumulator,
  deltas?: Array<{ index?: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
) {
  for (const delta of deltas || []) {
    const index = delta.index ?? 0;
    if (!acc[index]) {
      acc[index] = { type: 'function', function: { name: '', arguments: '' } };
    }
    if (delta.id) acc[index].id = delta.id;
    if (delta.type) acc[index].type = delta.type;
    if (delta.function?.name) acc[index].function.name += delta.function.name;
    if (delta.function?.arguments) acc[index].function.arguments += delta.function.arguments;
  }
}

function toolCallsFromAccumulator(acc: ToolCallAccumulator): ToolCallResult[] {
  return Object.values(acc)
    .filter((item) => item.id && item.function.name)
    .map((item) => ({
      id: item.id!,
      type: item.type || 'function',
      function: item.function,
    }));
}

function parseSsePayload(
  dataStr: string,
  state: { content: string; reasoningContent: string; toolCalls: ToolCallAccumulator },
  enableThinking: boolean,
) {
  if (!dataStr || dataStr === '[DONE]') return;

  let parsed: {
    choices?: Array<{
      delta?: {
        content?: string | null;
        reasoning_content?: string;
        tool_calls?: Array<{ index?: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }>;
      };
      message?: {
        content?: string;
        reasoning_content?: string;
        tool_calls?: ToolCallResult[];
      };
    }>;
    error?: { message?: string };
  };

  try {
    parsed = JSON.parse(dataStr);
  } catch {
    return;
  }

  if (parsed.error?.message) {
    throw new Error(parsed.error.message);
  }

  const delta = parsed.choices?.[0]?.delta;
  const message = parsed.choices?.[0]?.message;

  if (delta) {
    state.content += delta.content ?? '';
    if (enableThinking) {
      state.reasoningContent += delta.reasoning_content ?? '';
    }
    mergeToolCallDelta(state.toolCalls, delta.tool_calls);
    return;
  }

  if (message) {
    state.content += message.content ?? '';
    if (enableThinking) {
      state.reasoningContent += message.reasoning_content ?? '';
    }
    for (const [index, call] of (message.tool_calls || []).entries()) {
      mergeToolCallDelta(state.toolCalls, [{ index, ...call, function: call.function }]);
    }
  }
}

export async function streamChatRound(
  params: {
    slug: string;
    messages: EuacChatMessage[];
    tools?: OpenAIToolDefinition[];
    enableThinking?: boolean;
    signal?: AbortSignal;
    apiBase: string;
    getToken: () => string | null;
  },
  onUpdate: (update: StreamUpdate) => void,
): Promise<StreamRoundResult> {
  const enableThinking = Boolean(params.enableThinking);
  const token = params.getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${params.apiBase}/v1/ai/chat/completions`, {
    method: 'POST',
    headers,
    signal: params.signal,
    body: JSON.stringify({
      slug: params.slug,
      messages: params.messages,
      stream: true,
      tools: params.tools?.length ? params.tools : undefined,
      enable_thinking: enableThinking,
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await response.json();
      throw new Error(json.error?.message || json.message || 'Chat 请求失败');
    }
    throw new Error(await response.text() || 'Chat 请求失败');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') || !response.body) {
    throw new Error('AI 服务未返回 SSE 流式响应，请检查模型与 Provider 配置');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = { content: '', reasoningContent: '', toolCalls: {} as ToolCallAccumulator };
  let buffer = '';

  const emit = () => {
    onUpdate({ content: state.content, reasoningContent: state.reasoningContent });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      parseSsePayload(trimmed.slice(5).trim(), state, enableThinking);
      emit();
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data:')) {
      parseSsePayload(trimmed.slice(5).trim(), state, enableThinking);
      emit();
    }
  }

  const toolCalls = toolCallsFromAccumulator(state.toolCalls);
  const assistantMessage: Record<string, unknown> = {
    role: 'assistant',
    content: state.content,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };

  return {
    content: state.content,
    reasoningContent: state.reasoningContent,
    toolCalls,
    assistantMessage,
  };
}
