import { PageContainer } from '@ant-design/pro-components';
import { Button, Drawer, Input, Select, Space, Splitter, Typography, message } from 'antd';
import { useAISurface, useAIChatPrompts, useChatReference } from '@EADAF/ai-base';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildMaterializationExecutePrompts } from '@/ai/pageChatPrompts';
import DatabaseConnectionManager from '../components/DatabaseConnectionManager';
import EntitySelector from '../components/EntitySelector';
import MaterializationRunTable from '../components/MaterializationRunTable';
import SqlPreviewPanel from '../components/SqlPreviewPanel';
import {
  useDatabaseConnections,
  useMaterializationActions,
  useMaterializationEntities,
  useMaterializationRuns,
} from '../hooks/useMaterializationData';

const MaterializationExecutePage: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState<string>();
  const [targetSchema, setTargetSchema] = useState('bizdata_mat');
  const [activeCodeTab, setActiveCodeTab] = useState('sql');
  const [connDrawerOpen, setConnDrawerOpen] = useState(false);

  const selectedIdsRef = useRef(selectedIds);
  const connectionIdRef = useRef(connectionId);
  const targetSchemaRef = useRef(targetSchema);
  selectedIdsRef.current = selectedIds;
  connectionIdRef.current = connectionId;
  targetSchemaRef.current = targetSchema;

  const { erEntities, groupedOptions, loading: entitiesLoading, loadEntities } = useMaterializationEntities();
  const { connections, defaultConnection, loading: connLoading, loadConnections } = useDatabaseConnections();
  const { runs, total, page, pageSize, loading: runsLoading, loadRuns } = useMaterializationRuns(connectionId);
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
    void loadRuns(page);
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
        mutation.scope === 'bizdata.database.status'),
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
    <div style={{ height: '100%', overflow: 'auto', paddingRight: 8 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>物化配置</Typography.Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
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
            addonBefore={dbType === 'redis' ? 'Key 前缀' : dbType === 'mongodb' ? '数据库' : '目标 Schema'}
            value={targetSchema}
            onChange={(e) => setTargetSchema(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <Space style={{ marginTop: 8 }} wrap>
            <Button loading={executing} onClick={() => void handlePreview(actionOptions)}>
              预览
            </Button>
            <Button type="primary" loading={executing} onClick={() => void handleExecute(actionOptions)}>
              执行物化
            </Button>
            <Button onClick={() => setConnDrawerOpen(true)}>管理连接</Button>
          </Space>
        </div>

        <EntitySelector
          groupedOptions={groupedOptions}
          erEntities={erEntities}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      </Space>
    </div>
  );

  const rightPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 4 }}>
      <SqlPreviewPanel
        preview={preview}
        activeTab={activeCodeTab}
        onTabChange={setActiveCodeTab}
        dbType={dbType}
      />
      <div>
        <Typography.Text strong>物化历史</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <MaterializationRunTable
            runs={runs}
            loading={runsLoading || entitiesLoading}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={(p) => void loadRuns(p)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      <Splitter style={{ height: 'calc(100vh - 120px)', minHeight: 520 }}>
        <Splitter.Panel defaultSize="36%" min="280px" max="46%">
          {leftPanel}
        </Splitter.Panel>
        <Splitter.Panel>{rightPanel}</Splitter.Panel>
      </Splitter>

      <Drawer
        title="数据库连接管理"
        width={720}
        open={connDrawerOpen}
        onClose={() => setConnDrawerOpen(false)}
      >
        <DatabaseConnectionManager
          connections={connections}
          loading={connLoading}
          onRefresh={() => {
            void loadConnections();
            message.success('连接列表已刷新');
          }}
        />
      </Drawer>
    </PageContainer>
  );
};

export default MaterializationExecutePage;
