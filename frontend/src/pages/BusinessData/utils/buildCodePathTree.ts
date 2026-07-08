export interface CodePathTreeNode<T = unknown> {
  code: string;
  name: string;
  isScopeNode?: boolean;
  children?: CodePathTreeNode<T>[];
  data?: T;
  id?: string;
}

export type FlatCodePathRow<T = unknown> = Omit<CodePathTreeNode<T>, 'children'> & { depth: number };

type CodePathItem = { code?: string; id?: string; label?: string };

/** 按冒号分层 code 构建树（与模型设计器 Scope 树规则一致）。
 *  缺失 code 的项不丢弃：降级为扁平根节点（code 用 id 兜底，避免 rowKey 冲突与"消失"）。 */
export function buildCodePathTree<T extends CodePathItem>(
  items: T[],
  getLeafLabel?: (item: T, segment: string) => string,
): CodePathTreeNode<T>[] {
  const codeMap = new Map<string, CodePathTreeNode<T>>();
  const roots: CodePathTreeNode<T>[] = [];
  // 无 code 的项单独收集，最后作为扁平根节点挂上（不再因空 code 被 silently 丢弃）
  const codeless: CodePathTreeNode<T>[] = [];

  const resolveLeafLabel = (item: T, segment: string) =>
    getLeafLabel?.(item, segment) || item.label || segment;

  items.forEach((item) => {
    const segments = (item.code || '').split(':').filter(Boolean);
    if (!segments.length) {
      // 降级：空 code 项用 id 兜底作为 code，label 作名称，作为扁平根节点展示
      const fallbackCode = item.id || item.label || `__item_${codeless.length}`;
      codeless.push({
        code: fallbackCode,
        name: item.label || fallbackCode,
        id: item.id,
        data: item,
        children: [],
      });
      return;
    }

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}:${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      if (!codeMap.has(currentPath)) {
        const node: CodePathTreeNode<T> = {
          code: currentPath,
          name: isLeaf ? resolveLeafLabel(item, segment) : segment,
          isScopeNode: !isLeaf,
          children: [],
          ...(isLeaf ? { id: item.id, data: item } : {}),
        };
        codeMap.set(currentPath, node);
      } else if (isLeaf) {
        const node = codeMap.get(currentPath)!;
        node.id = item.id;
        node.name = resolveLeafLabel(item, segment);
        node.isScopeNode = false;
        node.data = item;
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

  roots.push(...codeless);

  const sortTree = (nodes: CodePathTreeNode<T>[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => n.children?.length && sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

export function flattenCodePathTree<T>(
  nodes: CodePathTreeNode<T>[],
  depth = 0,
): FlatCodePathRow<T>[] {
  return nodes.flatMap((node) => {
    const { children, ...rest } = node;
    const row: FlatCodePathRow<T> = { ...rest, depth };
    if (children?.length) {
      return [row, ...flattenCodePathTree(children, depth + 1)];
    }
    return [row];
  });
}
