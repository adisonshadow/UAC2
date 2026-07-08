import type { ProTableProps } from '@ant-design/pro-components';

/** antd 6 下 ProTable 密度按钮会触发 DensityIcon ref 警告，统一关闭 */
export const DEFAULT_PRO_TABLE_OPTIONS: ProTableProps<any, any>['options'] = {
  density: false,
  fullScreen: true,
  reload: true,
  setting: true,
};
