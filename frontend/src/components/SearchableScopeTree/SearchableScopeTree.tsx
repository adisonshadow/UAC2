import { ApiOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Empty, Input, Spin, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useMemo, useState } from 'react';
import './index.css';

const { Text } = Typography;

/**
 * 统一的「可检索 + 可勾选 + 域级联」作用域树节点。
 * 抽象掉业务API树（{name,isApiNode}）与内置API树（{label,isLeaf}）的字段差异。
 */
export interface ScopeTreeNode {
  /** 节点唯一 key */
  key: string;
  /** 显示名 */
  title: string;
  /** 是否叶子（具体 API）——叶子才允许勾选授权 */
  isLeaf?: boolean;
  /** 副标题（如 code），显示在标题右侧 */
  subTitle?: string;
  /** 辅助计数（如域下服务数） */
  count?: number;
  children?: ScopeTreeNode[];
}

export interface SearchableScopeTreeProps {
  /** 已扁平化的树数据（已归一为 ScopeTreeNode） */
  treeData: ScopeTreeNode[];
  /** 已勾选的 key 列表 */
  value?: string[];
  onChange?: (keys: string[]) => void;
  loading?: boolean;
  /** 空数据时的占位文案 */
  emptyText?: string;
  /** 搜索框占位文案 */
  searchPlaceholder?: string;
  /** 容器高度，默认 52vh */
  height?: number | string;
  /**
   * 勾选值保留策略：
   * - 'leaf'（默认）：域节点 checkbox 禁用，仅叶子可勾选；value 只含叶子 key（内置 API 用）
   * - 'all'：域节点也可勾选，级联到子节点；value 含域+叶子 key，由调用方区分（业务 API 用，
   *   后端按 domainCodes/serviceCodes 区分）
   */
  valueStrategy?: 'leaf' | 'all';
}

/** 把 ScopeTreeNode 转为 antd DataNode。域节点与叶子均可勾选，级联由 antd Tree 内置处理。 */
function toAntTreeData(
  nodes: ScopeTreeNode[],
  matchKeys: Set<string>,
  searchValue: string,
): DataNode[] {
  return nodes
    .map((node) => {
      const isLeaf = !!node.isLeaf || !node.children?.length;
      const titleText = node.title;
      const hit = matchKeys.has(node.key);

      // 搜索高亮
      let title: React.ReactNode = titleText;
      if (searchValue) {
        const idx = titleText.toLowerCase().indexOf(searchValue.toLowerCase());
        if (idx > -1) {
          const before = titleText.substring(0, idx);
          const match = titleText.substring(idx, idx + searchValue.length);
          const after = titleText.slice(idx + searchValue.length);
          title = (
            <span>
              {before}
              <span className="searchable-scope-tree__hit">{match}</span>
              {after}
            </span>
          );
        }
      }

      const nodeTitle = isLeaf ? (
        <span>
          <ApiOutlined style={{ marginRight: 6, color: '#1677ff' }} />
          {title}
          {node.subTitle ? (
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              {node.subTitle}
            </Text>
          ) : null}
        </span>
      ) : (
        <span>
          <AppstoreOutlined style={{ marginRight: 6 }} />
          <Text strong>{title}</Text>
          {node.count != null ? (
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              ({node.count})
            </Text>
          ) : null}
        </span>
      );

      const children = node.children?.length
        ? toAntTreeData(node.children, matchKeys, searchValue)
        : undefined;

      // 搜索时：非命中且无命中子节点则过滤掉
      if (searchValue && !hit && (!children || children.length === 0)) {
        return null;
      }

      return {
        key: node.key,
        title: nodeTitle,
        // 两个策略下域节点都可勾选，选中/取消级联应用到所有子节点；
        // 区别仅在 onCheck 后 value 保留哪些 key（见 onCheck 中的 valueStrategy 分支）
        checkable: true,
        selectable: false,
        isLeaf,
        children,
      } as DataNode;
    })
    .filter(Boolean) as DataNode[];
}

