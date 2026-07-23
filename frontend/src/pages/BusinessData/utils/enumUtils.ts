export type EnumOptionRow = {
  value: string;
  label: string;
  description?: string;
  order?: number;
};

export type EnumTreeNode = {
  key: string;
  value: string;
  label: string;
  children?: EnumTreeNode[];
  enumRecord?: API.BusinessDataEnum;
};

const CODE_RE = /^[a-zA-Z][a-zA-Z0-9_:]*$/;

export function validateEnumCode(code: string) {
  return CODE_RE.test(code.trim());
}

export function filterEnums(enums: API.BusinessDataEnum[], keyword: string) {
  const q = keyword.trim().toLowerCase();
  if (!q) return enums;
  return enums.filter((item) => {
    const label = String(item.enumInfo?.label || '').toLowerCase();
    const description = String(item.enumInfo?.description || '').toLowerCase();
    return item.code?.toLowerCase().includes(q) || label.includes(q) || description.includes(q);
  });
}

/** 统一解析枚举选项：优先 items，为空时回退 values（兼容 AI 只写 values 的历史数据） */
export function optionsFromEnum(record: API.BusinessDataEnum): EnumOptionRow[] {
  const items = record.items || {};
  const itemEntries = Object.entries(items);
  if (itemEntries.length) {
    return itemEntries
      .map(([value, meta]) => {
        const row = meta as { label?: string; description?: string; sort?: number };
        return {
          value,
          label: row.label || String(record.values?.[value] ?? value),
          description: row.description,
          order: row.sort,
        };
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const values = record.values || {};
  return Object.entries(values)
    .map(([value, label], index) => ({
      value,
      label: String(label || value),
      order: index + 1,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function countEnumOptions(record: API.BusinessDataEnum): number {
  return optionsFromEnum(record).length;
}

/** 创建/更新时 values ↔ items 互相同步（一侧为空则从另一侧补齐） */
export function normalizeEnumValuesItems(
  values: Record<string, unknown> = {},
  items: Record<string, unknown> = {},
): {
  values: Record<string, unknown>;
  items: Record<string, unknown>;
} {
  const valueKeys = Object.keys(values || {});
  const itemKeys = Object.keys(items || {});
  if (valueKeys.length && !itemKeys.length) {
    const nextItems: Record<string, unknown> = {};
    valueKeys.forEach((key, index) => {
      const raw = values[key];
      nextItems[key] = {
        label: typeof raw === 'string' && raw ? raw : key,
        sort: index + 1,
      };
    });
    return { values: { ...values }, items: nextItems };
  }
  if (itemKeys.length && !valueKeys.length) {
    const nextValues: Record<string, unknown> = {};
    itemKeys.forEach((key) => {
      nextValues[key] = key;
    });
    return { values: nextValues, items: { ...items } };
  }
  return { values: { ...values }, items: { ...items } };
}

export function buildEnumPayloadFromOptions(
  code: string,
  label: string,
  description: string | undefined,
  options: EnumOptionRow[],
  existing?: API.BusinessDataEnum,
) {
  const items: Record<string, { label: string; description?: string; sort?: number }> = {};
  const values: Record<string, string> = {};

  options.forEach((opt, index) => {
    const key = String(opt.value).trim();
    if (!key) return;
    const sort = opt.order ?? index + 1;
    items[key] = {
      label: opt.label,
      ...(opt.description ? { description: opt.description } : {}),
      sort,
    };
    values[key] = key;
  });

  return {
    code: code.trim(),
    enumInfo: {
      ...(existing?.enumInfo || {}),
      id: existing?.enumInfo?.id || existing?.id,
      code: code.trim(),
      label: label.trim(),
      ...(description ? { description: description.trim() } : {}),
    },
    values,
    items,
  };
}

export function buildEnumTree(enums: API.BusinessDataEnum[]): EnumTreeNode[] {
  const codeMap = new Map<string, EnumTreeNode>();
  const roots: EnumTreeNode[] = [];

  enums.forEach((enumRecord) => {
    const code = enumRecord.code || '';
    const segments = code.split(':').filter(Boolean);
    let currentPath = '';

    segments.forEach((segment, index) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}:${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      if (!codeMap.has(currentPath)) {
        codeMap.set(currentPath, {
          key: currentPath,
          value: currentPath,
          label: isLeaf ? String(enumRecord.enumInfo?.label || segment) : segment,
          children: [],
          enumRecord: isLeaf ? enumRecord : undefined,
        });
      } else if (isLeaf) {
        const node = codeMap.get(currentPath)!;
        node.enumRecord = enumRecord;
        node.label = String(enumRecord.enumInfo?.label || segment);
      }

      if (parentPath) {
        const parent = codeMap.get(parentPath);
        const child = codeMap.get(currentPath)!;
        if (parent && !parent.children?.some((c) => c.key === child.key)) {
          parent.children = parent.children || [];
          parent.children.push(child);
        }
      }
    });
  });

  codeMap.forEach((node) => {
    const parentPath = node.key.includes(':') ? node.key.split(':').slice(0, -1).join(':') : '';
    if (!parentPath) {
      roots.push(node);
    }
  });

  const pruneEmptyChildren = (nodes: EnumTreeNode[]): EnumTreeNode[] =>
    nodes.map((node) => {
      const children = node.children?.length ? pruneEmptyChildren(node.children) : undefined;
      return {
        ...node,
        children: children?.length ? children : undefined,
      };
    });

  return pruneEmptyChildren(roots);
}

export function collectEnumTreeKeys(nodes: EnumTreeNode[]): string[] {
  const keys: string[] = [];
  const walk = (list: EnumTreeNode[]) => {
    list.forEach((node) => {
      keys.push(node.key);
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return keys;
}

export function enumDefaultValueOptions(record?: API.BusinessDataEnum) {
  if (!record) return [];
  return optionsFromEnum(record).map((opt) => ({
    value: opt.value,
    label: `${opt.label} (${opt.value})`,
  }));
}
