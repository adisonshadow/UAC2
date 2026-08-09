/**
 * 从设计期 TypeScript interface 文本中解析字段列表。
 *
 * 枚举连接约定（合法 TS 泛型类型，非函数调用）：
 *   type StatusType = getADBEnumByCode<"fmms:WorkCardStatus">;
 *   interface Request {
 *     status?: StatusType;
 *     statuses?: StatusType[];  // 多选
 *   }
 *
 * 兼容：getADBEnumByCode("code") 旧写法、行内 @adb-enum / 「枚举 code」
 *
 * 嵌套对象（如 create 的 body: { ... }）：
 * - 顶层记为 type=Record<string, unknown>
 * - 内部字段可通过 parseNestedInterfaceFields / flatten 供面板使用
 */

export interface InterfaceField {
  name: string;
  /** 原始 TS 类型文本（如 StatusType、StatusType[]、string） */
  type?: string;
  /** 面板展示用类型名（优先别名，如 StatusType / StatusType[]） */
  typeLabel?: string;
  description?: string;
  required?: boolean;
  isFile?: boolean;
  isArray?: boolean;
  /** BizdataEnum code */
  enumCode?: string;
  /** 所属内联对象容器（如 body / set）；顶层字段无此字段 */
  parent?: string;
}

const FILE_MARKERS = /@file|@storage|storage\s*objectId|文件字段|文件引用/i;
const ADB_ENUM_TAG_RE = /@adb-enum\s+([A-Za-z_][A-Za-z0-9_:]*)/i;
const LEGACY_ENUM_RE = /枚举\s+([A-Za-z_][A-Za-z0-9_:]*)/;
/** type Alias = getADBEnumByCode<"code"> 或兼容 getADBEnumByCode("code") */
const GET_ADB_ENUM_TYPE_RE =
  /type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*getADBEnumByCode\s*(?:<\s*['"]([^'"]+)['"]\s*>|\(\s*['"]([^'"]+)['"]\s*\))\s*;?/g;

/** 解析 type Alias = getADBEnumByCode<"code"> */
export function parseAdbEnumTypeAliases(interfaceText?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  const text = String(interfaceText || '');
  const re = new RegExp(GET_ADB_ENUM_TYPE_RE.source, 'g');
  let match = re.exec(text);
  while (match) {
    const code = match[2] || match[3];
    if (code) map.set(match[1], code);
    match = re.exec(text);
  }
  return map;
}

/** 从注释/行文本提取 enumCode（兼容旧写法） */
export function extractInterfaceEnumCode(...texts: Array<string | undefined | null>): string | undefined {
  const joined = texts.filter(Boolean).join(' ');
  if (!joined.trim()) return undefined;
  const tagged = joined.match(ADB_ENUM_TAG_RE);
  if (tagged?.[1]) return tagged[1];
  const legacy = joined.match(LEGACY_ENUM_RE);
  if (legacy?.[1]) return legacy[1];
  return undefined;
}

function resolveFieldType(
  typeRaw: string,
  aliasMap: Map<string, string>,
): { type: string; typeLabel: string; isArray: boolean; enumCode?: string } {
  const type = String(typeRaw || '').trim().replace(/[;,\s]+$/, '');
  const arrayMatch =
    type.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\[\s*\]$/)
    || type.match(/^Array\s*<\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*>$/i);
  if (arrayMatch) {
    const alias = arrayMatch[1];
    const enumCode = aliasMap.get(alias);
    return {
      type: enumCode ? 'string' : alias,
      typeLabel: `${alias}[]`,
      isArray: true,
      enumCode,
    };
  }
  const enumCode = aliasMap.get(type);
  if (enumCode) {
    return {
      type: 'string',
      typeLabel: type,
      isArray: false,
      enumCode,
    };
  }
  const isArray = /\[\]$/.test(type) || /^Array\s*</i.test(type);
  return {
    type,
    typeLabel: type,
    isArray,
  };
}

