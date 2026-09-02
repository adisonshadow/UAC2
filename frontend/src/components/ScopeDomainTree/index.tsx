import { CaretDownFilled, PartitionOutlined } from '@ant-design/icons';
import { Empty, Spin, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buildScopePrefixTree, type CodePathTreeNode } from '@/pages/BusinessData/utils/buildCodePathTree';
import './index.css';

const { Text } = Typography;

const ALL_NODE_KEY = '__all__';

type ScopeItem = { code?: string };

export interface ScopeDomainTreeLeafData {
  /** 叶子节点对应的唯一值（如实体 id），在 checkable 模式下作为勾选 key */
  value: string;
  /** 叶子附加数据，由 renderLeafTitle 消费（如物化版本/状态） */
  [key: string]: unknown;
}

export interface ScopeDomainTreeNode {
  code: string;
  name: string;
  itemCount?: number;
  children?: ScopeDomainTreeNode[];
  /** 叶子节点附加数据；域节点不传。存在即视为叶子。 */
  leafData?: ScopeDomainTreeLeafData;
}

export interface ScopeDomainTreeProps {
  /** 原始 items，组件内部按 code 前缀构建域树并统计数量 */
  items?: ScopeItem[];
  /** 预构建域树（与 items 二选一） */
  treeData?: ScopeDomainTreeNode[];
  selectedScope?: string;
  onSelect: (scope?: string) => void;
  loading?: boolean;
  showAllNode?: boolean;
  allNodeLabel?: string;
  emptyDescription?: string;
  className?: string;
  style?: React.CSSProperties;
  /** 开启勾选模式（父子联动，antd Tree 默认行为）。开启后 onSelect 仍可独立工作 */
  checkable?: boolean;
  /** 受控勾选的 keys（叶子 leafData.value） */
  checkedKeys?: string[];
  /** 勾选变化回调，返回叶子 value 数组（已展开父节点） */
  onCheck?: (keys: string[]) => void;
  /** 自定义叶子节点标题（用于渲染版本 Tag 等）；不传则回退默认标题 */
  renderLeafTitle?: (node: ScopeDomainTreeNode) => React.ReactNode;
}

function fromCodePathTree(nodes: CodePathTreeNode[]): ScopeDomainTreeNode[] {
  return nodes.map((node) => ({
    code: node.code,
    name: node.name,
    itemCount: node.itemCount,
    children: node.children?.length ? fromCodePathTree(node.children) : undefined,
  }));
}

function renderNodeTitle(node: ScopeDomainTreeNode) {
  return (
    <span>
      <PartitionOutlined style={{ marginRight: 6 }} />
      <Text strong>{node.name}</Text>
      {node.itemCount != null ? (
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          ({node.itemCount})
        </Text>
      ) : null}
    </span>
  );
}

function toTreeNodes(
  nodes: ScopeDomainTreeNode[],
  checkable?: boolean,
  renderLeafTitle?: (node: ScopeDomainTreeNode) => React.ReactNode,
  renderScopeTitle?: (node: ScopeDomainTreeNode) => React.ReactNode,
): DataNode[] {
  return nodes.map((node) => {
    const hasChildren = Boolean(node.children?.length);
    // checkable 模式下，叶子用 leafData.value 作为 key（受控勾选按 value 匹配）；
    // 域节点和无 leafData 的节点仍用 code。
    const isLeaf = !hasChildren && Boolean(node.leafData);
    const key = checkable && isLeaf && node.leafData ? node.leafData.value : node.code;
    const title = hasChildren
      ? renderScopeTitle
        ? renderScopeTitle(node)
        : renderNodeTitle(node)
      : isLeaf && renderLeafTitle
        ? renderLeafTitle(node)
        : renderNodeTitle(node);
    return {
      key,
      title,
      isLeaf: !hasChildren,
      children: hasChildren ? toTreeNodes(node.children!, checkable, renderLeafTitle, renderScopeTitle) : undefined,
    };
  });
}

