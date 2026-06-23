import type { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';

export const requestLogTableColumns: ProColumns<Record<string, any>>[] = [
  { title: 'Trace ID', dataIndex: 'traceId', copyable: true, width: 280 },
  { title: 'Model Slug', dataIndex: 'slug', width: 140 },
  {
    title: '状态码',
    dataIndex: 'statusCode',
    width: 90,
    render: (_, record) => (
      <Tag color={record.statusCode >= 400 ? 'error' : 'success'}>{record.statusCode}</Tag>
    ),
  },
  { title: '耗时(ms)', dataIndex: 'durationMs', width: 100 },
  { title: '错误码', dataIndex: 'errorCode', width: 120 },
  { title: '时间', dataIndex: 'createdAt', valueType: 'dateTime', width: 180 },
];
