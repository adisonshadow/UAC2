import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { materializationRunStatusEnum } from '@/enums';
import { formatTableDateTime } from '@/utils/createdUpdatedAtColumn';
import { renderStatusBadge } from '@/utils/statusBadge';

interface MaterializationRunTableProps {
  runs: API.MaterializationRun[];
  loading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

const MaterializationRunTable: React.FC<MaterializationRunTableProps> = ({
  runs,
  loading,
  total = 0,
  page = 1,
  pageSize = 10,
  onPageChange,
}) => {
  const columns: ProColumns<API.MaterializationRun>[] = [
    { title: '连接', dataIndex: 'connectionName', width: 140, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'dbType',
      width: 100,
      render: (_, r) => {
        if (r.dbType === 'mongodb') return 'MongoDB';
        if (r.dbType === 'redis') return 'Redis';
        return 'PostgreSQL';
      },
    },
    { title: 'Schema/前缀', dataIndex: 'targetSchema', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) =>
        renderStatusBadge(String(r.status || '').toLowerCase(), materializationRunStatusEnum, r.status || '-'),
    },
    { title: '时间', dataIndex: 'createdAt', width: 140, render: (_, r) => formatTableDateTime(r.createdAt) },
  ];

  return (
    <ProTable<API.MaterializationRun>
      size="small"
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={runs}
      search={false}
      options={false}
      pagination={{
        current: page,
        pageSize,
        total,
        onChange: onPageChange,
        showSizeChanger: false,
      }}
    />
  );
};

export default MaterializationRunTable;