/** 收集树中所有节点（用于搜索时匹配 + 展开父节点） */
function collectAllKeys(nodes: ScopeTreeNode[]): { key: string; title: string }[] {
  const list: { key: string; title: string }[] = [];
  const walk = (items: ScopeTreeNode[]) => {
    items.forEach((n) => {
      list.push({ key: n.key, title: `${n.title} ${n.subTitle || ''}` });
      if (n.children?.length) walk(n.children);
    });
  };
  walk(nodes);
  return list;
}

function getParentKey(key: string, tree: ScopeTreeNode[]): string | undefined {
  let parentKey: string | undefined;
  for (const node of tree) {
    if (node.children) {
      if (node.children.some((item) => item.key === key)) {
        parentKey = node.key;
      } else {
        const deeper = getParentKey(key, node.children);
        if (deeper) parentKey = deeper;
      }
    }
  }
  return parentKey;
}

/** 收集所有叶子 key（'leaf' 策略下用于剔除被级联勾选的域节点 key） */
function collectLeafKeys(nodes: ScopeTreeNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (items: ScopeTreeNode[]) => {
    items.forEach((n) => {
      const isLeaf = !!n.isLeaf || !n.children?.length;
      if (isLeaf) set.add(n.key);
      if (n.children?.length) walk(n.children);
    });
  };
  walk(nodes);
  return set;
}

/**
 * 可检索的作用域树（业务API配置 / 内置API配置 共用）。
 *
 * 统一行为：
 * 1. 域（非叶节点）有 checkbox，选中/取消会通过 antd Tree 内置级联应用到所有子节点；
 * 2. 都展示具体的 API（叶子节点）；
 * 3. 树上方支持模糊检索（参考 antd SearchableTree demo）；
 * 4. 树外部容器（scroll）高度 52vh。
 */
const SearchableScopeTree: React.FC<SearchableScopeTreeProps> = ({
  treeData,
  value = [],
  onChange,
  loading = false,
  emptyText = '暂无数据',
  searchPlaceholder = '检索域 / API 名称',
  height = '42vh',
  valueStrategy = 'leaf',
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const flatList = useMemo(() => collectAllKeys(treeData), [treeData]);
  const leafKeySet = useMemo(() => collectLeafKeys(treeData), [treeData]);

  const handleSearch = (val: string) => {
    const v = val.trim();
    if (!v) {
      setSearchValue('');
      return;
    }
    const newExpandedKeys = flatList
      .map((item) => {
        if (item.title.toLowerCase().includes(v.toLowerCase())) {
          return getParentKey(item.key, treeData);
        }
        return undefined;
      })
      .filter((k, i, self): k is string => !!k && self.indexOf(k) === i);
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(true);
    setSearchValue(v);
  };

  const matchKeySet = useMemo(() => {
    if (!searchValue) return new Set<string>();
    const v = searchValue.toLowerCase();
    return new Set(flatList.filter((i) => i.title.toLowerCase().includes(v)).map((i) => i.key));
  }, [flatList, searchValue]);

  const antTreeData = useMemo(
    () => toAntTreeData(treeData, matchKeySet, searchValue),
    [treeData, matchKeySet, searchValue],
  );

  return (
    <div className="searchable-scope-tree">
      <Input.Search
        className="searchable-scope-tree__search"
        placeholder={searchPlaceholder}
        allowClear
        onChange={(e) => handleSearch(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Spin spinning={loading}>
        {antTreeData.length ? (
          <div className="searchable-scope-tree__scroll" style={{ height }}>
            <Tree
              showLine
              checkable
              selectable={false}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onExpand={(keys) => {
                setExpandedKeys(keys);
                setAutoExpandParent(false);
              }}
              checkedKeys={value}
              onCheck={(keys) => {
                const next = Array.isArray(keys) ? keys : keys.checked;
                if (valueStrategy === 'leaf') {
                  // 只保留叶子 key（具体 API），剔除被级联勾选的域节点 key
                  onChange?.(next.map(String).filter((k) => leafKeySet.has(k)));
                } else {
                  // 保留所有被勾选的 key（含域节点）
                  onChange?.(next.map(String));
                }
              }}
              treeData={antTreeData}
              defaultExpandAll={!searchValue}
            />
          </div>
        ) : (
          <Empty description={emptyText} />
        )}
      </Spin>
    </div>
  );
};

export default SearchableScopeTree;
