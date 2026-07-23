/**
 * 从 TypeScript Handler 脚本发现参数名（与后端 handlerParamDiscovery 语义对齐）：
 * - 字符串字面量中的 :named
 * - params.xxx / ctx.params.xxx / parameters.xxx
 */

/** 命名参数 :foo；排除 entity code（fmms:production:WorkCard）与 PG cast（::uuid） */
const NAMED_PARAM_RE = /(?<![A-Za-z0-9_:]):(\w+)/g;
const PARAM_ACCESS_RE = /\b(?:ctx\.)?(?:params|parameters)\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

function extractStringLiterals(script: string): string[] {
  const text = String(script || '');
  const literals: string[] = [];
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

export function extractHandlerSqlNamedParams(handlerScript?: string | null): string[] {
  const names = new Set<string>();
  extractStringLiterals(String(handlerScript || '')).forEach((literal) => {
    const matches = literal.match(NAMED_PARAM_RE) || [];
    matches.forEach((m) => names.add(m.slice(1)));
  });
  return [...names];
}

export function extractHandlerParamAccesses(handlerScript?: string | null): string[] {
  const text = String(handlerScript || '');
  const names = new Set<string>();
  const re = new RegExp(PARAM_ACCESS_RE.source, 'g');
  let match = re.exec(text);
  while (match) {
    names.add(match[1]);
    match = re.exec(text);
  }
  return [...names];
}

export function extractHandlerParams(handlerScript?: string | null): string[] {
  return [
    ...new Set([
      ...extractHandlerSqlNamedParams(handlerScript),
      ...extractHandlerParamAccesses(handlerScript),
    ]),
  ];
}

/** 推断补全到 interface 时的 TS 类型 */
export function guessHandlerParamTsType(name: string): string {
  if (/(_only$|^is_|^has_|^enable|^allow)/i.test(name) || /^(nearest_only|dry_run)$/i.test(name)) {
    return 'boolean';
  }
  if (/(_id$|^id$)/i.test(name)) return 'string';
  if (/^(limit|skip|offset|page|page_size|pageSize|count)$/i.test(name)) return 'number';
  return 'string';
}

/**
 * 将缺失参数追加到 interface 文本末尾（} 前）。
 */
export function appendFieldsToInterface(
  interfaceText: string,
  missing: Array<{ name: string; type: string }>,
): string {
  if (!missing.length) return interfaceText;
  const text = String(interfaceText || '').trim();
  const lines = missing.map(
    (f) => `  /** Handler 发现的参数 */\n  ${f.name}?: ${f.type};`,
  );

  if (!text) {
    return `interface RequestParams {\n${lines.join('\n')}\n}`;
  }

  const closeIdx = text.lastIndexOf('}');
  if (closeIdx === -1) {
    return `${text}\n${lines.join('\n')}`;
  }

  const before = text.slice(0, closeIdx).replace(/\s*$/, '');
  const after = text.slice(closeIdx);
  const sep = before.endsWith('\n') ? '' : '\n';
  return `${before}${sep}${lines.join('\n')}\n${after}`;
}
