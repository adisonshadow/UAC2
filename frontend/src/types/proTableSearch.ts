import type { ReactNode } from 'react';

/** ProTable search 的对象形态（useProTableSearchCollapse 返回值） */
export interface ProTableSearchObjectConfig {
  labelWidth?: number | 'auto';
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  className?: string;
  layout?: 'horizontal' | 'vertical' | 'inline';
  searchText?: string;
  resetText?: string;
  submitText?: string;
  optionRender?: false | ((searchConfig: unknown, props: unknown, dom: ReactNode[]) => ReactNode[]);
}
