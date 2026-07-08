function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractNestedMessage(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = tryParseJson(trimmed);
    if (parsed) return extractNestedMessage(parsed, depth + 1);
    return trimmed;
  }

  if (typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  if (typeof record.message === 'string') {
    const nested = extractNestedMessage(record.message, depth + 1);
    if (nested) return nested;
  }

  if (record.error) {
    const nested = extractNestedMessage(record.error, depth + 1);
    if (nested) return nested;
  }

  return null;
}

/** 尽量只保留最内层 error.message，不做翻译 */
export function extractAiChatErrorMessage(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? '').trim();
  if (!text) return 'Request failed';

  const parsed = tryParseJson(text);
  if (parsed) {
    const nested = extractNestedMessage(parsed);
    if (nested) return nested;
  }

  return text;
}

export async function readChatErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const json = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      return extractAiChatErrorMessage(
        json.error?.message || json.message || `HTTP ${response.status}`,
      );
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  try {
    const text = (await response.text()).trim();
    return extractAiChatErrorMessage(text || `HTTP ${response.status}`);
  } catch {
    return `HTTP ${response.status}`;
  }
}
