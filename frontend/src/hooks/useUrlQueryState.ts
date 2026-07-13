import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const URL_PAGE_KEY = 'page';
export const URL_PAGE_SIZE_KEY = 'pageSize';
export const URL_SCOPE_KEY = 'scope';

export function parseUrlPage(value: string | null, fallback = 1): number {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

type SearchParamPatch = Record<string, string | null | undefined>;

export function usePatchSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const patchSearchParams = useCallback(
    (patch: SearchParamPatch, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) => {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          });
          return next;
        },
        { replace: options?.replace ?? true },
      );
    },
    [setSearchParams],
  );

  return { searchParams, patchSearchParams };
}

export function useUrlPagination(defaultPageSize = 10) {
  const { searchParams, patchSearchParams } = usePatchSearchParams();

  const page = parseUrlPage(searchParams.get(URL_PAGE_KEY), 1);
  const pageSize = parseUrlPage(searchParams.get(URL_PAGE_SIZE_KEY), defaultPageSize);

  const setPagination = useCallback(
    (nextPage: number, nextPageSize = pageSize) => {
      patchSearchParams({
        [URL_PAGE_KEY]: nextPage <= 1 ? null : String(nextPage),
        [URL_PAGE_SIZE_KEY]: nextPageSize === defaultPageSize ? null : String(nextPageSize),
      });
    },
    [defaultPageSize, pageSize, patchSearchParams],
  );

  const resetPage = useCallback(() => {
    patchSearchParams({ [URL_PAGE_KEY]: null, [URL_PAGE_SIZE_KEY]: null });
  }, [patchSearchParams]);

  return { page, pageSize, setPagination, resetPage, searchParams };
}

export function useScopeFromUrl() {
  const { searchParams, patchSearchParams } = usePatchSearchParams();
  const scope = searchParams.get(URL_SCOPE_KEY) || undefined;

  const setScope = useCallback(
    (next?: string) => {
      patchSearchParams({
        [URL_SCOPE_KEY]: next ?? null,
        [URL_PAGE_KEY]: null,
        [URL_PAGE_SIZE_KEY]: null,
      });
    },
    [patchSearchParams],
  );

  return [scope, setScope] as const;
}
