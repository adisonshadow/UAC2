import { Tag, Tooltip } from 'antd';
import React from 'react';
import type { ScopeDomainTreeNode } from '@/components/ScopeDomainTree';

/** 叶子节点 leafData 中物化状态相关的字段约定 */
interface MaterializationLeafData {
  value: string;
  currentVersion?: number;
  materializedVersion?: number | null;
  staleStatus?: 'not_materialized' | 'latest' | 'stale';
}

function getMaterializationTagColor(
  staleStatus?: MaterializationLeafData['staleStatus'],
): string {
  if (staleStatus === 'latest') return 'green';
  if (staleStatus === 'stale') return 'orange';
  return 'magenta';
}

function formatVersionTagText(
  currentVersion?: number,
  materializedVersion?: number | null,
): string {
  const modelText = currentVersion != null ? `v${currentVersion}` : '-';
  const materializedText = materializedVersion != null ? `v${materializedVersion}` : '-';
  return `${modelText}/${materializedText}`;
}

function getMaterializationTagTooltip(data: MaterializationLeafData): string | undefined {
  if (data.staleStatus === 'latest') return '物化版本为最新';
  if (data.staleStatus === 'stale') {
    return `模型已更新至 v${data.currentVersion}，物化仍为 v${data.materializedVersion}，建议重新物化`;
  }
  return '尚未物化';
}

interface LeafVersionTagProps {
  node: ScopeDomainTreeNode;
}

/**
 * 物化执行页左侧树的叶子节点标题：实体名 + 版本 Tag（模型版本/物化版本）。
 * 配合升级后的 ScopeDomainTree 的 renderLeafTitle 使用。
 */
const LeafVersionTag: React.FC<LeafVersionTagProps> = ({ node }) => {
  const data = node.leafData as MaterializationLeafData | undefined;
  if (!data) {
    return <span>{node.name}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span>{node.name}</span>
      <Tooltip title={getMaterializationTagTooltip(data)}>
        <Tag
          variant="outlined"
          color={getMaterializationTagColor(data.staleStatus)}
          style={{ margin: 0 }}
        >
          {formatVersionTagText(data.currentVersion, data.materializedVersion)}
        </Tag>
      </Tooltip>
    </span>
  );
};

export default LeafVersionTag;