/** 收集树中所有叶子的 leafData.value（用于「全选」节点展开为全部叶子） */
function collectLeafValues(nodes: ScopeDomainTreeNode[]): string[] {
  const result: string[] = [];
  const walk = (list: ScopeDomainTreeNode[]) => {
    list.forEach((node) => {
      if (node.children?.length) {
        walk(node.children);
      } else if (node.leafData?.value) {
        result.push(node.leafData.value);
      }
    });
  };
  walk(nodes);
  return result;
}

/** 收集所有「有子节点」的域 key（可展开节点）。checkable 模式下域节点 key 仍是 code */
function collectExpandableKeys(nodes: ScopeDomainTreeNode[], checkable?: boolean): string[] {
  const result: string[] = [];
  const walk = (list: ScopeDomainTreeNode[]) => {
    list.forEach((node) => {
      if (node.children?.length) {
        result.push(node.code);
        walk(node.children);
      }
    });
  };
  walk(nodes);
  // checkable 模式下 key 未被改写（仅叶子改用 value），故域 key 统一为 code
  void checkable;
  return result;
}

/** 收集某个父节点子树内所有可展开 key（含自身），用于一键折叠整条分支 */
function collectSubtreeExpandableKeys(
  nodes: ScopeDomainTreeNode[],
  targetCode: string,
): string[] {
  const found: string[] = [];
  const collectDescendants = (node: ScopeDomainTreeNode) => {
    if (node.children?.length) {
      found.push(node.code);
      node.children.forEach(collectDescendants);
    }
  };
  const walk = (list: ScopeDomainTreeNode[]): boolean => {
    for (const node of list) {
      if (node.code === targetCode) {
        collectDescendants(node);
        return true;
      }
      if (node.children?.length && walk(node.children)) return true;
    }
    return false;
  };
  walk(nodes);
  return found;
}

