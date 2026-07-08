export interface ScopeTreeItem {
  id?: string;
  name: string;
  code: string;
  description?: string;
  status?: string;
  isLocked?: boolean;
  entityKind?: string;
  version?: number;
  isScopeNode?: boolean;
  children?: ScopeTreeItem[];
  entity?: API.BusinessDataEntity;
}

export function buildScopeTree(entities: API.BusinessDataEntity[]): ScopeTreeItem[] {
  const codeMap = new Map<string, ScopeTreeItem>();
  const roots: ScopeTreeItem[] = [];

  entities.forEach((entity) => {
    const codes = (entity.code || '').split(':');
    let currentPath = '';

    codes.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}:${segment}` : segment;
      const isLeaf = index === codes.length - 1;

      if (!codeMap.has(currentPath)) {
        const node: ScopeTreeItem = {
          code: currentPath,
          name: isLeaf ? entity.label || segment : segment,
          isScopeNode: !isLeaf,
          children: [],
          ...(isLeaf
            ? {
                id: entity.id,
                status: entity.status,
                isLocked: entity.isLocked,
                entityKind: entity.entityKind,
                version: entity.version,
                entity,
              }
            : {}),
        };
        codeMap.set(currentPath, node);
      } else if (isLeaf) {
        const node = codeMap.get(currentPath)!;
        node.id = entity.id;
        node.name = entity.label || segment;
        node.status = entity.status;
        node.isLocked = entity.isLocked;
        node.entityKind = entity.entityKind;
        node.version = entity.version;
        node.isScopeNode = false;
        node.entity = entity;
      }
    });
  });

  codeMap.forEach((node, path) => {
    const parts = path.split(':');
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join(':');
      const parent = codeMap.get(parentPath);
      if (parent && !parent.children?.some((c) => c.code === node.code)) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  });

  const sortTree = (nodes: ScopeTreeItem[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => n.children?.length && sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

export function flattenScopeTree(nodes: ScopeTreeItem[]): ScopeTreeItem[] {
  const result: ScopeTreeItem[] = [];
  const walk = (items: ScopeTreeItem[]) => {
    items.forEach((item) => {
      result.push(item);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(nodes);
  return result;
}
