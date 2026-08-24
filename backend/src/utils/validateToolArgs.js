/**
 * 后端 Tool 参数 Schema 校验（与 ai-base validateToolArgs 对齐）。
 */
const Ajv = require('ajv');

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateSchema: false,
});

const validatorCache = new Map();

function schemaCacheKey(parameters) {
  try {
    return JSON.stringify(parameters);
  } catch {
    return String(parameters);
  }
}

function formatAjvErrors(errors) {
  return (errors || [])
    .map((err) => {
      const path = (err.instancePath || '').replace(/^\//, '').replace(/\//g, '.') || '(root)';
      const expected =
        err.params && typeof err.params === 'object'
          ? Object.entries(err.params)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join(', ')
          : '';
      const detail = expected ? `（${expected}）` : '';
      return `${path}: ${err.message || 'invalid'}${detail}`;
    })
    .join('; ');
}

function isEmptySchema(parameters) {
  if (!parameters || typeof parameters !== 'object') return true;
  const keys = Object.keys(parameters);
  if (keys.length === 0) return true;
  if (parameters.type === 'object') {
    const props = parameters.properties;
    const required = parameters.required;
    const hasProps = props && typeof props === 'object' && Object.keys(props).length > 0;
    const hasRequired = Array.isArray(required) && required.length > 0;
    if (!hasProps && !hasRequired) return true;
  }
  return false;
}

function validateToolArgs(args, parameters) {
  if (isEmptySchema(parameters)) {
    return { valid: true };
  }

  const key = schemaCacheKey(parameters);
  let validate = validatorCache.get(key);
  if (!validate) {
    try {
      validate = ajv.compile(parameters);
      validatorCache.set(key, validate);
    } catch (err) {
      console.warn('[validateToolArgs] schema compile failed:', err);
      return { valid: true };
    }
  }

  const ok = validate(args);
  if (ok) return { valid: true };

  const errors = validate.errors || [];
  return {
    valid: false,
    errors,
    message: formatAjvErrors(errors) || '参数不符合 schema',
  };
}

module.exports = {
  validateToolArgs,
  formatAjvErrors,
};
