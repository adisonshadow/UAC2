import React, { useEffect, useState, useMemo } from 'react';
import { useModel } from '@umijs/max';
import { Tooltip, Cascader } from 'antd';
import type { CascaderProps } from 'antd';
import { getDepartmentPath } from '@/utils/department';

interface DepartmentPathProps {
  departmentId: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  isOnlyShowTail?: boolean;
}

const DepartmentPath: React.FC<DepartmentPathProps> = ({ 
  departmentId, 
  editable = false,
  onChange,
  isOnlyShowTail = true 
}) => {
  const { initialState } = useModel('@@initialState');
  const departments = initialState?.departments || [];
  const [path, setPath] = useState<string[]>([]);

  useEffect(() => {
    const fetchPath = async () => {
      const result = await getDepartmentPath(departmentId, departments);
      setPath(result);
    };
    fetchPath();
  }, [departmentId, departments]);

  // 构建级联选择器的选项
  const options = useMemo(() => {
    const buildOptions = (parentId: string | null = null): CascaderProps['options'] => {
      return departments
        .filter(dept => dept.parent_id === parentId)
        .map(dept => ({
          value: dept.department_id,
          label: dept.name,
          children: buildOptions(dept.department_id),
        }));
    };
    return buildOptions();
  }, [departments]);

  // 获取当前部门路径
  const pathMemo = useMemo(() => {
    const buildPath = (id: string): string[] => {
      const dept = departments.find(d => d.department_id === id);
      if (!dept) return [];
      
      if (!dept.parent_id) {
        return [dept.name];
      }
      
      return [...buildPath(dept.parent_id), dept.name];
    };

    return buildPath(departmentId);
  }, [departmentId, departments]);

  // 获取当前部门ID的完整路径
  const getValue = useMemo(() => {
    const buildValue = (id: string): string[] => {
      const dept = departments.find(d => d.department_id === id);
      if (!dept) return [];
      
      if (!dept.parent_id) {
        return [dept.department_id];
      }
      
      return [...buildValue(dept.parent_id), dept.department_id];
    };

    return buildValue(departmentId);
  }, [departmentId, departments]);

  if (editable) {
    return (
      <Cascader
        options={options}
        value={getValue}
        onChange={(value) => value && onChange?.(String(value[value.length - 1]))}
        changeOnSelect={false}
        expandTrigger="hover"
      />
    );
  }

  if (!pathMemo.length) return null;

  const displayContent = isOnlyShowTail ? pathMemo[pathMemo.length - 1] : pathMemo.join(' / ');

  return (
    <Tooltip title={isOnlyShowTail ? pathMemo.join(' / ') : undefined}>
      <span>{displayContent}</span>
    </Tooltip>
  );
};

export default DepartmentPath; 