import { LineChartOutlined, PartitionOutlined } from '@ant-design/icons';
import type { AddReferenceParams } from '@EADAF/ai-base';
import { useChatReference } from '@EADAF/ai-base';
import { Empty, Table, Typography } from 'antd';
import type { ColumnType, ColumnsType } from 'antd/es/table';
import React, { useMemo } from 'react';
import ChatReferenceTarget from '@/components/ChatReferenceTarget';
import {
  buildCodePathTree,
  flattenCodePathTree,
  type FlatCodePathRow,
} from '../../utils/buildCodePathTree';

const { Text } = Typography;

type CodePathItem = { code?: string; id?: string; label?: string };

interface CodePathTreeTableProps<T extends CodePathItem> {
  items: T[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (item: T) => void;
  getLeafLabel?: (item: T, segment: string) => string;
  nameColumnTitle?: string;
  extraColumns?: ColumnsType<FlatCodePathRow<T>>;
  toolbar?: React.ReactNode;
  emptyText?: string;
  showHeader?: boolean;
  scroll?: { x?: number | string };
  leafIcon?: React.ReactNode;
  getLeafReference?: (item: T) => AddReferenceParams;
  getScopeReference?: (code: string, name: string) => AddReferenceParams;
}

function mapColumnsForTree<T extends CodePathItem>(
  columns: ColumnsType<FlatCodePathRow<T>>,
): ColumnsType<FlatCodePathRow<T>> {
  return columns.map((col) => {
    const typedCol = col as ColumnType<FlatCodePathRow<T>>;
    const dataIndex = typedCol.dataIndex;

    const readLeafValue = (leaf: T) => {
      if (!dataIndex) return undefined;
      if (Array.isArray(dataIndex)) {
        let current: unknown = leaf;
        for (const key of dataIndex) {
          current = (current as Record<string, unknown> | undefined)?.[String(key)];
        }
        return current;
      }
      return (leaf as Record<string, unknown>)[String(dataIndex)];
    };

    if (!typedCol.render) {
      if (!dataIndex) return col;
      return {
        ...typedCol,
        render: (_, record) => {
          if (record.isScopeNode || !record.data) return null;
          const cellValue = readLeafValue(record.data);
          return cellValue != null && cellValue !== '' ? cellValue : '-';
        },
      };
    }

    const render = typedCol.render;
    return {
      ...typedCol,
      render: (value, record, index) => {
        if (record.isScopeNode || !record.data) return null;
        const leaf = record.data;
        const cellValue = dataIndex ? readLeafValue(leaf) : value;
        // extraColumns 的 render 第二参数为叶子行数据 T（与 ProColumns 一致）
        return (render as (v: unknown, r: T, i: number) => React.ReactNode)(
          cellValue,
          leaf,
          index,
        );
      },
    };
  });
}

const CodePathTreeTable = <T extends CodePathItem>({
  items,
  loading,
  selectedId,
  onSelect,
  getLeafLabel,
  nameColumnTitle = 'Scope / 条目',
  extraColumns = [],
  toolbar,
  emptyText = '暂无数据',
  showHeader = true,
  scroll,
  leafIcon,
  getLeafReference,
  getScopeReference,
}: CodePathTreeTableProps<T>) => {
  const { addReference } = useChatReference();
  const tableData = useMemo(
    () => flattenCodePathTree(buildCodePathTree(items, getLeafLabel)),
    [items, getLeafLabel],
  );

  const columns: ColumnsType<FlatCodePathRow<T>> = [
    {
      title: nameColumnTitle,
      dataIndex: 'name',
      render: (_, record) => {
        const indent = record.depth * 16;
        return (
          <div style={{ paddingLeft: indent, display: 'flex', alignItems: 'center', gap: 8 }}>
            {record.isScopeNode ? <PartitionOutlined /> : leafIcon ?? <LineChartOutlined />}
            <Text strong={!record.isScopeNode}>{record.name}</Text>
            {!record.isScopeNode && record.data?.code && (
              <Text type="secondary" style={{ fontSize: 12 }}>{record.data.code}</Text>
            )}
            {record.isScopeNode && getScopeReference && (
              <ChatReferenceTarget
                onClick={() => addReference(getScopeReference(record.code, record.name))}
              />
            )}
            {!record.isScopeNode && record.data && getLeafReference && (
              <ChatReferenceTarget
                onClick={() => addReference(getLeafReference(record.data!))}
              />
            )}
          </div>
        );
      },
    },
    ...mapColumnsForTree(extraColumns),
  ];

  return (
    <div>
      {toolbar && <div style={{ marginBottom: 8 }}>{toolbar}</div>}
      <Table<FlatCodePathRow<T>>
        size="small"
        rowKey="code"
        loading={loading}
        showHeader={showHeader}
        columns={columns}
        dataSource={tableData}
        pagination={false}
        scroll={scroll}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
          ),
        }}
        onRow={(record) => ({
          onClick: () => {
            if (!record.isScopeNode && record.data) {
              onSelect?.(record.data);
            }
          },
          style: {
            cursor: record.isScopeNode ? 'default' : onSelect ? 'pointer' : undefined,
            background:
              !record.isScopeNode && record.id === selectedId ? 'rgba(24,144,255,0.08)' : undefined,
          },
        })}
      />
    </div>
  );
};

export default CodePathTreeTable;
