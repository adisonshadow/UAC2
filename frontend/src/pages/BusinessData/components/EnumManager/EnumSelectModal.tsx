import { SearchOutlined } from '@ant-design/icons';
import { Input, Modal, Popover, Segmented, Table, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import {
  buildEnumTree,
  collectEnumTreeKeys,
  countEnumOptions,
  filterEnums,
  type EnumTreeNode,
} from '../../utils/enumUtils';
import EnumOptionsPreview from './EnumOptionsPreview';

interface EnumSelectModalProps {
  open: boolean;
  enums: API.BusinessDataEnum[];
  selectedCode?: string;
  onCancel: () => void;
  onConfirm: (enumCode: string) => void;
}

const EnumSelectModal: React.FC<EnumSelectModalProps> = ({
  open,
  enums,
  selectedCode,
  onCancel,
  onConfirm,
}) => {
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [tempCode, setTempCode] = useState(selectedCode || '');

  const filtered = useMemo(() => filterEnums(enums, searchText), [enums, searchText]);
  const treeData = useMemo(() => buildEnumTree(filtered), [filtered]);
  const expandedKeys = useMemo(() => collectEnumTreeKeys(treeData), [treeData]);

  const renderOptionCount = (enumRecord: API.BusinessDataEnum) => {
    const count = countEnumOptions(enumRecord);
    return (
      <Popover
        content={<EnumOptionsPreview record={enumRecord} />}
        title="枚举选项"
        trigger={['hover', 'click']}
      >
        <Tag color="green" style={{ cursor: 'pointer' }}>
          {count}
        </Tag>
      </Popover>
    );
  };

  return (
    <Modal
      title="选择枚举"
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (tempCode) onConfirm(tempCode);
      }}
      okButtonProps={{ disabled: !tempCode }}
      width={720}
      destroyOnClose
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <Segmented
          options={[
            { label: '列表', value: 'list' },
            { label: '树形', value: 'tree' },
          ]}
          value={viewMode}
          onChange={(v) => setViewMode(v as 'list' | 'tree')}
        />
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索 code / 名称 / 描述"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>
      <Table
        size="small"
        rowKey={viewMode === 'list' ? 'id' : 'key'}
        dataSource={viewMode === 'list' ? filtered : (treeData as unknown as API.BusinessDataEnum[])}
        pagination={false}
        scroll={{ y: 360 }}
        expandable={
          viewMode === 'tree'
            ? {
                defaultExpandedRowKeys: expandedKeys,
                childrenColumnName: 'children',
                rowExpandable: (record) => Boolean((record as EnumTreeNode).children?.length),
              }
            : undefined
        }
        rowClassName={(record) => {
          const code =
            viewMode === 'list'
              ? (record as API.BusinessDataEnum).code
              : (record as EnumTreeNode).enumRecord?.code;
          return code === tempCode ? 'ant-table-row-selected' : '';
        }}
        onRow={(record) => {
          const code =
            viewMode === 'list'
              ? (record as API.BusinessDataEnum).code
              : (record as EnumTreeNode).enumRecord?.code;
          return {
            onClick: () => {
              if (code) setTempCode(code);
            },
            style: { cursor: code ? 'pointer' : 'default' },
          };
        }}
        columns={[
          {
            title: '代码',
            render: (_, record) => {
              if (viewMode === 'tree') {
                const node = record as EnumTreeNode;
                if (!node.enumRecord) return <strong>{node.label}</strong>;
                return <Tag color="blue">{node.enumRecord.code}</Tag>;
              }
              return <Tag color="blue">{(record as API.BusinessDataEnum).code}</Tag>;
            },
          },
          {
            title: '名称',
            render: (_, record) => {
              if (viewMode === 'tree') {
                const node = record as EnumTreeNode;
                return node.enumRecord?.enumInfo?.label || (node.children?.length ? '' : node.label);
              }
              return (record as API.BusinessDataEnum).enumInfo?.label;
            },
          },
          {
            title: '选项数',
            width: 80,
            render: (_, record) => {
              const enumRecord =
                viewMode === 'list'
                  ? (record as API.BusinessDataEnum)
                  : (record as EnumTreeNode).enumRecord;
              if (!enumRecord) return null;
              return renderOptionCount(enumRecord);
            },
          },
        ]}
      />
    </Modal>
  );
};

export default EnumSelectModal;
