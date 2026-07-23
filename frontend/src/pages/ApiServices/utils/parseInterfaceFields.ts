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

/** 取最后一个 interface/type 对象体（避免 type 别名干扰） */
function extractInterfaceBody(text: string): string {
  const matches = [...text.matchAll(/\binterface\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\{([\s\S]*?)\}/g)];
  if (matches.length) {
    return matches[matches.length - 1][1] || '';
  }
  const brace = text.match(/\{([\s\S]*)\}/);
  return brace ? brace[1] : text;
}

export function parseInterfaceFields(interfaceText?: string | null): InterfaceField[] {
  const text = String(interfaceText || '').trim();
  if (!text) return [];

  const aliasMap = parseAdbEnumTypeAliases(text);
  const body = extractInterfaceBody(text);

  const fields: InterfaceField[] = [];
  let pendingDescription = '';

  const lines = body.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const singleLineBlock = line.match(/^\/\*\*\s*(.*?)\s*\*\/$/);
    if (singleLineBlock) {
      pendingDescription = singleLineBlock[1]?.replace(/\*/g, ' ').trim() || '';
      continue;
    }

    const blockComment = line.match(/^\*\/\s*(.*)$/) || line.match(/^\/\*+\s*(.*)$/);
    const leadingComment = line.match(/^\*\s*(.*)$/);
    const inlineBlockStart = line.match(/^\/\*\*\s*(.*)$/);
    if (inlineBlockStart) {
      pendingDescription = inlineBlockStart[1]?.trim() || '';
      continue;
    }
    if (blockComment) {
      const content = blockComment[1]?.trim();
      if (content) pendingDescription = content;
      continue;
    }
    if (leadingComment) {
      const content = leadingComment[1]?.trim();
      if (content) pendingDescription = pendingDescription ? `${pendingDescription} ${content}` : content;
      continue;
    }

    const fieldMatch = line.match(
      /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\?)?\s*:\s*([^;\/]+?)\s*;?\s*(?:\/\/(.*))?$/,
    );
    if (fieldMatch) {
      const [, name, optional, typeRaw, inlineCommentRaw] = fieldMatch;
      let description = pendingDescription;
      const inlineComment = inlineCommentRaw?.trim();
      if (inlineComment) {
        description = description ? `${description} ${inlineComment}` : inlineComment;
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
      });
      pendingDescription = '';
    }
  }

  return fields;
}
