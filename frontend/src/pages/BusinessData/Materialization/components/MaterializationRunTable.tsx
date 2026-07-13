import { Popover, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import UrlSyncedProTable from '@/components/UrlSyncedProTable';
import { materializationRunStatusEnum } from '@/enums';
import { formatTableDateTime } from '@/utils/createdUpdatedAtColumn';
import { renderStatusBadge } from '@/utils/statusBadge';

interface MaterializationRunTableProps {
  runs: API.MaterializationRun[];
  loading?: boolean;
  total?: number;
}

function isFailedRunStatus(status?: string): boolean {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'failed' || normalized === 'failure';
}

function renderRunStatus(run: API.MaterializationRun) {
  const status = String(run.status || '').toLowerCase();
  const badge = renderStatusBadge(status, materializationRunStatusEnum, run.status || '-');

  if (!isFailedRunStatus(run.status)) return badge;

  const errorContent = run.errorMessage?.trim() || '无详细错误信息';

  return (
    <Popover
      title="失败原因"
      content={
        <Typography.Paragraph
          style={{ margin: 0, maxWidth: 360, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {errorContent}
        </Typography.Paragraph>
      }
      trigger="click"
    >
      <span style={{ cursor: 'pointer' }}>{badge}</span>
    </Popover>
  );
}

const MaterializationRunTable: React.FC<MaterializationRunTableProps> = ({
  runs,
  loading,
  total = 0,
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
      render: (_, r) => renderRunStatus(r),
    },
    { title: '时间', dataIndex: 'createdAt', width: 140, render: (_, r) => formatTableDateTime(r.createdAt) },
  ];

  return (
    <UrlSyncedProTable<API.MaterializationRun>
      size="small"
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={runs}
      search={false}
      options={false}
      defaultPageSize={10}
      pagination={{ total, showSizeChanger: false }}
    />
  );
};

export default MaterializationRunTable;
