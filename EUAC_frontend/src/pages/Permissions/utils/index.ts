import { Permission } from '../types';

// 构建权限树
export const buildPermissionTree = (permissions: Permission[]): Permission[] => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return [];
  }

  // 按 code 排序，确保父节点在子节点之前
  const sortedPermissions = [...permissions].sort((a, b) => {
    const aCode = a.code || '';
    const bCode = b.code || '';
    return aCode.localeCompare(bCode);
  });

  const tree: Permission[] = [];
  const map = new Map<string, Permission>();
  const rootNodes = new Set<string>();

  // 第一次遍历：创建所有节点，包括中间节点
  sortedPermissions.forEach((item) => {
    const node = { ...item, children: [] };
    const parts = node.code.split(':');
    
    // 创建当前节点
    map.set(node.code, node);

    // 记录根节点
    if (parts.length === 1) {
      rootNodes.add(node.code);
    }

    // 为多级节点创建中间节点
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const parentCode = parts.slice(0, i).join(':');
        if (!map.has(parentCode)) {
          // 创建中间节点
          const parentNode: Permission = {
            permission_id: `virtual-${parentCode}`,
            code: parentCode,
            description: `虚拟节点 ${parentCode}`,
            resource_type: item.resource_type,
            actions: [],
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            children: [],
          };
          map.set(parentCode, parentNode);

          // 如果是第一级中间节点，也记录为根节点
          if (i === 1) {
            rootNodes.add(parentCode);
          }
        }
      }
    }
  });

  // 第二次遍历：构建树形结构
  const processedNodes = new Set<string>();

  // 先处理所有实际存在的节点
  sortedPermissions.forEach((item) => {
    const node = map.get(item.code);
    if (!node) return;

    const parts = item.code.split(':');
    
    if (parts.length === 1) {
      // 一级节点直接添加到树根
      tree.push(node);
      processedNodes.add(item.code);
    } else {
      // 找到父节点
      const parentCode = parts.slice(0, -1).join(':');
      const parent = map.get(parentCode);
      
      if (parent) {
        parent.children!.push(node);
        processedNodes.add(item.code);
      } else {
        tree.push(node);
        processedNodes.add(item.code);
      }
    }
  });

  // 处理所有中间节点
  map.forEach((node, code) => {
    if (!processedNodes.has(code)) {
      const parts = code.split(':');
      if (parts.length === 1 || rootNodes.has(code)) {
        // 一级节点或根节点直接添加到树根
        tree.push(node);
        processedNodes.add(code);
      } else {
        // 找到父节点
        const parentCode = parts.slice(0, -1).join(':');
        const parent = map.get(parentCode);
        if (parent) {
          parent.children!.push(node);
          processedNodes.add(code);
        } else {
          tree.push(node);
          processedNodes.add(code);
        }
      }
    }
  });

  // 确保所有根节点都在树中
  rootNodes.forEach(code => {
    if (!processedNodes.has(code)) {
      const node = map.get(code);
      if (node) {
        tree.push(node);
      }
    }
  });

  return tree;
};

// 递归获取所有权限的 ID
export const getAllPermissionIds = (permissions: Permission[]): string[] => {
  return permissions.reduce((acc: string[], permission: Permission) => {
    if (permission.permission_id) {
      acc.push(permission.permission_id);
    }
    if (permission.children && permission.children.length > 0) {
      acc.push(...getAllPermissionIds(permission.children));
    }
    return acc;
  }, []);
};

// 递归处理数据，添加搜索文本
export const processDataWithSearch = (data: Permission[], searchText: string): Permission[] => {
  return data.map(item => {
    const processedItem = {
      ...item,
      _searchText: searchText,
    };
    if (item.children && item.children.length > 0) {
      processedItem.children = processDataWithSearch(item.children, searchText);
    }
    return processedItem;
  });
};

// 获取当前节点的层级
export const getNodeLevel = (node: Permission): number => {
  let level = 0;
  let current = node;
  while (current.code.includes(':')) {
    level++;
    current = {
      ...current,
      code: current.code.substring(0, current.code.lastIndexOf(':')),
    };
  }
  return level;
};

// 获取当前层级对应的编码部分
export const getCurrentLevelCode = (code: string, level: number): string => {
  const parts = code.split(':');
  return parts[level] || code;
}; 