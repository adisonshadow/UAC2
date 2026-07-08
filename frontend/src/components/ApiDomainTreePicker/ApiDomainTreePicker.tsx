import { ApiOutlined, PartitionOutlined } from '@ant-design/icons';
import { Spin, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useMemo } from 'react';
import { useApiDomainTreeData } from './useApiDomainTreeData';
import type { ApiDomainTreePickerProps } from './types';
import type { ApiServiceDomainTreeItem } from '@/utils/buildApiServiceDomainTree';

const { Text } = Typography;

const ALL_NODE_KEY = '__all__';

function renderNodeTitle(node: ApiServiceDomainTreeItem) {
  if (node.isApiNode) {
    return (
      <span>
        <ApiOutlined style={{ marginRight: 6, color: '#1677ff' }} />
        <Text>{node.name}</Text>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          {node.code}
        </Text>
      </span>
    );
  }
  return (
    <span>
      <PartitionOutlined style={{ marginRight: 6 }} />
      <Text strong>{node.name}</Text>
      <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
        {node.code}
        {node.serviceCount != null ? ` (${node.serviceCount})` : ''}
      </Text>
    </span>
  );
}

function toTreeNodes(items: ApiServiceDomainTreeItem[]): DataNode[] {
  return items.map((item) => ({
    key: item.code,
    title: renderNodeTitle(item),
    selectable: item.isApiNode ? false : true,
    checkable: true,
    isLeaf: !!item.isApiNode,
    children: item.children?.length ? toTreeNodes(item.children) : undefined,
  }));
}

const ApiDomainTreePicker: React.FC<ApiDomainTreePickerProps> = ({
  showApiSelectable = false,
  mode = 'check',
  value = [],
  onChange,
  selectedKey,
  onSelect,
  showAllNode = false,
  treeData: externalTreeData,
  services: _externalServices,
  loading: externalLoading,
  height = 360,
  className,
  style,
}) => {
  const internal = useApiDomainTreeData({
    showApiSelectable,
    enabled: !externalTreeData,
  });

  const treeData = externalTreeData ?? internal.treeData;
  const loading = externalLoading ?? internal.loading;

  const antTreeData = useMemo(() => {
    const domainNodes = toTreeNodes(treeData);
    if (showAllNode && mode === 'select') {
      return [{ key: ALL_NODE_KEY, title: '全部', selectable: true }, ...domainNodes];
    }
    return domainNodes;
  }, [treeData, showAllNode, mode]);

  if (mode === 'select') {
    return (
      <Spin spinning={loading}>
        <Tree
          className={className}
          style={style}
          showLine
          defaultExpandAll
          selectedKeys={[selectedKey || ALL_NODE_KEY]}
          treeData={antTreeData}
          onSelect={(keys) => {
            const key = keys[0] as string | undefined;
            if (!key || key === ALL_NODE_KEY) {
              onSelect?.(undefined);
              return;
            }
            onSelect?.(key);
          }}
        />
      </Spin>
    );
  }

  return (
    <Spin spinning={loading}>
      {antTreeData.length ? (
        <Tree
          className={className}
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 8,
            ...style,
          }}
          checkable
          selectable={false}
          defaultExpandAll
          checkedKeys={value}
          onCheck={(keys) => {
            const next = Array.isArray(keys) ? keys : keys.checked;
            onChange?.(next.map(String));
          }}
          treeData={antTreeData}
          height={height}
        />
      ) : (
        <Text type="secondary">暂无 API 域，请先在 API 服务中创建服务</Text>
      )}
    </Spin>
  );
};

export default ApiDomainTreePicker;
