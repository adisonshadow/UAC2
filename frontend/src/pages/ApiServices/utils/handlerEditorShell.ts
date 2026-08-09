/**
 * Handler 编辑器「可见但锁定」的壳层：
 * - 展示完整 export async function handler ... { body }
 * - 仅 body 可编辑（constrained-editor-plugin）
 * - 持久化 / 后端仍使用纯函数体
 */

export const HANDLER_EDITOR_HEADER = [
  '/**',
  ' * EADAF TypeScript Handler',
  ' * 灰色区域只读；仅函数体内可编辑。',
  ' * params：已校验只读；经 db().where/paginate 使用时参数化防注入。',
  ' * 推荐：.paginate({ limit, skip }) → { items, pagination }；禁止 queryPg/SQL。',
  ' */',
  'export async function handler(_ctx?: HandlerContext): Promise<unknown> {',
].join('\n') + '\n';

export const HANDLER_EDITOR_FOOTER = '\n}\n';

const HANDLER_FN_OPEN_RE =
  /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+handler\s*\([^)]*\)\s*(?::\s*[^{;=]+)?\s*\{/;

/** Header 行数（1-based 下 body 起始行 = 此值 + 1） */
export function getHandlerEditorHeaderLineCount(): number {
  return HANDLER_EDITOR_HEADER.replace(/\n$/, '').split('\n').length;
}

function skipString(text: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === quote) return i + 1;
    i += 1;
  }
  return text.length;
}

function skipLineComment(text: string, start: number): number {
  let i = start + 2;
  while (i < text.length && text[i] !== '\n') i += 1;
  return i;
}

function skipBlockComment(text: string, start: number): number {
  let i = start + 2;
  while (i < text.length - 1) {
    if (text[i] === '*' && text[i + 1] === '/') return i + 2;
    i += 1;
  }
  return text.length;
}

/**
 * 从 openBraceIndex（`{` 的位置）找到匹配的 `}`，返回 body 切片 [start, endExclusive)。
 */
function findMatchingBraceBody(text: string, openBraceIndex: number): { start: number; end: number } | null {
  let depth = 0;
  let i = openBraceIndex;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i, ch);
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      i = skipLineComment(text, i);
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i = skipBlockComment(text, i);
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start: openBraceIndex + 1, end: i };
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return null;
}

function indentBody(body: string): string {
  const trimmed = String(body || '').replace(/^\n+/, '').replace(/\n+$/, '');
  if (!trimmed) {
    return '  // 在此编写业务逻辑\n  return {};';
  }
  return trimmed
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '';
      if (/^\s/.test(line)) return line;
      return `  ${line}`;
    })
    .join('\n');
}

function dedentBody(body: string): string {
  const lines = String(body || '').replace(/^\n/, '').replace(/\n$/, '').split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (!nonEmpty.length) return '';
  const indents = nonEmpty.map((l) => (l.match(/^(\s*)/)?.[1].length ?? 0));
  const min = Math.min(...indents);
  if (min <= 0) return lines.join('\n').replace(/\n+$/, '');
  return lines
    .map((l) => (l.trim().length ? l.slice(min) : ''))
    .join('\n')
    .replace(/\n+$/, '');
}

/**
 * 从完整编辑器文本或旧式 handler 中提取纯函数体。
 */
export function extractHandlerBody(fullText: string): string {
  const text = String(fullText || '');
  if (!text.trim()) return '';

  const match = HANDLER_FN_OPEN_RE.exec(text);
  if (match) {
    const openIdx = match.index + match[0].length - 1;
    const span = findMatchingBraceBody(text, openIdx);
    if (span) {
      return dedentBody(text.slice(span.start, span.end));
    }
  }

  return String(text).replace(/\n+$/, '');
}

/**
 * 将任意存库脚本规范为「纯函数体」（兼容旧 export handler / 已包壳文本）。
 */
export function normalizeHandlerBody(script: string): string {
  const text = String(script || '');
  if (!text.trim()) return '';
  if (HANDLER_FN_OPEN_RE.test(text) || text.includes('EADAF TypeScript Handler')) {
    return extractHandlerBody(text);
  }
  return text.replace(/\n+$/, '');
}

/**
 * 为编辑器包上可见锁定壳。
 */
export function wrapHandlerBodyForEditor(body: string): string {
  const normalized = normalizeHandlerBody(body);
  const content = indentBody(normalized);
  return `${HANDLER_EDITOR_HEADER}${content}${HANDLER_EDITOR_FOOTER}`;
}

/**
 * 可编辑区间：[startLine, startColumn, endLine, endColumn]（1-based，供 constrained-editor-plugin）。
 */
export function getHandlerBodyEditableRange(
  fullText: string,
): [number, number, number, number] {
  const lines = String(fullText || '').replace(/\n$/, '').split('\n');
  const headerLineCount = getHandlerEditorHeaderLineCount();
  const bodyStartLine = headerLineCount + 1;
  // 最后一行应为 `}`
  let bodyEndLine = Math.max(bodyStartLine, lines.length - 1);
  if (lines[lines.length - 1]?.trim() === '}') {
    bodyEndLine = Math.max(bodyStartLine, lines.length - 1);
  }
  const endCol = Math.max(1, (lines[bodyEndLine - 1]?.length ?? 0) + 1);
  return [bodyStartLine, 1, bodyEndLine, endCol];
}

export function buildHandlerBodyRestriction(fullText: string) {
  return {
    range: getHandlerBodyEditableRange(fullText),
    allowMultiline: true,
    label: 'handlerBody',
  };
}
