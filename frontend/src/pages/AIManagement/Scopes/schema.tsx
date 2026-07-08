import type { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';

export const scopeTableColumns: ProColumns<Record<string, any>>[] = [
  { title: '名称', dataIndex: 'name', width: 140 },
  {
    title: 'Scope ID',
    dataIndex: 'slug',
    copyable: true,
    width: 160,
    tooltip: '唯一标识，不可重复',
  },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  {
    title: '状态',
    dataIndex: 'isActive',
    width: 90,
    valueType: 'select',
    valueEnum: {
      true: { text: '启用', status: 'Success' },
      false: { text: '停用', status: 'Default' },
    },
  },
  { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', width: 180 },
];
