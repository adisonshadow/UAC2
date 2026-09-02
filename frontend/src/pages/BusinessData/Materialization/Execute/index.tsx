import { Button, Input, Select, Space, Splitter } from 'antd';
import { useAISurface, useAIChatPrompts, useChatReference } from '@eadaf/ai-base';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildMaterializationExecutePrompts } from '@/ai/pageChatPrompts';
import ScopeDomainTree from '@/components/ScopeDomainTree';
import LeafVersionTag from '../components/LeafVersionTag';
import SqlPreviewPanel from '../components/SqlPreviewPanel';
import {
  useDatabaseConnections,
  useMaterializationActions,
  useMaterializationEntities,
} from '../hooks/useMaterializationData';
import { getMaterializationTargetLabel } from '@/utils/apiResponse';

const MaterializationExecutePage: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState<string>();
  const [targetSchema, setTargetSchema] = useState('bizdata_mat');
  const [activeCodeTab, setActiveCodeTab] = useState('sql');
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);

  const selectedIdsRef = useRef(selectedIds);
  const connectionIdRef = useRef(connectionId);
  const targetSchemaRef = useRef(targetSchema);
  selectedIdsRef.current = selectedIds;
  connectionIdRef.current = connectionId;
  targetSchemaRef.current = targetSchema;

  const {
    erEntities,
    scopeTree,
    loading: entitiesLoading,
    loadAll: loadEntities,
  } = useMaterializationEntities(connectionId);
  const { connections, defaultConnection, loading: connLoading, loadConnections } = useDatabaseConnections();
  const { executing, preview, handlePreview, handleExecute } = useMaterializationActions();

  const selectedConnection = connections.find((c) => c.id === connectionId) || defaultConnection;
  const dbType = selectedConnection?.dbType;
  const { references } = useChatReference();
  const chatPrompts = useMemo(
    () =>
      buildMaterializationExecutePrompts(references, {
        selectedCount: selectedIds.length,
        connectionName: selectedConnection?.name,
      }),
    [references, selectedIds.length, selectedConnection?.name],
  );
  useAIChatPrompts(chatPrompts);

  useEffect(() => {
    if (defaultConnection?.id && !connectionId) {
      setConnectionId(defaultConnection.id);
      setTargetSchema(defaultConnection.targetSchema || 'bizdata_mat');
    }
  }, [defaultConnection, connectionId]);

  const refreshAll = () => {
    void loadEntities();
    void loadConnections();
    setRunsRefreshKey((k) => k + 1);
  };

  useAISurface({
    id: 'bizdata.materialization.execute',
    domain: 'bizdata',
    label: '物化执行',
    read: () => ({
      selectedEntityIds: selectedIdsRef.current,
      connectionId: connectionIdRef.current,
      targetSchema: targetSchemaRef.current,
    }),
    refresh: refreshAll,
    applyMutation: (mutation) => {
      if (mutation.type.startsWith('materialization.connection.')) return;
      if (
        mutation.type.startsWith('materialization.') ||
        mutation.scope?.includes('materialization') ||
        mutation.scope === 'bizdata.database.status'
      ) {
        refreshAll();
      }
    },
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata' &&
      (mutation.type.startsWith('materialization.') ||
        mutation.scope === 'bizdata.materialization.execute' ||
        mutation.scope === 'bizdata.database.status') &&
      !mutation.type.startsWith('materialization.connection.'),
  });

  const actionOptions = {
    selectedIds,
    connectionId,
    targetSchema,
    dbType,
    erEntities,
    onSuccess: refreshAll,
  };

  const leftPanel = (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        paddingRight: 8,
      }}
    >
      <div style={{ flexShrink: 0, padding: 10 }}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择目标数据库连接"
          value={connectionId}
          loading={connLoading}
          options={connections.map((c) => ({
            label: `${c.name} (${c.dbType})`,
            value: c.id,
          }))}
          onChange={(id) => {
            setConnectionId(id);
            const conn = connections.find((c) => c.id === id);
            if (conn?.targetSchema) setTargetSchema(conn.targetSchema);
          }}
        />
        <Input
          addonBefore={
            !dbType || dbType === 'postgresql'
              ? '目标 Schema'
              : getMaterializationTargetLabel(dbType)
          }
          value={targetSchema}
          onChange={(e) => setTargetSchema(e.target.value)}
          style={{ marginTop: 8 }}
        />
        {selectedIds.length > 0 && (
          <Space style={{ marginTop: 8 }} wrap>
            <Button loading={executing} onClick={() => void handlePreview(actionOptions)}>
              预览
            </Button>
            <Button type="primary" loading={executing} onClick={() => void handleExecute(actionOptions)}>
              执行物化
            </Button>
          </Space>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <ScopeDomainTree
          treeData={scopeTree}
          checkable
          checkedKeys={selectedIds}
          onCheck={setSelectedIds}
          onSelect={() => undefined}
          showAllNode
          allNodeLabel="全选"
          renderLeafTitle={(node) => <LeafVersionTag node={node} />}
          loading={entitiesLoading}
          emptyDescription="暂无实体"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );

  const rightPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingLeft: 4 }}>
      <SqlPreviewPanel
        preview={preview}
        activeTab={activeCodeTab}
        onTabChange={setActiveCodeTab}
        dbType={dbType}
        connectionId={connectionId}
        runsRefreshKey={runsRefreshKey}
      />
    </div>
  );

  return (
    <div style={{ height: 'calc(100vh - 56px)' }}>
      <Splitter style={{ height: '100%', minHeight: 520 }}>
        <Splitter.Panel defaultSize="360px" min="280px" max="460px">
          {leftPanel}
        </Splitter.Panel>
        <Splitter.Panel>{rightPanel}</Splitter.Panel>
      </Splitter>
    </div>
  );
};

export default MaterializationExecutePage;
