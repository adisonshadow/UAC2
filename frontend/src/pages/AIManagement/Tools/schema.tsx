import type { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';

export const toolTableColumns: ProColumns<Record<string, any>>[] = [
  { title: '名称', dataIndex: 'name', width: 140 },
  { title: 'Function Name', dataIndex: 'functionName', copyable: true, width: 180 },
  {
    title: 'Scope ID',
    dataIndex: ['scope', 'slug'],
    width: 140,
  },
  {
    title: '执行类型',
    dataIndex: 'executionType',
    width: 130,
    render: (_, record) => <Tag>{record.executionType}</Tag>,
  },
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
