import { Checkbox, Typography } from 'antd';
import React, { useCallback } from 'react';

interface EntitySelectorProps {
  groupedOptions: Array<{ scope: string; options: { label: string; value: string }[] }>;
  erEntities: API.BusinessDataEntity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
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
    <div>
      <Typography.Text strong>选择 ER 实体</Typography.Text>
      <div style={{ marginTop: 8 }}>
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
              options={options}
            />
          </div>
        );
      })}
    </div>
  );
};

export default EntitySelector;
