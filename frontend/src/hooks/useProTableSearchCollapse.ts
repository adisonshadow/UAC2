import { useUserHabit } from '@/hooks/useUserHabit';
import { proTableSearchCollapseKey } from '@/utils/userHabit';
import type { ProTableSearchObjectConfig } from '@/types/proTableSearch';

export type { ProTableSearchObjectConfig };

/** ProTable 查询区收起/展开，状态持久化到浏览器 */
export function useProTableSearchCollapse(
  pageId: string,
  options: ProTableSearchObjectConfig = {},
): ProTableSearchObjectConfig {
  const defaultCollapsed = options.defaultCollapsed ?? true;
  const habitKey = proTableSearchCollapseKey(pageId);
  const [collapsed, setCollapsed] = useUserHabit(habitKey, defaultCollapsed);

  const { defaultCollapsed: _defaultCollapsed, ...rest } = options;

  const config: ProTableSearchObjectConfig = {
    labelWidth: 'auto',
    ...rest,
    collapsed,
    onCollapse: setCollapsed,
  };
  return config;
}
