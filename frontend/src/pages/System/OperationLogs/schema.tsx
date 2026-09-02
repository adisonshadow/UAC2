import type { ProColumns } from '@ant-design/pro-components';
import { Tag, Tooltip } from 'antd';
import {
  OPERATION_LOG_DOMAIN,
  OPERATION_LOG_STATUS,
  OPERATION_LOG_TYPE,
} from '@/enums';

export const operationLogTableColumns: ProColumns<Record<string, any>>[] = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    valueType: 'dateTime',
    width: 180,
    sorter: true,
    defaultSortOrder: 'descend',
    hideInSearch: true,
  },
  {
    title: '时间范围',
    dataIndex: 'timeRange',
    valueType: 'dateTimeRange',
    hideInTable: true,
    search: {
      transform: (value) => {
        if (!Array.isArray(value) || value.length < 2) return {};
        return { startTime: value[0], endTime: value[1] };
      },
    },
  },
  {
    title: '操作者',
    dataIndex: 'operatorName',
    width: 140,
    render: (_, record) => {
      if (!record.operatorName && !record.operatorId) {
        return (
          <Tooltip title="历史数据未记录操作者">
            <span>—</span>
          </Tooltip>
        );
      }
      return (
        <span>
          {record.operatorName || '—'}
          {record.operatorType ? (
            <Tag style={{ marginLeft: 6 }}>{record.operatorType}</Tag>
          ) : null}
        </span>
      );
    },
  },
  {
    title: '模块',
    dataIndex: 'domain',
    width: 110,
    valueEnum: OPERATION_LOG_DOMAIN,
    render: (text, record) => {
      if (!record.domain) {
        return (
          <Tooltip title="历史数据未记录模块">
            <span>—</span>
          </Tooltip>
        );
      }
      return text;
    },
  },
  {
    title: '操作类型',
    dataIndex: 'operationType',
    width: 120,
    valueEnum: OPERATION_LOG_TYPE,
  },
  {
    title: '资源',
    dataIndex: 'resourceName',
    width: 180,
    fieldProps: { placeholder: '资源名称关键字' },
    formItemProps: { name: 'keyword' },
    render: (_, record) => {
      const name = record.resourceName;
      const id = record.resourceId ? String(record.resourceId).slice(0, 8) : '';
      return (
        <span>
          {record.resourceType ? <Tag>{record.resourceType}</Tag> : null}
          {name || id || '—'}
        </span>
      );
    },
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    valueEnum: OPERATION_LOG_STATUS,
  },
  {
    title: '耗时(ms)',
    dataIndex: 'durationMs',
    width: 90,
    hideInSearch: true,
  },
  {
    title: 'IP',
    dataIndex: 'ip',
    width: 120,
    hideInSearch: true,
  },
  {
    title: 'Trace ID',
    dataIndex: 'traceId',
    width: 200,
    copyable: true,
    ellipsis: true,
  },
];
