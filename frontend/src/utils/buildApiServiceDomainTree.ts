/** 按 code 冒号分层构建域树（仅域节点，不含 API 服务叶子项） */
export function buildApiServiceDomainTree(services: ApiServiceListItem[]): ApiServiceDomainTreeItem[] {
  const codeMap = new Map<string, ApiServiceDomainTreeItem>();
  const roots: ApiServiceDomainTreeItem[] = [];

  services.forEach((service) => {
    const segments = (service.code || '').split(':').filter(Boolean);
    if (segments.length < 2) return;

    for (let i = 0; i < segments.length - 1; i += 1) {
      const currentPath = segments.slice(0, i + 1).join(':');
      if (!codeMap.has(currentPath)) {
        codeMap.set(currentPath, {
          code: currentPath,
          name: segments[i],
          isDomainNode: true,
          children: [],
        });
      }
    }
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

  const countServicesInDomain = (domainCode: string) =>
    services.filter(
      (s) => s.code === domainCode || s.code.startsWith(`${domainCode}:`),
    ).length;

  const sortTree = (nodes: ApiServiceDomainTreeItem[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((n) => {
      n.serviceCount = countServicesInDomain(n.code);
      if (n.children?.length) sortTree(n.children);
    });
  };

  sortTree(roots);
  return roots;
}

export interface ApiServiceDomainTreeItem {
  code: string;
  name: string;
  isDomainNode?: boolean;
  isApiNode?: boolean;
  serviceCount?: number;
  children?: ApiServiceDomainTreeItem[];
}

export interface ApiServiceListItem {
  id: string;
  code: string;
  name?: string;
  status?: string;
  version?: number;
  transportProtocols?: string[];
  entityCode?: string;
  routePath?: string;
  apiUrl?: string;
  tags?: string[];
}

/** 按域前缀过滤服务列表 */
export function filterServicesByDomainPrefix(
  services: ApiServiceListItem[],
  codePrefix?: string,
): ApiServiceListItem[] {
  if (!codePrefix) return services;
  const prefix = codePrefix.endsWith(':') ? codePrefix : `${codePrefix}:`;
  return services.filter(
    (s) => s.code === codePrefix || s.code.startsWith(prefix),
  );
}

/** 收集域树中所有域节点 code */
export function collectDomainCodes(nodes: ApiServiceDomainTreeItem[]): Set<string> {
  const codes = new Set<string>();
  const walk = (items: ApiServiceDomainTreeItem[]) => {
    items.forEach((node) => {
      if (node.isDomainNode !== false) {
        codes.add(node.code);
      }
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return codes;
}

/** 将 API 服务挂到对应域节点下（深拷贝） */
export function attachApiServicesToDomainTree(
  domainTree: ApiServiceDomainTreeItem[],
  services: ApiServiceListItem[],
): ApiServiceDomainTreeItem[] {
  const cloneNode = (node: ApiServiceDomainTreeItem): ApiServiceDomainTreeItem => ({
    ...node,
    children: node.children?.map(cloneNode),
  });
  const roots = domainTree.map(cloneNode);
  const nodeByCode = new Map<string, ApiServiceDomainTreeItem>();
  const indexNodes = (nodes: ApiServiceDomainTreeItem[]) => {
    nodes.forEach((node) => {
      nodeByCode.set(node.code, node);
      if (node.children?.length) indexNodes(node.children);
    });
  };
  indexNodes(roots);

  services.forEach((service) => {
    const code = String(service.code || '').trim();
    if (!code) return;
    const parts = code.split(':');
    if (parts.length < 2) return;
    const parentCode = parts.slice(0, -1).join(':');
    const parent = nodeByCode.get(parentCode);
    if (!parent) return;
    parent.children = parent.children || [];
    if (parent.children.some((c) => c.code === code)) return;
    parent.children.push({
      code,
      name: service.name || parts[parts.length - 1],
      isDomainNode: false,
      isApiNode: true,
    });
  });

  const sortChildren = (nodes: ApiServiceDomainTreeItem[]) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        node.children.sort((a, b) => {
          if (!!a.isApiNode !== !!b.isApiNode) {
            return a.isApiNode ? 1 : -1;
          }
          return a.code.localeCompare(b.code);
        });
        sortChildren(node.children);
      }
    });
  };
  sortChildren(roots);
  return roots;
}
