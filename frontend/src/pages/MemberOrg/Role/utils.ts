import type { Role } from './types';

// 构建角色树
export function buildRoleTree(roles: Role[]): Role[] {
  console.log('开始构建角色树，原始数据:', roles);
  
  // 用于存储所有节点的映射
  const nodeMap = new Map<string, Role>();
  // 用于存储根节点
  const rootNodes: Role[] = [];
  // 用于存储所有已处理的节点
  const processedNodes = new Set<string>();
  // 用于存储所有虚拟节点
  const virtualNodes: Role[] = [];

  // 第一步：创建所有节点并建立映射
  roles.forEach(role => {
    // 创建节点时保持原始状态，但确保有 children 数组
    const node: Role = {
      ...role,
      children: [],
    };
    nodeMap.set(role.role_id, node);
  });

  // 第二步：处理每个角色，构建树结构
  roles.forEach(role => {
    if (processedNodes.has(role.role_id)) {
      return;
    }

    const codeParts = role.code.split(':');
    let currentNode: Role | undefined = nodeMap.get(role.role_id);
    let currentPath = '';

    // 处理每个编码部分
    for (let i = 0; i < codeParts.length; i++) {
      const part = codeParts[i];
      currentPath = currentPath ? `${currentPath}:${part}` : part;

      // 如果是最后一部分，使用实际角色
      if (i === codeParts.length - 1) {
        if (currentNode) {
          // 检查是否有父节点
          const parentPath = codeParts.slice(0, -1).join(':');
          const parentId = parentPath ? `virtual-${parentPath}` : undefined;
          
          if (parentId) {
            // 如果有父节点，添加到父节点的 children 中
            const parentNode = nodeMap.get(parentId);
            if (parentNode) {
              if (!parentNode.children) {
                parentNode.children = [];
              }
              if (!parentNode.children.some(child => child.role_id === currentNode!.role_id)) {
                parentNode.children.push(currentNode);
              }
            }
          } else {
            // 如果没有父节点，添加到根节点
            if (!rootNodes.some(node => node.role_id === currentNode!.role_id)) {
              rootNodes.push(currentNode);
            }
          }
        }
        processedNodes.add(role.role_id);
      } else {
        // 处理中间路径
        const virtualId = `virtual-${currentPath}`;
        if (!nodeMap.has(virtualId)) {
          const virtualNode: Role = {
            role_id: virtualId,
            role_name: part,
            code: currentPath,
            status: 'ACTIVE',  // 虚拟节点始终是 ACTIVE 状态
            children: [],
          };
          nodeMap.set(virtualId, virtualNode);
          virtualNodes.push(virtualNode);

          // 如果是第一级，添加到根节点
          if (i === 0) {
            rootNodes.push(virtualNode);
          } else {
            // 否则添加到父节点
            const parentPath = codeParts.slice(0, i).join(':');
            const parentId = `virtual-${parentPath}`;
            const parentNode = nodeMap.get(parentId);
            if (parentNode) {
              if (!parentNode.children) {
                parentNode.children = [];
              }
              if (!parentNode.children.some(child => child.role_id === virtualId)) {
                parentNode.children.push(virtualNode);
              }
            }
          }
        }
      }
    }
  });

  // 对根节点按 code 排序
  rootNodes.sort((a, b) => a.code.localeCompare(b.code));

  // 递归对子节点排序
  const sortChildren = (nodes: Role[]) => {
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => a.code.localeCompare(b.code));
        sortChildren(node.children);
      }
    });
  };

  sortChildren(rootNodes);

  console.log('角色树构建完成:', {
    rootNodes,
    virtualNodes,
    totalNodes: nodeMap.size,
  });

  return rootNodes;
} 