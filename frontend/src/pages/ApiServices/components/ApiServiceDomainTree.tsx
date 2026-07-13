import React, { useMemo } from 'react';
import ScopeDomainTree, { type ScopeDomainTreeNode } from '@/components/ScopeDomainTree';
import type { ApiServiceDomainTreeItem } from '@/utils/buildApiServiceDomainTree';

interface ApiServiceDomainTreeProps {
  treeData: ApiServiceDomainTreeItem[];
  selectedDomain?: string;
  onSelectDomain: (codePrefix?: string) => void;
  loading?: boolean;
}

function mapApiTree(nodes: ApiServiceDomainTreeItem[]): ScopeDomainTreeNode[] {
  return nodes.map((node) => ({
    code: node.code,
    name: node.name,
    itemCount: node.serviceCount,
    children: node.children?.length ? mapApiTree(node.children) : undefined,
  }));
}

const ApiServiceDomainTree: React.FC<ApiServiceDomainTreeProps> = ({
  treeData,
  selectedDomain,
  onSelectDomain,
  loading,
}) => {
  const mappedTree = useMemo(() => mapApiTree(treeData), [treeData]);

  return (
    <ScopeDomainTree
      treeData={mappedTree}
      selectedScope={selectedDomain}
      onSelect={onSelectDomain}
      loading={loading}
      emptyDescription="暂无 API 域，请先在 API 服务中创建服务"
    />
  );
};

export default ApiServiceDomainTree;
