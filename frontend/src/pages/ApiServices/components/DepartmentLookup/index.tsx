import { TreeSelect } from 'antd';
import type { TreeSelectProps } from 'antd';
import React, { useMemo } from 'react';
import { useDepartmentOptions } from '@/hooks/useDepartmentOptions';

function toTreeData(items: API.DepartmentTreeItem[] = []): TreeSelectProps['treeData'] {
  return items.map((item) => ({
    title: item.name,
    value: item.department_id,
    key: item.department_id,
    children: item.children?.length ? toTreeData(item.children) : undefined,
  }));
}

export type DepartmentLookupProps = {
  value?: string[];
  onChange?: (departmentIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

const DepartmentLookup: React.FC<DepartmentLookupProps> = ({
  value,
  onChange,
  disabled,
  placeholder = '选择组织（可多选）',
}) => {
  const departmentTree = useDepartmentOptions();
  const treeData = useMemo(() => toTreeData(departmentTree), [departmentTree]);

  return (
    <TreeSelect
      treeData={treeData}
      value={value}
      onChange={(next) => onChange?.((next as string[]) || [])}
      treeCheckable
      showCheckedStrategy={TreeSelect.SHOW_PARENT}
      allowClear
      disabled={disabled}
      placeholder={placeholder}
      style={{ width: '100%' }}
      maxTagCount="responsive"
    />
  );
};

export default DepartmentLookup;
