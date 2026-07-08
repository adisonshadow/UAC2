import type { ApiServiceDomainTreeItem, ApiServiceListItem } from '@/utils/buildApiServiceDomainTree';

export interface APIDataScopePayload {
  domainCodes: string[];
  serviceCodes?: string[];
}

export interface ApiDomainTreePickerProps {
  /** 是否显示并可勾选具体 API 服务节点（否则仅域节点） */
  showApiSelectable?: boolean;
  /** 交互模式：多选勾选 / 单选高亮 */
  mode?: 'check' | 'select';
  /** 多选：已选 code 列表 */
  value?: string[];
  /** 多选变化 */
  onChange?: (codes: string[]) => void;
  /** 单选：当前选中域 code（`__all__` 表示全部） */
  selectedKey?: string;
  /** 单选变化 */
  onSelect?: (code?: string) => void;
  /** 是否展示「全部」根节点（列表筛选用） */
  showAllNode?: boolean;
  /** 外部传入树数据时可跳过内部请求 */
  treeData?: ApiServiceDomainTreeItem[];
  services?: ApiServiceListItem[];
  loading?: boolean;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface UseApiDomainTreeDataOptions {
  showApiSelectable?: boolean;
  enabled?: boolean;
}

export interface UseApiDomainTreeDataResult {
  treeData: ApiServiceDomainTreeItem[];
  services: ApiServiceListItem[];
  domainCodes: Set<string>;
  loading: boolean;
  reload: () => Promise<void>;
}
