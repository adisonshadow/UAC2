/**
 * L2 胶水层：详情/编辑页「回列表」保留列表 query（方案 6.9）。
 *
 * 问题：详情页普遍 `navigate(listPath)` 不带 search，导致按钮回列表丢状态。
 * 约定（组合使用）：
 * 1. 列表页跳详情用 `useOpenDetail()` —— 把当前 `location.search` 写入
 *    `location.state[LIST_STATE_KEY]`；
 * 2. 详情页回列表用 `useReturnToList()` —— 读取该 state 拼回 search；
 *    深链直达（无来源 search）时回裸 listPath（可接受）。
 * 3. 浏览器后退/前进不依赖本工具（历史栈中自带 query）。
 */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const LIST_STATE_KEY = 'fromSearch';

/** 详情页：读取进入详情时的列表 search（深链直达时为 undefined） */
export function useListSearchFromState(): string | undefined {
  const location = useLocation();
  const state = location.state as Record<string, unknown> | null;
  const value = state?.[LIST_STATE_KEY];
  return typeof value === 'string' ? value : undefined;
}

/**
 * 详情页：返回列表并保留来源 query。
 * 无来源 search 时回裸 listPath。
 * extraSearch：在来源 search 之后追加额外 query（如保存成功后的 highlight=id）。
 */
export function useReturnToList() {
  const navigate = useNavigate();
  const fromSearch = useListSearchFromState();

  const navigateToList = useCallback(
    (listPath: string, options?: { replace?: boolean; extraSearch?: string }) => {
      const { replace = false, extraSearch } = options ?? {};
      let search = fromSearch;
      if (extraSearch) {
        search = search ? `${search}&${extraSearch}` : `?${extraSearch}`;
      }
      if (search) {
        navigate(
          { pathname: listPath, search },
          { replace },
        );
      } else {
        navigate(listPath, { replace });
      }
    },
    [navigate, fromSearch],
  );

  return navigateToList;
}

/**
 * 列表页：跳详情/编辑时携带当前 search 到 location.state，
 * 供详情页「回列表」按钮恢复列表状态。
 */
export function useOpenDetail() {
  const navigate = useNavigate();
  const location = useLocation();

  const openDetail = useCallback(
    (path: string, extraState?: Record<string, unknown>) => {
      navigate(path, {
        state: { ...extraState, [LIST_STATE_KEY]: location.search },
      });
    },
    [navigate, location.search],
  );

  return openDetail;
}
