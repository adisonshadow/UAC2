import type { ProTableProps } from '@ant-design/pro-components';
import { useUserHabit } from '@/hooks/useUserHabit';
import { proTableSearchCollapseKey } from '@/utils/userHabit';

type SearchConfig = NonNullable<ProTableProps<any, any>['search']>;

/** ProTable 查询区收起/展开，状态持久化到浏览器 */
export function useProTableSearchCollapse(
  pageId: string,
  options: SearchConfig = {},
): SearchConfig {
  const defaultCollapsed = options.defaultCollapsed ?? true;
  const habitKey = proTableSearchCollapseKey(pageId);
  const [collapsed, setCollapsed] = useUserHabit(habitKey, defaultCollapsed);

  const { defaultCollapsed: _defaultCollapsed, ...rest } = options;

  return {
    labelWidth: 'auto',
    ...rest,
    collapsed,
    onCollapse: setCollapsed,
  };
}
