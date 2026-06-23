import type { MenuPermission, PermissionResponse, ActionType } from "./types";
import { ACTION_KEYS } from "@/enums";

// 将 API 返回的数据转换为 MenuPermission 类型
export const convertToMenuPermission = (item: PermissionResponse): MenuPermission => {
  console.log('开始转换单个权限项:', item);
  
  const menuPermission: MenuPermission = {
    permission_id: item.permission_id || '',
    code: item.code || '',
    description: item.description,
    resource_type: 'MENU',
    actions: (item.actions || []).filter((action): action is ActionType => 
      ACTION_KEYS.includes(action as ActionType)
    ),
    status: item.status || 'DISABLED',
    created_at: item.created_at || '',
    updated_at: item.updated_at || '',
  };
  
  console.log('转换后的权限项:', menuPermission);
  return menuPermission;
};

// 将扁平数据转换为树形结构
export const buildMenuTree = (permissions: PermissionResponse[]): MenuPermission[] => {
  console.log('开始构建树形结构，输入数据:', permissions);
  
  if (!Array.isArray(permissions) || permissions.length === 0) {
    console.log('输入数据无效或为空');
    return [];
  }

  // 按 code 排序，确保父节点在子节点之前
  const sortedPermissions = [...permissions].sort((a, b) => {
    const aCode = a.code || '';
    const bCode = b.code || '';
    return aCode.localeCompare(bCode);
  });

  console.log('排序后的权限数组:', sortedPermissions);

  const tree: MenuPermission[] = [];
  const map = new Map<string, MenuPermission>();
  const rootNodes = new Set<string>();

  // 第一次遍历：创建所有节点，包括中间节点
  console.log('第一次遍历: 创建所有节点');
  sortedPermissions.forEach((item, index) => {
    const node = convertToMenuPermission(item);
    const parts = node.code.split(':');
    
    // 创建当前节点
    map.set(node.code, { ...node, children: [] });
    console.log(`创建节点 ${index}:`, { code: node.code });

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
          const parentNode: MenuPermission = {
            permission_id: `virtual-${parentCode}`,
            code: parentCode,
            description: `虚拟节点 ${parentCode}`,
            resource_type: 'MENU',
            actions: [],
            status: 'ACTIVE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            children: [],
          };
          map.set(parentCode, parentNode);
          console.log(`创建中间节点:`, { code: parentCode });

          // 如果是第一级中间节点，也记录为根节点
          if (i === 1) {
            rootNodes.add(parentCode);
          }
        }
      }
    }
  });

  // 第二次遍历：构建树形结构
  console.log('第二次遍历: 构建树形结构');
  const processedNodes = new Set<string>();

  // 先处理所有实际存在的节点
  sortedPermissions.forEach((item) => {
    const node = convertToMenuPermission(item);
    const parts = node.code.split(':');
    const currentNode = map.get(node.code);
    
    if (!currentNode) {
      console.log(`警告: 未找到节点 ${node.code}`);
      return;
    }

    if (parts.length === 1) {
      // 一级节点直接添加到树根
      console.log(`添加一级节点到树根:`, node.code);
      tree.push(currentNode);
      processedNodes.add(node.code);
    } else {
      // 找到父节点
      const parentCode = parts.slice(0, -1).join(':');
      const parent = map.get(parentCode);
      
      if (parent) {
        console.log(`添加子节点 ${node.code} 到父节点 ${parentCode}`);
        parent.children!.push(currentNode);
        processedNodes.add(node.code);
      } else {
        console.log(`警告: 未找到父节点 ${parentCode}，将 ${node.code} 作为根节点`);
        tree.push(currentNode);
        processedNodes.add(node.code);
      }
    }
  });

  // 处理所有中间节点
  map.forEach((node, code) => {
    if (!processedNodes.has(code)) {
      const parts = code.split(':');
      if (parts.length === 1 || rootNodes.has(code)) {
        // 一级节点或根节点直接添加到树根
        console.log(`添加根节点到树:`, code);
        tree.push(node);
        processedNodes.add(code);
      } else {
        // 找到父节点
        const parentCode = parts.slice(0, -1).join(':');
        const parent = map.get(parentCode);
        if (parent) {
          console.log(`添加中间节点 ${code} 到父节点 ${parentCode}`);
          parent.children!.push(node);
          processedNodes.add(code);
        } else {
          console.log(`警告: 未找到中间节点的父节点 ${parentCode}，将 ${code} 作为根节点`);
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
        console.log(`添加遗漏的根节点到树:`, code);
        tree.push(node);
      }
    }
  });

  // 打印最终的树形结构
  console.log('树形结构构建完成');
  console.log('树形结构详情:', JSON.stringify(tree, null, 2));
  
  // 打印每个节点的层级关系
  const printTree = (nodes: MenuPermission[], level = 0) => {
    nodes.forEach(node => {
      console.log('  '.repeat(level) + `- ${node.code} (${node.permission_id.startsWith('virtual-') ? ' [虚拟节点]' : ''}`);
      if (node.children && node.children.length > 0) {
        printTree(node.children, level + 1);
      }
    });
  };
  
  console.log('树形结构层级关系:');
  printTree(tree);
  
  return tree;
};
