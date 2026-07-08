import React from 'react';
import { ApiDomainTreePicker } from '@/components/ApiDomainTreePicker';
import type { ApiServiceDomainTreeItem } from '@/utils/buildApiServiceDomainTree';

interface ApiServiceDomainTreeProps {
  treeData: ApiServiceDomainTreeItem[];
  selectedDomain?: string;
  onSelectDomain: (codePrefix?: string) => void;
  loading?: boolean;
}

const ApiServiceDomainTree: React.FC<ApiServiceDomainTreeProps> = ({
  treeData,
  selectedDomain,
  onSelectDomain,
  loading,
}) => (
  <ApiDomainTreePicker
    mode="select"
    showApiSelectable={false}
    showAllNode
    treeData={treeData}
    loading={loading}
    selectedKey={selectedDomain ?? '__all__'}
    onSelect={onSelectDomain}
  />
);

export default ApiServiceDomainTree;
