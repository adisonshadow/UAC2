const CODE_SEGMENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

function validateCode(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('code 不能为空'), { status: 400 });
  }
  const segments = trimmed.split(':');
  if (segments.length < 2) {
    throw Object.assign(new Error('code 至少包含两段：域:服务名'), { status: 400 });
  }
  segments.forEach((segment) => {
    if (!CODE_SEGMENT_RE.test(segment)) {
      throw Object.assign(
        new Error(`code 段 "${segment}" 格式无效，须为字母开头且仅含字母数字下划线`),
        { status: 400 },
      );
    }
  });
  return trimmed;
}

function codeToRoutePath(code) {
  return validateCode(code).split(':').join('/');
}

function suggestServiceCodeFromEntity(entityCode, suffix = 'Api') {
  const trimmed = String(entityCode || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(':');
  if (parts.length < 2) return `${trimmed}:${suffix}`;
  parts[parts.length - 1] = `${parts[parts.length - 1]}${suffix}`;
  return parts.join(':');
}

function buildDomainTreeFromServices(services) {
  const codeMap = new Map();

  services.forEach((service) => {
    const code = String(service.code || '').trim();
    if (!code) return;
    const segments = code.split(':');
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

  const countServicesInDomain = (domainCode) =>
    services.filter(
      (s) => s.code === domainCode || String(s.code).startsWith(`${domainCode}:`),
    ).length;

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((node) => {
      node.serviceCount = countServicesInDomain(node.code);
      if (node.children?.length) sortTree(node.children);
    });
  };

  sortTree(roots);
  return roots;
}

function validateScopeCode(scopeCode) {
  const trimmed = String(scopeCode || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('Scope 不能为空'), { status: 400 });
  }
  trimmed.split(':').forEach((segment) => {
    if (!CODE_SEGMENT_RE.test(segment)) {
      throw Object.assign(
        new Error(`Scope 段 "${segment}" 格式无效，须为字母开头且仅含字母数字下划线`),
        { status: 400 },
      );
    }
  });
  return trimmed;
}

function validateServiceSlug(serviceSlug) {
  const trimmed = String(serviceSlug || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('服务短名不能为空'), { status: 400 });
  }
  if (!CODE_SEGMENT_RE.test(trimmed)) {
    throw Object.assign(
      new Error('服务短名须为字母开头且仅含字母数字下划线'),
      { status: 400 },
    );
  }
  return trimmed;
}

function buildCodeFromScopeAndSlug(scopeCode, serviceSlug) {
  const scope = validateScopeCode(scopeCode);
  const slug = validateServiceSlug(serviceSlug);
  return validateCode(`${scope}:${slug}`);
}

function parseServiceSlugFromCode(code, scopeCode) {
  const fullCode = String(code || '').trim();
  const scope = String(scopeCode || '').trim();
  if (!fullCode || !scope) return fullCode.split(':').pop() || '';
  if (fullCode === scope) return '';
  if (fullCode.startsWith(`${scope}:`)) {
    return fullCode.slice(scope.length + 1);
  }
  return fullCode.split(':').pop() || '';
}

function matchesCodePrefix(code, codePrefix) {
  if (!codePrefix) return true;
  return code === codePrefix || code.startsWith(`${codePrefix}:`);
}

/** 将 API 服务挂到域树叶子（深拷贝） */
function attachApiServicesToDomainTree(domainTree, services) {
  const cloneNode = (node) => ({
    ...node,
    children: node.children?.map(cloneNode),
  });
  const roots = domainTree.map(cloneNode);
  const nodeByCode = new Map();
  const indexNodes = (nodes) => {
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

  const sortChildren = (nodes) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        node.children.sort((a, b) => {
          if (!!a.isApiNode !== !!b.isApiNode) return a.isApiNode ? 1 : -1;
          return a.code.localeCompare(b.code);
        });
        sortChildren(node.children);
      }
    });
  };
  sortChildren(roots);
  return roots;
}

module.exports = {
  validateCode,
  validateScopeCode,
  validateServiceSlug,
  buildCodeFromScopeAndSlug,
  parseServiceSlugFromCode,
  codeToRoutePath,
  suggestServiceCodeFromEntity,
  buildDomainTreeFromServices,
  attachApiServicesToDomainTree,
  matchesCodePrefix,
};
