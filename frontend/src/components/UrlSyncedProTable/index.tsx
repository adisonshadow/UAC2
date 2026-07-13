import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ParamsType, ProTableProps } from '@ant-design/pro-components';
import type { TablePaginationPlacement } from 'antd/es/table/interface';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { URL_PAGE_KEY, URL_PAGE_SIZE_KEY, parseUrlPage } from '@/hooks/useUrlQueryState';

export type UrlSyncedProTableProps<
  T extends Record<string, any>,
  U extends ParamsType = ParamsType,
  ValueType = 'text',
> = ProTableProps<T, U, ValueType> & {
  defaultPageSize?: number;
  urlPageKey?: string;
  urlPageSizeKey?: string;
  /** 为 false 时不读写 URL（如 Drawer / Modal 内表格） */
  syncUrl?: boolean;
};

const DEFAULT_PAGINATION_PLACEMENT: TablePaginationPlacement[] = ['bottomStart'];

function readUrlPagination(
  searchParams: URLSearchParams,
  urlPageKey: string,
  urlPageSizeKey: string,
  defaultPageSize: number,
) {
  return {
    page: parseUrlPage(searchParams.get(urlPageKey), 1),
    pageSize: parseUrlPage(searchParams.get(urlPageSizeKey), defaultPageSize),
  };
}

export function UrlSyncedProTable<
  T extends Record<string, any>,
  U extends ParamsType = ParamsType,
  ValueType = 'text',
>(props: UrlSyncedProTableProps<T, U, ValueType>) {
  const {
    defaultPageSize = 10,
    urlPageKey = URL_PAGE_KEY,
    urlPageSizeKey = URL_PAGE_SIZE_KEY,
    syncUrl = true,
    pagination,
    request,
    actionRef,
    params,
    ...rest
  } = props;

  const [searchParams, setSearchParams] = useSearchParams();
  const internalActionRef = useRef<ActionType | undefined>(undefined);
  const suppressPaginationResetRef = useRef(true);

  const resolvedDefaultPageSize =
    typeof pagination === 'object' && pagination?.pageSize
      ? Number(pagination.pageSize)
      : defaultPageSize;

  const { page, pageSize } = readUrlPagination(
    searchParams,
    urlPageKey,
    urlPageSizeKey,
    resolvedDefaultPageSize,
  );

  useEffect(() => {
    suppressPaginationResetRef.current = true;
    const frameId = requestAnimationFrame(() => {
      suppressPaginationResetRef.current = false;
    });
    return () => cancelAnimationFrame(frameId);
  }, [page, pageSize, searchParams.toString()]);

  const syncPaginationToUrl = useCallback(
    (nextPage: number, nextPageSize: number) => {
      if (!syncUrl) return;

      const current = readUrlPagination(
        searchParams,
        urlPageKey,
        urlPageSizeKey,
        resolvedDefaultPageSize,
      );
      if (nextPage === current.page && nextPageSize === current.pageSize) return;

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextPage <= 1) next.delete(urlPageKey);
          else next.set(urlPageKey, String(nextPage));
          if (nextPageSize === resolvedDefaultPageSize) next.delete(urlPageSizeKey);
          else next.set(urlPageSizeKey, String(nextPageSize));
          return next;
        },
        { replace: true },
      );
    },
    [
      resolvedDefaultPageSize,
      searchParams,
      setSearchParams,
      syncUrl,
      urlPageKey,
      urlPageSizeKey,
    ],
  );

  const mergedPagination = useMemo(() => {
    if (pagination === false) return false;
    const base = typeof pagination === 'object' ? pagination : {};
    if (!syncUrl) {
      return {
        defaultPageSize: resolvedDefaultPageSize,
        showSizeChanger: true,
        placement: DEFAULT_PAGINATION_PLACEMENT,
        ...base,
      };
    }
    return {
      defaultPageSize: resolvedDefaultPageSize,
      showSizeChanger: true,
      placement: DEFAULT_PAGINATION_PLACEMENT,
      ...base,
      current: page,
      pageSize,
      onChange: (nextPage: number, nextPageSize: number) => {
        if (
          suppressPaginationResetRef.current
          && (nextPage !== page || nextPageSize !== pageSize)
        ) {
          return;
        }
        syncPaginationToUrl(nextPage, nextPageSize);
        base.onChange?.(nextPage, nextPageSize);
      },
      onShowSizeChange: (nextPage: number, nextPageSize: number) => {
        syncPaginationToUrl(nextPage, nextPageSize);
        base.onShowSizeChange?.(nextPage, nextPageSize);
      },
    };
  }, [page, pageSize, pagination, resolvedDefaultPageSize, syncPaginationToUrl, syncUrl]);

  const wrappedRequest = useMemo(() => {
    if (!request) return undefined;
    if (!syncUrl) return request;
    return async (requestParams: U, sort: Record<string, any>, filter: Record<string, any>) =>
      request({ ...requestParams, current: page, pageSize } as U, sort, filter);
  }, [page, pageSize, request, syncUrl]);

  useEffect(() => {
    if (!syncUrl || !request) return;
    internalActionRef.current?.reload?.();
  }, [page, pageSize, syncUrl, request]);

  const mergedParams = useMemo(() => {
    if (!syncUrl) return params;
    return { ...(params as object), current: page, pageSize } as unknown as U;
  }, [page, pageSize, params, syncUrl]);

  const mergedActionRef = actionRef ?? internalActionRef;

  return (
    <ProTable<T, U, ValueType>
      {...rest}
      actionRef={mergedActionRef}
      request={wrappedRequest}
      pagination={mergedPagination}
      params={mergedParams}
    />
  );
}

export default UrlSyncedProTable;
