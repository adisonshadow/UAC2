import {
  AbstractChatProvider,
  XRequest,
  type TransformMessage,
  type XRequestOptions,
} from '@ant-design/x-sdk';

type SseChunk = { data?: string };

export interface EuacChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoningContent?: string;
  tool_call_id?: string;
  name?: string;
}

export interface EuacChatInput {
  query?: string;
  slug?: string;
  messages?: EuacChatMessage[];
  stream?: boolean;
  tools?: object[];
  systemPrompt?: string;
  enableThinking?: boolean;
}

const PLACEHOLDER = '正在思考中...';

function isPlaceholder(content?: string) {
  return !content || content === PLACEHOLDER;
}

export class EuacChatProvider extends AbstractChatProvider<EuacChatMessage, EuacChatInput, SseChunk> {
  transformParams(
    requestParams: Partial<EuacChatInput>,
    options: XRequestOptions<EuacChatInput, SseChunk, EuacChatMessage>,
  ): EuacChatInput {
    const history = this.getMessages().map(({ role, content, tool_call_id, name }) => ({
      role,
      content,
      ...(tool_call_id ? { tool_call_id } : {}),
      ...(name ? { name } : {}),
    }));

    const messages = requestParams.systemPrompt
      ? [{ role: 'system' as const, content: requestParams.systemPrompt }, ...history]
      : history;

    return {
      ...(options?.params || {}),
      slug: requestParams.slug,
      messages,
      stream: true,
      tools: requestParams.tools,
      ...(requestParams.enableThinking ? { enable_thinking: true } : { enable_thinking: false }),
    };
  }

  transformLocalMessage(requestParams: Partial<EuacChatInput>): EuacChatMessage {
    return { role: 'user', content: requestParams.query || '' };
  }

  transformMessage(info: TransformMessage<EuacChatMessage, SseChunk>): EuacChatMessage {
    const { originMessage, chunk } = info;
    const prevContent = isPlaceholder(originMessage?.content) ? '' : (originMessage?.content ?? '');
    const prevReasoning = originMessage?.reasoningContent ?? '';

    const pack = (content: string, reasoningContent?: string): EuacChatMessage => ({
      role: 'assistant',
      content,
      ...(reasoningContent ? { reasoningContent } : {}),
    });

    if (!chunk) return pack(prevContent, prevReasoning || undefined);

    const dataStr = String(chunk.data ?? '').trim();
    if (!dataStr || dataStr === '[DONE]') return pack(prevContent, prevReasoning || undefined);

    let parsed: {
      choices?: Array<{
        delta?: { content?: string | null; reasoning_content?: string; tool_calls?: unknown[] };
        message?: { content?: string; reasoning_content?: string; tool_calls?: unknown[] };
      }>;
      error?: { message?: string };
    };

    try {
      parsed = JSON.parse(dataStr);
    } catch {
      return pack(prevContent, prevReasoning || undefined);
    }

    if (parsed?.error?.message) {
      return { role: 'assistant', content: parsed.error.message };
    }

    const delta = parsed?.choices?.[0]?.delta;
    const message = parsed?.choices?.[0]?.message;
    const source = delta || message;

    if (source) {
      const newContent = prevContent + (source.content ?? '');
      const newReasoning = prevReasoning + (source.reasoning_content ?? '');
      return pack(newContent, newReasoning || undefined);
    }

    return pack(prevContent, prevReasoning || undefined);
  }
}

export function createEuacChatProvider(apiBase: string, getToken: () => string | null) {
  return new EuacChatProvider({
    request: XRequest<EuacChatInput, SseChunk, EuacChatMessage>(`${apiBase}/v1/ai/chat/completions`, {
      manual: true,
      headers: { 'Content-Type': 'application/json' },
      middlewares: {
        onRequest: async (url, init) => {
          const token = getToken();
          const headers: Record<string, string> = {
            ...(init.headers as Record<string, string>),
          };
          if (token) headers.Authorization = `Bearer ${token}`;
          return [url, { ...init, headers }] as [string, typeof init];
        },
      },
      params: { stream: true },
      timeout: 120000,
      streamTimeout: 120000,
    }),
  });
}
