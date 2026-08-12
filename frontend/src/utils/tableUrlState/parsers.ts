/**
 * L1 状态定义层：valueType → nuqs parser 注册表。
 *
 * 方案 6.5 落地：页面默认只声明白名单键（urlFilterKeys），类型优先从
 * columns 推断（见 inferFromColumns.ts）；此处提供基础 parser 与自定义 parser。
 *
 * 约定：
 * - 时间统一 UTC ISO-8601 入库，展示层本地化；
 * - 布尔筛选统一用「键存在」语义（?enabled=1 表示 true，无键表示默认值），
 *   不直接用裸 parseAsBoolean（避免 '0'/'false' 等字符串二义）；
 * - 数组逗号分隔（parseAsArrayOf 默认），item 自动 URI 编码。
 */
import dayjs, { type Dayjs } from 'dayjs';
import {
  createParser,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsJson,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
  type SingleParserBuilder,
} from 'nuqs';

/** 字符串筛选（默认空串，不写 URL） */
export const stringParser = parseAsString.withDefault('');

/** 整数筛选（无默认：未设置时为 null） */
export const integerParser = parseAsInteger;

/** 浮点筛选 */
export const floatParser = parseAsFloat;

/**
 * 布尔「键存在」型筛选。
 * URL 中 `?enabled=1`（或 'true'）→ true；键缺失 → false（默认值，clearOnDefault 清键）。
 */
export const flagParser = createParser<boolean>({
  parse: (value) => (value === '1' || value === 'true' ? true : null),
  serialize: (value) => (value ? '1' : '0'),
  eq: (a, b) => a === b,
}).withDefault(false);

/** 枚举筛选（从 valueEnum 的 key 列表构造） */
export function enumParser<Enum extends string>(validValues: readonly Enum[]): SingleParserBuilder<Enum> {
  return parseAsStringEnum<Enum>(validValues as Enum[]);
}

/** 字面量字符串筛选（固定可选项） */
export function literalParser<const Literal extends string>(
  validValues: readonly Literal[],
): SingleParserBuilder<Literal> {
  return parseAsStringLiteral(validValues);
}

/** 多选数组（逗号分隔，item URI 编码） */
export const stringArrayParser = parseAsArrayOf(parseAsString, ',');

/** 整数数组 */
export const integerArrayParser = parseAsArrayOf(parseAsInteger, ',');

/**
 * 单日期筛选（UTC ISO-8601 入库，读回为 dayjs）。
 * 搜索表单中 DatePicker 的值类型为 Dayjs | null。
 */
export const dateParser = createParser<Dayjs>({
  parse: (value) => {
    const d = dayjs(value);
    return d.isValid() ? d : null;
  },
  serialize: (value) => value.toISOString(),
  eq: (a, b) => a.isSame(b),
});

/**
 * 日期区间筛选：URL 中 `?range=startISO,endISO`，读回为 [Dayjs, Dayjs] | null。
 * 搜索表单中 RangePicker 的值类型为 [Dayjs, Dayjs] | null。
 */
export const dateRangeParser = createParser<[Dayjs, Dayjs]>({
  parse: (value) => {
    const [start, end] = value.split(',');
    if (!start || !end) return null;
    const s = dayjs(start);
    const e = dayjs(end);
    if (!s.isValid() || !e.isValid()) return null;
    return [s, e];
  },
  serialize: (value) => `${value[0].toISOString()},${value[1].toISOString()}`,
  eq: (a, b) => a[0].isSame(b[0]) && a[1].isSame(b[1]),
});

/**
 * 复杂对象筛选（谨慎使用：URL 长度受限）。
 * parseAsJson 需要 validator，这里用宽松的身份校验。
 */
export function jsonParser<T>(): SingleParserBuilder<T> {
  return parseAsJson<T>((value) => value as T);
}

/**
 * 自定义解析器入口（透传 nuqs createParser），供页面显式覆盖类型推断。
 */
export const customParser = createParser;

/** valueType 枚举（与 antd ProColumns valueType 子集对齐，只列 URL 可同步的） */
export type UrlValueType =
  | 'string'
  | 'number'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'flag'
  | 'enum'
  | 'array'
  | 'date'
  | 'dateRange'
  | 'json';

/** 按 valueType 取 parser 的注册表（enum/json 需参数，见 enumParser/jsonParser） */
export const parserByValueType: Record<
  Exclude<UrlValueType, 'enum' | 'json'>,
  SingleParserBuilder<any>
> = {
  string: stringParser,
  number: floatParser,
  integer: integerParser,
  float: floatParser,
  boolean: flagParser,
  flag: flagParser,
  array: stringArrayParser,
  date: dateParser,
  dateRange: dateRangeParser,
};
