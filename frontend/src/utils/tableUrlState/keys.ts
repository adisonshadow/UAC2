/**
 * L1 状态定义层：URL 键名约定、保留键、多实例前缀工具。
 *
 * 说明：本文件是方案（docs/TODOs/ProTable-URL状态同步方案.md）6.5/6.7 的落地。
 * 键名与旧 `tableUrlHelper` 保持一致（page/pageSize/scope），避免破坏既有 URL。
 * 多实例用 ASCII 前缀（禁止中文键名）。
 */

/** 分页页码键（1-based，与后端 offset=(page-1)*size 一致） */
export const TABLE_PAGE_KEY = 'page';
/** 分页每页条数键 */
export const TABLE_PAGE_SIZE_KEY = 'pageSize';
/** 域/作用域键（沿用现状，不被表格覆盖） */
export const TABLE_SCOPE_KEY = 'scope';
/** URL 排序键（opt-in，仅启用排序同步的表格使用） */
export const TABLE_SORT_KEY = 'sort';

/** 默认不作为筛选字段写入/读出的 URL 键 */
export const DEFAULT_RESERVED_URL_KEYS = [
  TABLE_PAGE_KEY,
  TABLE_PAGE_SIZE_KEY,
  TABLE_SCOPE_KEY,
  TABLE_SORT_KEY,
] as const;

export type TablePaginationState = {
  current: number;
  pageSize: number;
};

/** 表格 URL 状态键配置（供 useQueryStates 的 urlKeys 使用） */
export type TableUrlKeys = {
  page?: string;
  pageSize?: string;
  sort?: string;
};

/**
 * 为多实例表格生成带前缀的键名。
 *
 * 示例：withPrefix('devices_') → { page: 'devices_page', pageSize: 'devices_pageSize' }
 * 单实例页面不要使用前缀，保持 URL 友好（?page=2&status=ok）。
 */
export function withPrefix(prefix: string): TableUrlKeys {
  return {
    page: `${prefix}${TABLE_PAGE_KEY}`,
    pageSize: `${prefix}${TABLE_PAGE_SIZE_KEY}`,
    sort: `${prefix}${TABLE_SORT_KEY}`,
  };
}

/** 合并用户自定义键与前缀（前缀优先于默认键名） */
export function resolveTableUrlKeys(urlKeys?: TableUrlKeys, prefix?: string): TableUrlKeys {
  const prefixed = prefix ? withPrefix(prefix) : {};
  return {
    page: urlKeys?.page ?? prefixed.page ?? TABLE_PAGE_KEY,
    pageSize: urlKeys?.pageSize ?? prefixed.pageSize ?? TABLE_PAGE_SIZE_KEY,
    sort: urlKeys?.sort ?? prefixed.sort ?? TABLE_SORT_KEY,
  };
}

/** 从 URLSearchParams 解析分页（容错非法值） */
export function parseUrlPage(value: string | null, fallback = 1): number {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseUrlPageSize(value: string | null, fallback: number): number {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
