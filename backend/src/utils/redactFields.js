const MAX_STRING_LEN = 2048;
const REDACTED = '[REDACTED]';

const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'secret',
  'token',
  'app_secret',
  'client_secret',
  'api_key',
  'apikey',
  'private_key',
  'authorization',
  'refresh_token',
  'access_key',
]);

function isSensitiveKey(key, extraKeysLower) {
  if (key == null) return false;
  const lower = String(key).toLowerCase();
  return DEFAULT_SENSITIVE_KEYS.has(lower) || extraKeysLower.has(lower);
}

function truncateString(value) {
  if (typeof value !== 'string') return value;
  if (value.length <= MAX_STRING_LEN) return value;
  return `${value.slice(0, MAX_STRING_LEN)}…[truncated]`;
}

function getByPath(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (cur[part] == null || typeof cur[part] !== 'object') {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * 递归脱敏对象：按键名（大小写不敏感）与点路径。
 * @param {unknown} obj
 * @param {string[]} [extraKeys] 额外敏感键或点路径
 * @param {string[]} [pathKeys] 仅按路径脱敏（可与 extraKeys 合并）
 */
function redactFields(obj, extraKeys = [], pathKeys = []) {
  if (obj == null) return obj;

  const extraKeysLower = new Set(
    (extraKeys || []).filter((k) => !String(k).includes('.')).map((k) => String(k).toLowerCase()),
  );
  const allPathKeys = [
    ...(extraKeys || []).filter((k) => String(k).includes('.')),
    ...(pathKeys || []),
  ];

  function walk(value) {
    if (value == null) return value;
    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }
    if (typeof value === 'string') {
      return truncateString(value);
    }
    if (typeof value !== 'object') {
      return value;
    }

    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (isSensitiveKey(key, extraKeysLower)) {
        out[key] = REDACTED;
      } else if (typeof val === 'string') {
        out[key] = truncateString(val);
      } else {
        out[key] = walk(val);
      }
    }
    return out;
  }

  let result = walk(typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : obj);

  if (typeof result === 'object' && result != null && !Array.isArray(result)) {
    for (const path of allPathKeys) {
      if (getByPath(result, path) !== undefined) {
        setByPath(result, path, REDACTED);
      }
    }
  }

  return result;
}

module.exports = {
  redactFields,
  REDACTED,
  MAX_STRING_LEN,
  DEFAULT_SENSITIVE_KEYS,
};
