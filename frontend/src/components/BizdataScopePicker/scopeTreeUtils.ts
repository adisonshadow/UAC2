import { buildScopeTree, type ScopeTreeItem } from '@/pages/BusinessData/utils/buildScopeTree';
import type { BizdataScopeOption } from './types';

function toScopeOption(node: ScopeTreeItem): BizdataScopeOption | null {
  if (!node.isScopeNode) return null;
  const children = (node.children || [])
    .map(toScopeOption)
    .filter((c): c is BizdataScopeOption => c !== null);
  return {
    code: node.code,
    name: node.name,
    children: children.length ? children : undefined,
  };
}

export function buildScopeOptionsFromEntities(entities: API.BusinessDataEntity[]): BizdataScopeOption[] {
  return buildScopeTree(entities)
    .map(toScopeOption)
    .filter((c): c is BizdataScopeOption => c !== null);
}

export function collectScopeCodes(options: BizdataScopeOption[]): string[] {
  const codes: string[] = [];
  const walk = (nodes: BizdataScopeOption[]) => {
    nodes.forEach((n) => {
      codes.push(n.code);
      if (n.children?.length) walk(n.children);
    });
  };
  walk(options);
  return codes;
}