const ScopeDomainTree: React.FC<ScopeDomainTreeProps> = ({
  items,
  treeData: externalTreeData,
  selectedScope,
  onSelect,
  loading = false,
  showAllNode = true,
  allNodeLabel = '全部',
  emptyDescription = '暂无域',
  className,
  style,
  checkable = false,
  checkedKeys,
  onCheck,
  renderLeafTitle,
}) => {
  const treeData = useMemo(() => {
    if (externalTreeData?.length) return externalTreeData;
    if (items?.length) return fromCodePathTree(buildScopePrefixTree(items));
    return [];
  }, [externalTreeData, items]);

  // checkable 模式下「全部」节点即「全选」：勾选=选中所有叶子，半选态由 antd 计算
  const allLeafValues = useMemo(
    () => (checkable ? collectLeafValues(treeData) : []),
    [checkable, treeData],
  );

  // 受控展开：初始全部展开（等价于原 defaultExpandAll）。toggle 按钮据此折叠/展开整条分支
  const allExpandableKeys = useMemo(
    () => collectExpandableKeys(treeData),
    [treeData],
  );
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => allExpandableKeys);
  // treeData 变化（如切换数据源）时同步补齐新出现的可展开 key，保持「默认全展开」语义
  useEffect(() => {
    setExpandedKeys((prev) => {
      const prevSet = new Set(prev);
      const merged = [...prev];
      allExpandableKeys.forEach((k) => {
        if (!prevSet.has(k)) merged.push(k);
      });
      return merged.length === prev.length ? prev : merged;
    });
  }, [allExpandableKeys]);

  const expandedSet = useMemo(() => new Set(expandedKeys), [expandedKeys]);

  /** 切换某父节点整条子树的展开/折叠。子树内任一未展开 → 全部展开；否则全部折叠 */
  const toggleSubtree = useCallback(
    (key: string) => {
      setExpandedKeys((prev) => {
        const prevSet = new Set(prev);
        // 「全部」节点 = 整棵树
        const subtreeKeys =
          key === ALL_NODE_KEY ? allExpandableKeys : collectSubtreeExpandableKeys(treeData, key);
        if (subtreeKeys.length === 0) return prev;
        const allExpanded = subtreeKeys.every((k) => prevSet.has(k));
        const nextSet = new Set(prev);
        if (allExpanded) {
          subtreeKeys.forEach((k) => nextSet.delete(k));
        } else {
          subtreeKeys.forEach((k) => nextSet.add(k));
        }
        return Array.from(nextSet);
      });
    },
    [allExpandableKeys, treeData],
  );

  /** 渲染父节点标题：名字 + 最右侧的 toggle 按钮（仅 icon） */
  const renderScopeTitle = useCallback(
    (node: ScopeDomainTreeNode) => {
      const isOpen = expandedSet.has(node.code);
      return (
        <span className="scope-tree-node-title">
          <span className="scope-tree-node-title__label">
            <PartitionOutlined style={{ marginRight: 6 }} />
            <Text strong>{node.name}</Text>
            {node.itemCount != null ? (
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                ({node.itemCount})
              </Text>
            ) : null}
          </span>
          <CaretDownFilled
            className={`scope-tree-toggle ${isOpen ? 'scope-tree-toggle--open' : 'scope-tree-toggle--closed'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSubtree(node.code);
            }}
          />
        </span>
      );
    },
    [expandedSet, toggleSubtree],
  );

  const antTreeData = useMemo(() => {
    const domainNodes = toTreeNodes(treeData, checkable, renderLeafTitle, renderScopeTitle);
    if (showAllNode) {
      return [
        {
          key: ALL_NODE_KEY,
          title: (
            <span className="scope-tree-node-title">
              <span className="scope-tree-node-title__label">{allNodeLabel}</span>
              <CaretDownFilled
                className={`scope-tree-toggle ${allExpandableKeys.length > 0 && allExpandableKeys.every((k) => expandedSet.has(k)) ? 'scope-tree-toggle--open' : 'scope-tree-toggle--closed'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubtree(ALL_NODE_KEY);
                }}
              />
            </span>
          ),
          selectable: true,
        },
        ...domainNodes,
      ];
    }
    return domainNodes;
  }, [
    allExpandableKeys,
    allNodeLabel,
    checkable,
    expandedSet,
    renderLeafTitle,
    renderScopeTitle,
    showAllNode,
    toggleSubtree,
    treeData,
  ]);

  if (!loading && !antTreeData.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;
  }

  return (
    <Spin spinning={loading}>
      <Tree
        className={`scope-domain-tree ${className ?? ''}`.trim()}
        style={{ padding: 16, ...style }}
        showLine
        expandedKeys={expandedKeys}
        onExpand={(keys) => setExpandedKeys(keys as string[])}
        selectedKeys={[selectedScope ?? (showAllNode ? ALL_NODE_KEY : '')].filter(Boolean)}
        treeData={antTreeData}
        onSelect={(keys) => {
          const key = keys[0] as string | undefined;
          if (!key || key === ALL_NODE_KEY) {
            onSelect(undefined);
            return;
          }
          onSelect(key);
        }}
        checkable={checkable}
        checkedKeys={
          checkable
            ? {
                // 受控勾选：只在叶子 value 上设置，父节点半选态由 antd 据 children 推导
                checked: checkedKeys ?? [],
                halfChecked: [],
              }
            : undefined
        }
        onCheck={
          checkable
            ? (keys) => {
                // antd 返回 { checked, halfChecked }（联动模式）；把「全选」节点等价为全部叶子
                const checkedList = Array.isArray(keys)
                  ? keys
                  : (keys as { checked: React.Key[] }).checked;
                const hasAll = checkedList.includes(ALL_NODE_KEY);
                const leafSet = new Set(allLeafValues);
                const onlyLeaves = (checkedList as string[]).filter((k) => leafSet.has(k));
                onCheck?.(hasAll ? [...allLeafValues] : onlyLeaves);
              }
            : undefined
        }
      />
    </Spin>
  );
};

export default ScopeDomainTree;
