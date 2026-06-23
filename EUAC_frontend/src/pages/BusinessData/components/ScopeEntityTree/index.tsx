import {
  BuildOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MessageOutlined,
  MoreOutlined,
  PartitionOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Empty, Popconfirm, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo } from 'react';
import { buildScopeTree, type ScopeTreeItem } from '../../utils/buildScopeTree';
const { Text } = Typography;

type FlatTreeRow = Omit<ScopeTreeItem, 'children'> & { depth: number };

interface ScopeEntityTreeProps {
  entities: API.BusinessDataEntity[];
  selectedEntityId?: string;
  showHeader?: boolean;
  onSelectEntity: (entity: API.BusinessDataEntity) => void;
  onToggleLock?: (entity: API.BusinessDataEntity) => void;
  onEditEntity?: (entity: API.BusinessDataEntity) => void;
  onDeleteEntity?: (entity: API.BusinessDataEntity) => void;
  onAddToChat?: (entity: API.BusinessDataEntity) => void;
}

function flattenAll(nodes: ScopeTreeItem[], depth = 0): FlatTreeRow[] {
  return nodes.flatMap((node) => {
    const { children, ...rest } = node;
    const row: FlatTreeRow = { ...rest, depth };
    if (children?.length) {
      return [row, ...flattenAll(children, depth + 1)];
    }
    return [row];
  });
}

const ScopeEntityTree: React.FC<ScopeEntityTreeProps> = ({
  entities,
  selectedEntityId,
  showHeader = true,
  onSelectEntity,
  onToggleLock,
  onEditEntity,
  onDeleteEntity,
  onAddToChat,
}) => {
  const tableData = useMemo(() => flattenAll(buildScopeTree(entities)), [entities]);

  const columns: ColumnsType<FlatTreeRow> = [
    {
      title: 'Scope / Entity',
      dataIndex: 'name',
      render: (_, record) => {
        const indent = record.depth * 16;
        return (
          <div style={{ paddingLeft: indent, display: 'flex', alignItems: 'center', gap: 8 }}>
            {record.isScopeNode ? <PartitionOutlined /> : <DatabaseOutlined />}
            <Text strong={!record.isScopeNode}>{record.name}</Text>
            {!record.isScopeNode && record.isLocked && (
              <LockOutlined style={{ color: '#faad14' }} title="已锁定" />
            )}
            {!record.isScopeNode && record.version != null && (
              <Tag color="blue">v{record.version}</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '类型',
      width: 88,
      render: (_, record) =>
        record.isScopeNode ? (
          <Tag icon={<PartitionOutlined />}>Scope</Tag>
        ) : record.entityKind === 'json_schema' ? (
          <Tag color="purple">JSON</Tag>
        ) : (
          <Tag icon={<BuildOutlined />}>ER</Tag>
        ),
    },
    {
      title: '',
      width: 40,
      fixed: 'right',
      render: (_, record) => {
        if (record.isScopeNode || !record.entity) return null;
        const entity = record.entity;
        return (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'lock',
                  icon: entity.isLocked ? <UnlockOutlined /> : <LockOutlined />,
                  label: entity.isLocked ? '解锁' : '锁定',
                  onClick: () => onToggleLock?.(entity),
                },
                {
                  key: 'chat',
                  icon: <MessageOutlined />,
                  label: '加入 AI 对话',
                  onClick: () => onAddToChat?.(entity),
                },
                {
                  key: 'edit',
                  icon: <EditOutlined />,
                  label: '编辑',
                  disabled: entity.isLocked,
                  onClick: () => onEditEntity?.(entity),
                },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: (
                    <Popconfirm
                      title={`确定删除「${entity.label}」？`}
                      disabled={entity.isLocked}
                      onConfirm={() => onDeleteEntity?.(entity)}
                    >
                      <span>删除</span>
                    </Popconfirm>
                  ),
                  danger: true,
                  disabled: entity.isLocked,
                },
              ],
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <Table
      size="small"
      rowKey="code"
      showHeader={showHeader}
      columns={columns}
      dataSource={tableData}
      pagination={false}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无实体，请点击「新建实体」开始设计"
          />
        ),
      }}
      onRow={(record) => ({
        onClick: () => {
          if (!record.isScopeNode && record.entity) {
            onSelectEntity(record.entity);
          }
        },
        style: {
          cursor: record.isScopeNode ? 'default' : 'pointer',
          background:
            !record.isScopeNode && record.id === selectedEntityId
              ? 'rgba(24,144,255,0.08)'
              : undefined,
        },
      })}
    />
  );
};

export default ScopeEntityTree;
