/**
 * L1 状态定义层：从 ProColumns 推断筛选字段的 nuqs parser。
 *
 * 方案 6.5 落地：页面默认只声明「白名单键」（urlFilterKeys），类型优先从
 * columns 的 valueType / valueEnum / fieldProps 推断，避免每页再维护一份类型配置。
 * 推断不足或冲突时，页面可用 urlParsers 显式覆盖。
 */
import type { ProColumns } from '@ant-design/pro-components';
import {
  dateParser,
  dateRangeParser,
  enumParser,
  floatParser,
  integerParser,
  stringArrayParser,
  stringParser,
} from './parsers';
import type { SingleParserBuilder } from 'nuqs';

/** 列中可参与搜索的 valueType 子集（ProFieldValueType 的字符串子集） */
const DATE_TYPES = new Set(['date', 'dateTime', 'time']);
const RANGE_TYPES = new Set(['dateRange', 'dateTimeRange', 'timeRange']);
const INTEGER_TYPES = new Set(['digit', 'integer']);
const FLOAT_TYPES = new Set(['number', 'money', 'percent', 'float']);
const ARRAY_TYPES = new Set(['checkbox', 'array']);

function getFieldMode(col: ProColumns<any>): string | undefined {
  return (col.fieldProps as { mode?: string } | undefined)?.mode;
}

/**
 * 根据单列配置推断筛选 parser。
 * 规则优先级：valueType 推断 > valueEnum（枚举/多选）> 默认字符串。
 */
export function inferColumnParser(col: ProColumns<any>): SingleParserBuilder<any> {
  const valueType = typeof col.valueType === 'string' ? col.valueType : undefined;

  if (valueType && DATE_TYPES.has(valueType)) {
    return dateParser;
  }
  if (valueType && RANGE_TYPES.has(valueType)) {
    return dateRangeParser;
  }
  if (valueType && INTEGER_TYPES.has(valueType)) {
    return integerParser;
  }
  if (valueType && FLOAT_TYPES.has(valueType)) {
    return floatParser;
  }
  if (valueType && ARRAY_TYPES.has(valueType)) {
    return stringArrayParser;
  }

  const mode = getFieldMode(col);
  if (mode === 'multiple' || mode === 'tags') {
    return stringArrayParser;
  }

  // 枚举：valueEnum 的 key 作为 URL 值
  if (col.valueEnum && typeof col.valueEnum === 'object') {
    const keys = Object.keys(col.valueEnum);
    if (keys.length > 0) {
      return mode === 'multiple' || mode === 'tags' ? stringArrayParser : enumParser(keys);
    }
  }

  return stringParser;
}

/**
 * 从 columns 与白名单键推断 parser 映射。
 * 仅处理扁平 dataIndex 的列；dataIndex 为数组（多级）时跳过。
 */
export function inferParsersFromColumns<T extends Record<string, any>>(
  columns: ProColumns<T>[],
  filterKeys: readonly string[],
): Record<string, SingleParserBuilder<any>> {
  const result: Record<string, SingleParserBuilder<any>> = {};
  const keySet = new Set(filterKeys);

  columns.forEach((col) => {
    const dataIndex = col.dataIndex;
    if (typeof dataIndex !== 'string') return;
    if (!keySet.has(dataIndex)) return;
    if (col.hideInSearch === true) return;

    result[dataIndex] = inferColumnParser(col);
  });

  // 白名单里在 columns 中找不到的键：默认字符串 parser
  filterKeys.forEach((key) => {
    if (!result[key]) result[key] = stringParser;
  });

  return result;
}
