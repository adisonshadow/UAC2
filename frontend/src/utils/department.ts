/**
 * 获取部门的完整路径（从根部门到当前部门的所有部门ID）
 * @param departmentId 当前部门ID
 * @param departments 部门列表
 * @returns 部门ID数组，从根部门到当前部门
 */
export const getDepartmentPath = (departmentId: string, departments: {
  department_id?: string;
  name: string;
  code: string;
  parent_id?: string | null;
  status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  description?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}[]): string[] => {
  const path: string[] = [];
  let currentId = departmentId;
  
  while (currentId) {
    const department = departments.find(d => d.department_id === currentId);
    if (department) {
      path.unshift(department.department_id || '');
      currentId = department.parent_id || '';
    } else {
      break;
    }
  }
  
  return path;
};

/** 从 Cascader 部门树解析选中路径（根 → 当前节点） */
export function getDepartmentPathFromTree(
  departmentId: string,
  tree: { value: string; children?: { value: string; children?: unknown[] }[] }[],
): string[] {
  if (!departmentId) return [];

  const path: string[] = [];
  const walk = (
    nodes: { value: string; children?: { value: string; children?: unknown[] }[] }[],
    acc: string[],
  ): boolean => {
    for (const node of nodes) {
      const next = [...acc, node.value];
      if (node.value === departmentId) {
        path.push(...next);
        return true;
      }
      if (node.children?.length && walk(node.children as typeof nodes, next)) {
        return true;
      }
    }
    return false;
  };

  walk(tree, []);
  return path;
}; 