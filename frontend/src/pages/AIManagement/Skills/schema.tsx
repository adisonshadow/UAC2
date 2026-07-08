import type { ProColumns } from '@ant-design/pro-components';
import { Space, Tag } from 'antd';

export const skillTableColumns: ProColumns<Record<string, any>>[] = [
  { title: '名称', dataIndex: 'name', width: 120 },
  {
    title: 'Skill ID',
    dataIndex: 'slug',
    copyable: true,
    width: 120,
    tooltip: '唯一标识，不可重复',
  },
  { title: '描述', width: 120, dataIndex: 'description' },
  {
    title: '应用范围',
    dataIndex: 'isGlobal',
    width: 120,
    render: (_, record) => (
      <Space size={[0, 4]} wrap>
        {record.isDedicated ? (
          <Tag color="purple">专用</Tag>
        ) : (
          <Tag color="blue">全局</Tag>
        )}
      </Space>
    ),
  },
  {
    title: '关联 Tool',
    dataIndex: 'tools',
    render: (_, record) => (record.tools || []).map((t: any) => t.functionName).join(', ') || '-',
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
  { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', width: 100 },
];
