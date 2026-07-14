import {
  BuildOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MessageOutlined,
  MoreOutlined,
  PartitionOutlined,
  UnlockOutlined,
  RetweetOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Empty, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useChatReference } from '@EADAF/ai-base';
import React, { useMemo } from 'react';
import ChatReferenceTarget from '@/components/ChatReferenceTarget';
import { buildEntityReference, buildScopeReference } from '../../ai/chatReferenceUtils';
import { buildScopeTree, type ScopeTreeItem } from '../../utils/buildScopeTree';
import { isEntityModelValidated } from '../../utils/entityValidation';
const { Text } = Typography;

type FlatTreeRow = Omit<ScopeTreeItem, 'children'> & { depth: number };

interface ScopeEntityTreeProps {
  entities: API.BusinessDataEntity[];
  selectedEntityId?: string;
  showHeader?: boolean;
  /** 已成功物化过的实体 ID 集合 */
  materializedEntityIds?: ReadonlySet<string>;
  onSelectEntity: (entity: API.BusinessDataEntity) => void;
  onToggleLock?: (entity: API.BusinessDataEntity) => void;
  onEditEntity?: (entity: API.BusinessDataEntity) => void;
  onDeleteEntity?: (entity: API.BusinessDataEntity) => void;
  onAiValidate?: (entity: API.BusinessDataEntity) => void;
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
  materializedEntityIds,
  onSelectEntity,
  onToggleLock,
  onEditEntity,
  onDeleteEntity,
  onAiValidate,
}) => {
  const { addReference } = useChatReference();
  const tableData = useMemo(() => flattenAll(buildScopeTree(entities)), [entities]);

  const columns: ColumnsType<FlatTreeRow> = [
    {
      title: 'Scope / Entity',
      dataIndex: 'name',
      render: (_, record) => {
        const indent = record.depth * 16;
        return (
          <div style={{ paddingLeft: indent, display: 'flex', alignItems: 'center', gap: 8 }}>
            {record.isScopeNode ? (
              <PartitionOutlined />
            ) : record.entityKind === 'json_schema' ? (
              <BuildOutlined />
            ) : (
              <DatabaseOutlined />
            )}
            <Text strong={!record.isScopeNode}>{record.name}</Text>
            {record.isScopeNode && (
              <ChatReferenceTarget
                onClick={() => addReference(buildScopeReference({ code: record.code, name: record.name }))}
              />
            )}
            {!record.isScopeNode && record.entity && (
              <ChatReferenceTarget
                onClick={() => addReference(buildEntityReference(record.entity!))}
              />
            )}
            {!record.isScopeNode && record.isLocked && (
              <Tooltip title="已锁定">
                <LockOutlined style={{ color: '#faad14' }} />
              </Tooltip>
            )}
            {!record.isScopeNode && record.entity && isEntityModelValidated(record.entity) && (
              <Tooltip title="模型校验已通过">
                <CheckCircleOutlined style={{ color: 'rgb(3 176 0)' }} />
              </Tooltip>
            )}
            {!record.isScopeNode && record.id && materializedEntityIds?.has(record.id) && (
              <Tooltip title="已物化">
                <RetweetOutlined style={{ color: 'rgb(3 176 0)' }} />
              </Tooltip>
            )}
            {!record.isScopeNode && record.version != null && (
              <span style={{ backgroundColor: 'rgb(230 242 247)', color: 'rgb(132 152 160)', fontSize: 10, display: 'inline-block', padding: '0px 3px', borderRadius: 4 }}>v{record.version}</span>
            )}
          </div>
        );
      },
    },
    // {
    //   title: '类型',
    //   width: 88,
    //   render: (_, record) =>
    //     record.isScopeNode ? (
    //       <Tag icon={<PartitionOutlined />}>Scope</Tag>
    //     ) : record.entityKind === 'json_schema' ? (
    //       <Tag color="purple">JSON</Tag>
    //     ) : (
    //       <Tag icon={<BuildOutlined />}>ER</Tag>
    //     ),
    // },
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
                  key: 'validate',
                  icon: <SafetyCertificateOutlined />,
                  label: 'AI校验',
                  disabled: entity.isLocked,
                  onClick: () => onAiValidate?.(entity),
                },
                {
                  key: 'lock',
                  icon: entity.isLocked ? <UnlockOutlined /> : <LockOutlined />,
                  label: entity.isLocked ? '解锁' : '锁定',
                  onClick: () => onToggleLock?.(entity),
                },
                {
                  key: 'chat',
                  icon: <MessageOutlined />,
                  label: '添加引用',
                  onClick: () => addReference(buildEntityReference(entity)),
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
                  label: '删除',
                  danger: true,
                  disabled: entity.isLocked,
                  onClick: () => onDeleteEntity?.(entity),
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
