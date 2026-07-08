/**
 * 从 bizdata 实体 code 提取 Scope 树（非叶子路径节点）
 */

function buildScopeTreeFromEntityCodes(entities) {
  const codeMap = new Map();

  entities.forEach((entity) => {
    const code = (entity.code || '').trim();
    if (!code) return;
    const segments = code.split(':');
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}:${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      if (!codeMap.has(currentPath)) {
        codeMap.set(currentPath, {
          code: currentPath,
          name: isLeaf ? (entity.label || segment) : segment,
          isScopeNode: !isLeaf,
          children: [],
        });
      } else if (isLeaf) {
        const node = codeMap.get(currentPath);
        node.name = entity.label || segment;
        node.isScopeNode = false;
      }
    });
  });

  const roots = [];
  codeMap.forEach((node, path) => {
    const parts = path.split(':');
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join(':');
      const parent = codeMap.get(parentPath);
      if (parent && !parent.children.some((c) => c.code === node.code)) {
        parent.children.push(node);
      }
    }
  });

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => {
      if (n.children?.length) {
        n.children = n.children.filter((c) => c.isScopeNode !== false || c.children?.length);
        sortTree(n.children);
      }
    });
  };

  // 仅保留 Scope 节点（去掉实体叶子）
  const filterScopeOnly = (nodes) =>
    nodes
      .filter((n) => n.isScopeNode !== false)
      .map((n) => ({
        code: n.code,
        name: n.name,
        children: n.children?.length ? filterScopeOnly(n.children) : [],
      }));

  sortTree(roots);
  return filterScopeOnly(roots);
}

function flattenScopeTree(nodes, result = []) {
  nodes.forEach((node) => {
    result.push({ code: node.code, name: node.name });
    if (node.children?.length) flattenScopeTree(node.children, result);
  });
  return result;
}

module.exports = {
  buildScopeTreeFromEntityCodes,
  flattenScopeTree,
};
