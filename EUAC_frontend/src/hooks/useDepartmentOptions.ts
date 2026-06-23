import { useState, useEffect } from 'react';
import { getDepartmentsTree } from '@/services/UAC/api/departments';

export const useDepartmentOptions = () => {
  const [departmentTree, setDepartmentTree] = useState<any[]>([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await getDepartmentsTree();
        if (response.code === 200 && response.data?.items) {
          setDepartmentTree(response.data.items);
        }
      } catch (error) {
        console.error('获取部门树失败:', error);
      }
    };

    fetchDepartments();
  }, []);

  return departmentTree;
}; 