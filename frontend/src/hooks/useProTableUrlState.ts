/**
 * L2 胶水层：ProTable 表格状态（分页/筛选/排序）↔ URL（nuqs）桥接 hook。
 *
 * 方案 6.2/6.4/6.5/6.7 落地。核心原则：
 * - URL 是唯一数据源：page/pageSize/筛选/排序全部从 URL 解析；
 * - 筛选键白名单（filterKeys），类型从 columns 推断或显式 parsers 覆盖；
 * - 分页可选（树表 syncPagination=false 只同步筛选）；
 * - 排序 opt-in（sortable）；
 * - **禁止**把动态 URL 状态塞进 ProTable 的 params（params 变化会重置第 1 页）。
 *
 * 本 hook 只做状态读写，请求编排（reload 时机、manualRequest）由组件层负责。
 */
import type { ProColumns } from '@ant-design/pro-components';
import { createParser, parseAsInteger, useQueryStates } from 'nuqs';
import type { SingleParserBuilder } from 'nuqs';
import { useMemo } from 'react';
import { inferParsersFromColumns } from '@/utils/tableUrlState/inferFromColumns';
import { resolveTableUrlKeys, type TableUrlKeys } from '@/utils/tableUrlState/keys';
import { stringParser } from '@/utils/tableUrlState/parsers';

/** URL 排序状态：单字段 field:order */
export type UrlSortState = { field: string; order: 'asc' | 'desc' } | null;

const CONTROL_KEYS = new Set(['page', 'pageSize', 'sort']);

const sortParser = createParser<UrlSortState>({
  parse: (value) => {
    const [field, order] = value.split(':');
    if (!field || (order !== 'asc' && order !== 'desc')) return null;
    return { field, order };
  },
  serialize: (state) => (state ? `${state.field}:${state.order}` : ''),
  eq: (a, b) =>
    a === null ? b === null : b !== null && a.field === b.field && a.order === b.order,
});

export type UseProTableUrlStateOptions = {
  /** 筛选白名单键（页面声明）；URL 中只同步这些键 */
  filterKeys?: readonly string[];
  /** 显式 parser 覆盖（键 → parser）；优先级高于 columns 推断 */
  parsers?: Record<string, SingleParserBuilder<any>>;
  /** 用于推断筛选类型的 columns（当页面未提供 parsers 时） */
  columns?: ProColumns<any>[];
  /** 分页键名覆盖（多实例用 urlKeys 或 prefix） */
  urlKeys?: TableUrlKeys;
  /** 多实例前缀（ASCII），与 urlKeys 二选一 */
  prefix?: string;
  /** 默认每页条数（pageSize 键缺省时的回退值） */
  defaultPageSize?: number;
  /** 树表等无分页场景传 false：只同步筛选，不声明 page/pageSize 键 */
  syncPagination?: boolean;
  /** 是否启用 URL 排序（opt-in，仅对声明了排序需求的表格开启） */
  sortable?: boolean;
  /** 总开关：Drawer/Modal 内表格可传 false 关闭 URL 读写 */
  syncUrl?: boolean;
};

export type ProTableUrlState = {
  page: number;
  pageSize: number;
  /** 筛选表单值（供 setFieldsValue / initialValues 回填；空值已剔除） */
  filterValues: Record<string, unknown>;
  sort: UrlSortState;
  /** URL 中是否存在任何表格状态（供组件决定是否抑制首屏默认请求） */
  hasUrlState: boolean;
  setPagination: (current: number, pageSize?: number) => void;
  setFilters: (values: Record<string, unknown>, opts?: { resetPage?: boolean }) => void;
  resetFilters: () => void;
  setSort: (field: string, order: 'asc' | 'desc') => void;
  clearSort: () => void;
};

