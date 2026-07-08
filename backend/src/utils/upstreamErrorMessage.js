function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractNestedMessage(value, depth = 0) {
  if (depth > 4 || value == null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = tryParseJson(trimmed);
    if (parsed) return extractNestedMessage(parsed, depth + 1);
    return trimmed;
  }

  if (typeof value !== 'object') return null;

  if (typeof value.message === 'string') {
    const nested = extractNestedMessage(value.message, depth + 1);
    if (nested) return nested;
  }

  if (value.error) {
    const nested = extractNestedMessage(value.error, depth + 1);
    if (nested) return nested;
  }

  return null;
}

/** 从上游错误体中提取最内层 message，不做翻译 */
function extractErrorMessage(errorText) {
  const parsed = tryParseJson(errorText);
  const extracted = extractNestedMessage(parsed ?? errorText);
  if (extracted) return extracted;
  const fallback = String(errorText || '').trim();
  return fallback || 'Upstream error';
}

module.exports = {
  extractErrorMessage,
  extractNestedMessage,
  tryParseJson,
};
