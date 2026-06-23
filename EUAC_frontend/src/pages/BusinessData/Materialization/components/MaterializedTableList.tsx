import { Badge, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
interface MaterializedTableListProps {
  items: API.MaterializationStatusItem[];
  loading?: boolean;
}

function renderStaleBadge(item: API.MaterializationStatusItem) {
  if (item.materializedVersion == null) {
    return <Badge status="default" text="未物化" />;
  }
  if (item.currentVersion === item.materializedVersion) {
    return <Badge status="success" text="最新" />;
  }
  if ((item.currentVersion || 0) > (item.materializedVersion || 0)) {
    return (
      <Tooltip
        title={`模型已更新至 v${item.currentVersion}，物化仍为 v${item.materializedVersion}，建议重新物化`}
      >
        <Badge status="warning" text="非最新" />
      </Tooltip>
    );
  }
  return <Badge status="processing" text="-" />;
}

const MaterializedTableList: React.FC<MaterializedTableListProps> = ({ items, loading }) => {
  const columns: ColumnsType<API.MaterializationStatusItem> = [
    {
      title: 'Entity',
      render: (_, r) => (
        <div>
          <div>{r.label}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.code}</div>
        </div>
      ),
    },
    { title: '表名', dataIndex: 'tableName', width: 120 },
    {
      title: '模型版本',
      dataIndex: 'currentVersion',
      width: 90,
      render: (v) => `v${v}`,
    },
    {
      title: '物化版本',
      dataIndex: 'materializedVersion',
      width: 90,
      render: (v) => (v != null ? `v${v}` : '-'),
    },
    {
      title: '状态',
      width: 100,
      render: (_, r) => renderStaleBadge(r),
    },
  ];

  return (
    <Table
      size="small"
      rowKey="entityId"
      loading={loading}
      columns={columns}
      dataSource={items.filter((i) => i.entityId)}
      pagination={false}
    />
  );
};

export default MaterializedTableList;