export function useProTableUrlState(
  options: UseProTableUrlStateOptions = {},
): ProTableUrlState {
  const {
    filterKeys = [],
    parsers: explicitParsers,
    columns,
    urlKeys,
    prefix,
    defaultPageSize = 10,
    syncPagination = true,
    sortable = false,
    syncUrl = true,
  } = options;

  // 过滤掉与保留键冲突的筛选键
  const safeFilterKeys = useMemo(
    () => filterKeys.filter((key) => !CONTROL_KEYS.has(key)),
    // filterKeys 为外部数组，join 后做依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKeys.join(',')],
  );

  const resolvedUrlKeys = useMemo(
    () => resolveTableUrlKeys(urlKeys, prefix),
    [urlKeys, prefix],
  );

  const inferredParsers = useMemo(
    () =>
      columns && safeFilterKeys.length > 0
        ? inferParsersFromColumns(columns, safeFilterKeys)
        : {},
    // columns 引用稳定（页面 useMemo 缓存），safeFilterKeys 由 join 派生
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, safeFilterKeys.join(',')],
  );

  const filterParsers = useMemo(() => {
    const result: Record<string, SingleParserBuilder<any>> = {};
    safeFilterKeys.forEach((key) => {
      result[key] =
        explicitParsers?.[key] ??
        inferredParsers[key] ??
        stringParser;
    });
    return result;
  }, [explicitParsers, inferredParsers, safeFilterKeys]);

  const allParsers = useMemo(() => {
    const parsers: Record<string, SingleParserBuilder<any>> = { ...filterParsers };
    if (syncPagination) {
      parsers.page = parseAsInteger.withDefault(1);
      parsers.pageSize = parseAsInteger.withDefault(defaultPageSize);
    }
    if (sortable) {
      parsers.sort = sortParser;
    }
    return parsers;
  }, [defaultPageSize, filterParsers, sortable, syncPagination]);

  const [states, setStates] = useQueryStates(allParsers, {
    history: 'replace',
    clearOnDefault: true,
    // shallow=false：URL 写入同时走 react-router navigate，
    // 保证依赖 useSearchParams 的页面（dataSource 模式自管拉取）也能感知 URL 变化
    shallow: false,
    urlKeys: syncUrl ? resolvedUrlKeys : undefined,
  });

  const page = syncPagination ? (states.page ?? 1) : 1;
  const pageSize = syncPagination ? (states.pageSize ?? defaultPageSize) : defaultPageSize;

  const filterValues = useMemo(() => {
    const result: Record<string, unknown> = {};
    safeFilterKeys.forEach((key) => {
      const value = states[key];
      if (value !== null && value !== undefined && value !== '') result[key] = value;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, safeFilterKeys.join(',')]);

  const sort = sortable ? (states.sort ?? null) : null;
  const hasUrlState =
    (syncPagination && (page > 1 || pageSize !== defaultPageSize)) ||
    Object.keys(filterValues).length > 0 ||
    sort != null;

  const setPagination = (current: number, nextPageSize = pageSize) => {
    if (!syncUrl || !syncPagination) return;
    setStates({
      page: current <= 1 ? null : current,
      pageSize: nextPageSize === defaultPageSize ? null : nextPageSize,
    });
  };

  /** 写入筛选：未包含的已声明键视为清空；默认重置到第 1 页 */
  const setFilters = (values: Record<string, unknown>, opts?: { resetPage?: boolean }) => {
    if (!syncUrl) return;
    const resetPage = opts?.resetPage ?? true;
    const patch: Record<string, unknown> = {};
    safeFilterKeys.forEach((key) => {
      const value = values[key];
      const empty = value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0);
      patch[key] = empty ? null : value;
    });
    if (resetPage && syncPagination) patch.page = null;
    setStates(patch);
  };

  const resetFilters = () => {
    if (!syncUrl) return;
    const patch: Record<string, unknown> = {};
    safeFilterKeys.forEach((key) => {
      patch[key] = null;
    });
    if (syncPagination) patch.page = null;
    setStates(patch);
  };

  const setSort = (field: string, order: 'asc' | 'desc') => {
    if (!syncUrl || !sortable) return;
    setStates({ sort: { field, order } });
  };

  const clearSort = () => {
    if (!syncUrl || !sortable) return;
    setStates({ sort: null });
  };

  return {
    page,
    pageSize,
    filterValues,
    sort,
    hasUrlState,
    setPagination,
    setFilters,
    resetFilters,
    setSort,
    clearSort,
  };
}

export default useProTableUrlState;