function findMatchingBrace(text: string, startIdx: number): number {
  if (startIdx < 0 || startIdx >= text.length || text[startIdx] !== '{') return -1;
  let depth = 0;
  for (let i = startIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 取最后一个 interface 对象体（括号配对，支持嵌套 body: { ... }） */
function extractInterfaceBody(text: string): string {
  const source = String(text || '');
  const re = /\binterface\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\{/g;
  let match: RegExpExecArray | null;
  let lastOpen = -1;
  while ((match = re.exec(source)) !== null) {
    lastOpen = match.index + match[0].length - 1;
  }
  if (lastOpen >= 0) {
    const close = findMatchingBrace(source, lastOpen);
    if (close > lastOpen) return source.slice(lastOpen + 1, close);
    return source.slice(lastOpen + 1);
  }
  const firstBrace = source.indexOf('{');
  if (firstBrace >= 0) {
    const close = findMatchingBrace(source, firstBrace);
    if (close > firstBrace) return source.slice(firstBrace + 1, close);
  }
  return source;
}

function parseInterfaceBodyFields(
  body: string,
  aliasMap: Map<string, string>,
  parent?: string,
): { fields: InterfaceField[]; nested: Record<string, InterfaceField[]> } {
  const fields: InterfaceField[] = [];
  const nested: Record<string, InterfaceField[]> = {};
  let pendingDescription = '';
  const lines = body.split('\n');
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    i += 1;
    if (!line) continue;

    const singleLineBlock = line.match(/^\/\*\*\s*(.*?)\s*\*\/$/);
    if (singleLineBlock) {
      pendingDescription = singleLineBlock[1]?.replace(/\*/g, ' ').trim() || '';
      continue;
    }

    const inlineBlockStart = line.match(/^\/\*\*\s*(.*)$/);
    if (inlineBlockStart) {
      pendingDescription = inlineBlockStart[1]?.trim() || '';
      continue;
    }
    const blockComment = line.match(/^\*\/\s*(.*)$/) || line.match(/^\/\*+\s*(.*)$/);
    const leadingComment = line.match(/^\*\s*(.*)$/);
    if (blockComment) {
      const content = blockComment[1]?.trim();
      if (content) pendingDescription = content;
      continue;
    }
    if (leadingComment) {
      const content = leadingComment[1]?.trim();
      if (content) {
        pendingDescription = pendingDescription ? `${pendingDescription} ${content}` : content;
      }
      continue;
    }

    const nestedObjMatch = line.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\?)?\s*:\s*\{(.*)$/);
    if (nestedObjMatch) {
      const [, name, optional, afterBrace = ''] = nestedObjMatch;
      const description = pendingDescription || undefined;
      let depth = 1;
      const collected: string[] = [];
      const consume = (chunk: string): boolean => {
        for (let c = 0; c < chunk.length; c += 1) {
          const ch = chunk[c];
          if (ch === '{') depth += 1;
          else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
              collected.push(chunk.slice(0, c));
              return true;
            }
          }
        }
        collected.push(chunk);
        return false;
      };
      let closed = consume(afterBrace);
      while (!closed && i < lines.length) {
        closed = consume(lines[i]);
        i += 1;
      }
      const inner = collected.join('\n');
      const nestedParsed = parseInterfaceBodyFields(inner, aliasMap, name);
      nested[name] = nestedParsed.fields;
      Object.assign(nested, nestedParsed.nested);

      fields.push({
        name: String(name),
        type: 'Record<string, unknown>',
        typeLabel: 'object',
        description,
        required: !optional,
        isFile: false,
        isArray: false,
        ...(parent ? { parent } : {}),
      });
      pendingDescription = '';
      continue;
    }

    const fieldMatch = line.match(
      /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\?)?\s*:\s*([^;\/]+?)\s*;?\s*(?:\/\/(.*))?$/,
    );
    if (!fieldMatch) continue;

    const [, name, optional, typeRaw, inlineCommentRaw] = fieldMatch;
    let description = pendingDescription;
    const inlineComment = inlineCommentRaw?.trim();
    if (inlineComment) {
      description = description ? `${description} ${inlineComment}` : inlineComment;
    }

    if (String(typeRaw).trim() === '{' || String(typeRaw).trim().startsWith('{')) {
      fields.push({
        name: String(name),
        type: 'Record<string, unknown>',
        typeLabel: 'object',
        description: description || undefined,
        required: !optional,
        isFile: false,
        isArray: false,
        ...(parent ? { parent } : {}),
      });
      pendingDescription = '';
      continue;
    }

    const resolved = resolveFieldType(typeRaw, aliasMap);
    const commentEnum = extractInterfaceEnumCode(pendingDescription, inlineComment, line);
    fields.push({
      name: String(name),
      type: resolved.type,
      typeLabel: resolved.typeLabel,
      description: description || undefined,
      required: !optional,
      isFile: FILE_MARKERS.test(line),
      isArray: resolved.isArray,
      enumCode: resolved.enumCode || commentEnum,
      ...(parent ? { parent } : {}),
    });
    pendingDescription = '';
  }

  return { fields, nested };
}

export function parseInterfaceFields(interfaceText?: string | null): InterfaceField[] {
  const text = String(interfaceText || '').trim();
  if (!text) return [];

  const aliasMap = parseAdbEnumTypeAliases(text);
  const body = extractInterfaceBody(text);
  return parseInterfaceBodyFields(body, aliasMap).fields;
}

/** 解析内联对象容器（如 body / set）内的字段 */
export function parseNestedInterfaceFields(
  interfaceText?: string | null,
  containerName = 'body',
): InterfaceField[] {
  const text = String(interfaceText || '').trim();
  if (!text) return [];
  const aliasMap = parseAdbEnumTypeAliases(text);
  const body = extractInterfaceBody(text);
  const { nested } = parseInterfaceBodyFields(body, aliasMap);
  return nested[containerName] || [];
}
