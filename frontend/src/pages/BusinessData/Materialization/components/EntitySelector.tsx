import { Checkbox, Tag, Tooltip, Typography } from 'antd';
import React, { useCallback } from 'react';
import type { EntitySelectorItem } from '../hooks/useMaterializationData';

interface EntitySelectorProps {
  groupedOptions: Array<{ scope: string; options: EntitySelectorItem[] }>;
  erEntities: API.BusinessDataEntity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function getMaterializationTagColor(
  staleStatus?: API.MaterializationStatusItem['staleStatus'],
): string {
  if (staleStatus === 'latest') return 'green';
  if (staleStatus === 'stale') return 'orange';
  return 'magenta';
}

function formatVersionTagText(currentVersion?: number, materializedVersion?: number | null): string {
  const modelText = currentVersion != null ? `v${currentVersion}` : '-';
  const materializedText = materializedVersion != null ? `v${materializedVersion}` : '-';
  return `${modelText}/${materializedText}`;
}

function getMaterializationTagTooltip(item: EntitySelectorItem): string | undefined {
  if (item.staleStatus === 'latest') return '物化版本为最新';
  if (item.staleStatus === 'stale') {
    return `模型已更新至 v${item.currentVersion}，物化仍为 v${item.materializedVersion}，建议重新物化`;
  }
  return '尚未物化';
}

const EntitySelector: React.FC<EntitySelectorProps> = ({
  groupedOptions,
  erEntities,
  selectedIds,
  onChange,
}) => {
  const allEntityIds = erEntities.map((x) => x.id!).filter(Boolean);

  const toggleScope = useCallback(
    (scopeEntityIds: string[], checked: boolean) => {
      if (checked) {
        onChange([...new Set([...selectedIds, ...scopeEntityIds])]);
        return;
      }
      const scopeSet = new Set(scopeEntityIds);
      onChange(selectedIds.filter((id) => !scopeSet.has(id)));
    },
    [onChange, selectedIds],
  );

  const toggleEntityInScope = useCallback(
    (scopeEntityIds: string[], checkedIds: string[]) => {
      const scopeSet = new Set(scopeEntityIds);
      const otherIds = selectedIds.filter((id) => !scopeSet.has(id));
      onChange([...otherIds, ...checkedIds]);
    },
    [onChange, selectedIds],
  );

  return (
    <div style={{ padding: 16 }}>
      <div>
        <Checkbox
          indeterminate={selectedIds.length > 0 && selectedIds.length < allEntityIds.length}
          checked={selectedIds.length === allEntityIds.length && allEntityIds.length > 0}
          onChange={(e) => onChange(e.target.checked ? allEntityIds : [])}
        >
          全选
        </Checkbox>
      </div>
      {groupedOptions.map(({ scope, options }) => {
        const scopeEntityIds = options.map((o) => o.value);
        const selectedInScope = scopeEntityIds.filter((id) => selectedIds.includes(id));
        const allScopeSelected =
          scopeEntityIds.length > 0 && selectedInScope.length === scopeEntityIds.length;
        const scopeIndeterminate =
          selectedInScope.length > 0 && selectedInScope.length < scopeEntityIds.length;

        return (
          <div key={scope} style={{ marginTop: 12 }}>
            <Checkbox
              indeterminate={scopeIndeterminate}
              checked={allScopeSelected}
              onChange={(e) => toggleScope(scopeEntityIds, e.target.checked)}
            >
              <Typography.Text type="secondary">{scope}</Typography.Text>
            </Checkbox>
            <Checkbox.Group
              style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, marginLeft: 24 }}
              value={selectedIds.filter((id) => scopeEntityIds.includes(id))}
              onChange={(vals) => toggleEntityInScope(scopeEntityIds, vals as string[])}
            >
              {options.map((item) => (
                <Checkbox key={item.value} value={item.value}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>
                      {item.label}
                      {item.codeLeaf ? ` (${item.codeLeaf})` : ''}
                    </span>
                    <Tooltip title={getMaterializationTagTooltip(item)}>
                      <Tag
                        variant="outlined"
                        color={getMaterializationTagColor(item.staleStatus)}
                        style={{ margin: 0 }}
                      >
                        {formatVersionTagText(item.currentVersion, item.materializedVersion)}
                      </Tag>
                    </Tooltip>
                  </span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
        );
      })}
    </div>
  );
};

export default EntitySelector;
