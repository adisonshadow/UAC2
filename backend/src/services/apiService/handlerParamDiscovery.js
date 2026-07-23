/**
 * 从 TypeScript Handler 脚本中发现请求参数名：
 * - queryPg/SQL 字符串字面量中的 :named
 * - params.xxx / ctx.params.xxx / parameters.xxx 访问
 */

/** 命名参数 :foo；排除 entity code（fmms:production:WorkCard）与 PG cast（::uuid） */
const NAMED_PARAM_RE = /(?<![A-Za-z0-9_:]):(\w+)/g;
const RESERVED_SQL_PARAMS = new Set(['limit', 'skip']);

/** 匹配 params.foo / ctx.params.foo / parameters.foo */
const PARAM_ACCESS_RE = /\b(?:ctx\.)?(?:params|parameters)\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

function extractStringLiterals(script) {
  const text = String(script || '');
  const literals = [];
  const patterns = [
    /`(?:\\.|[^`\\])*`/g,
    /'(?:\\.|[^'\\])*'/g,
    /"(?:\\.|[^"\\])*"/g,
  ];
  patterns.forEach((re) => {
    let match = re.exec(text);
    while (match) {
      literals.push(match[0].slice(1, -1));
      match = re.exec(text);
    }
  });
  return literals;
}

function extractSqlNamedParamsFromText(text) {
  if (!text) return [];
  const matches = String(text).match(NAMED_PARAM_RE) || [];
  return [
    ...new Set(
      matches
        .map((m) => m.slice(1))
        .filter((name) => !RESERVED_SQL_PARAMS.has(name.toLowerCase())),
    ),
  ];
}

/** 从 Handler 内 SQL 字符串字面量抽取 :param（含 limit/skip 时单独处理） */
function extractHandlerSqlNamedParams(handlerScript, { includeReserved = false } = {}) {
  const names = new Set();
  extractStringLiterals(handlerScript).forEach((literal) => {
    const matches = String(literal).match(NAMED_PARAM_RE) || [];
    matches.forEach((m) => {
      const name = m.slice(1);
      if (!includeReserved && RESERVED_SQL_PARAMS.has(name.toLowerCase())) return;
      names.add(name);
    });
  });
  return [...names];
}

function extractHandlerParamAccesses(handlerScript) {
  const text = String(handlerScript || '');
  const names = new Set();
  const re = new RegExp(PARAM_ACCESS_RE.source, 'g');
  let match = re.exec(text);
  while (match) {
    names.add(match[1]);
    match = re.exec(text);
  }
  return [...names];
}

function guessParamJsonSchema(name) {
  const key = String(name || '');
  if (/(_only$|^is_|^has_|^enable|^allow)/i.test(key) || /^(nearest_only|dry_run)$/i.test(key)) {
    return { type: 'boolean', description: `Handler 发现的参数（建议在 requestParameterInterface 中声明）` };
  }
  if (/(_id$|^id$)/i.test(key)) {
    return { type: 'string', format: 'uuid', description: `Handler 发现的参数（建议在 requestParameterInterface 中声明）` };
  }
  if (/^(limit|skip|offset|page|page_size|pageSize|count)$/i.test(key)) {
    return { type: 'integer', description: `Handler 发现的参数（建议在 requestParameterInterface 中声明）` };
  }
  return { type: 'string', description: `Handler 发现的参数（建议在 requestParameterInterface 中声明）` };
}

/**
 * @returns {{ names: string[], fromSql: string[], fromAccess: string[] }}
 */
function discoverHandlerParams(serviceOrScript) {
  const script = typeof serviceOrScript === 'string'
    ? serviceOrScript
    : (serviceOrScript?.handlerScript
      || serviceOrScript?.handler_script
      || serviceOrScript?.scriptOverrides?.__handler__
      || '');
  const fromSql = extractHandlerSqlNamedParams(script, { includeReserved: true });
  const fromAccess = extractHandlerParamAccesses(script);
  const names = [...new Set([...fromSql, ...fromAccess])];
  return { names, fromSql, fromAccess };
}

module.exports = {
  extractStringLiterals,
  extractSqlNamedParamsFromText,
  extractHandlerSqlNamedParams,
  extractHandlerParamAccesses,
  discoverHandlerParams,
  guessParamJsonSchema,
  RESERVED_SQL_PARAMS,
};
