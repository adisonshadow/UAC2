/**
 * 将 SQL 中的 :name 命名参数转为 PostgreSQL $1,$2,... 参数化绑定。
 * 用于 TypeScript Handler 的 queryPg，避免字符串插值。
 */

const { stripSqlComments } = require('./sqlTextUtils');

const NAMED_PARAM_RE = /(?<!:):(\w+)\b/g;

/**
 * @param {string} sql
 * @param {Record<string, unknown>} values
 * @param {{ optionalNames?: Set<string>|string[], allowMissingAsNull?: boolean }} [options]
 * @returns {{ sql: string, bindings: unknown[] }}
 */
function bindNamedSqlParams(sql, values = {}, options = {}) {
  const text = String(sql || '');
  const optional = options.optionalNames instanceof Set
    ? options.optionalNames
    : new Set(options.optionalNames || []);
  const allowMissingAsNull = options.allowMissingAsNull !== false;

  const bindings = [];
  const missing = [];
  const indexByName = new Map();

  const nextSql = text.replace(NAMED_PARAM_RE, (full, name) => {
    if (indexByName.has(name)) {
      return `$${indexByName.get(name)}`;
    }
    const hasOwn = Object.prototype.hasOwnProperty.call(values || {}, name);
    const raw = hasOwn ? values[name] : undefined;
    const isEmpty = raw === undefined || raw === '';
    if (isEmpty) {
      if (optional.has(name) || allowMissingAsNull) {
        indexByName.set(name, bindings.length + 1);
        bindings.push(null);
        return `$${indexByName.get(name)}`;
      }
      missing.push(name);
      return full;
    }
    indexByName.set(name, bindings.length + 1);
    bindings.push(raw);
    return `$${indexByName.get(name)}`;
  });

  if (missing.length) {
    throw Object.assign(
      new Error(
        `queryPg SQL 含未提供的命名参数: ${missing.map((n) => `:${n}`).join(', ')}。`
        + '请在 requestParameterInterface 声明并传入请求参数，或调用 queryPg(sql, { name: value })',
      ),
      { status: 400 },
    );
  }

  // 剩余检查忽略注释中的 :name（与 extractSqlNamedParams 一致）
  const remaining = stripSqlComments(nextSql).match(NAMED_PARAM_RE);
  if (remaining?.length) {
    throw Object.assign(
      new Error(`queryPg SQL 仍含未绑定命名参数: ${[...new Set(remaining)].join(', ')}`),
      { status: 400 },
    );
  }

  return { sql: nextSql, bindings };
}

function sqlHasNamedParams(sql) {
  return /(?<!:):\w+\b/.test(stripSqlComments(sql));
}

module.exports = {
  bindNamedSqlParams,
  sqlHasNamedParams,
};
