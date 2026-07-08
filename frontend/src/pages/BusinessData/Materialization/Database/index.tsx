import { ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Select, Space, message } from 'antd';
import { useAISurface, useAIChatPrompts, useChatReference, sendMockUserMessage } from '@EADAF/ai-base';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildMaterializedDatabasePrompts } from '@/ai/pageChatPrompts';
import MaterializedTableList, { materializedRowKey } from '../components/MaterializedTableList';
import { useDatabaseConnections } from '../hooks/useMaterializationData';
import { buildMockDataPrompt } from '../utils/mockDataPrompt';
import { getMaterializationStatus } from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

const MaterializedDatabasePage: React.FC = () => {
  const [connectionId, setConnectionId] = useState<string>();
  const [items, setItems] = useState<API.MaterializationStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const connectionIdRef = useRef(connectionId);
  connectionIdRef.current = connectionId;

  const { connections, defaultConnection } = useDatabaseConnections();
  const { references } = useChatReference();
  const chatPrompts = useMemo(() => buildMaterializedDatabasePrompts(references), [references]);
  useAIChatPrompts(chatPrompts);

  useEffect(() => {
    if (defaultConnection?.id && !connectionId) {
      setConnectionId(defaultConnection.id);
    }
  }, [defaultConnection, connectionId]);

  const loadStatus = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const res = await getMaterializationStatus({ connectionId });
      const data = getApiData<API.MaterializationStatusItem[]>(res);
      if (isApiSuccess(res)) {
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [connectionId]);

  const materializedItems = useMemo(
    () => items.filter((item) => item.materializedVersion != null && item.staleStatus !== 'not_materialized'),
    [items],
  );

  const staleCount = useMemo(
    () => materializedItems.filter((i) => i.staleStatus === 'stale').length,
    [materializedItems],
  );

  const selectedItems = useMemo(
    () => materializedItems.filter((item) => selectedRowKeys.includes(materializedRowKey(item))),
    [materializedItems, selectedRowKeys],
  );

  useAISurface({
    id: 'bizdata.database.status',
    domain: 'bizdata',
    label: '数据库物化现状',
    read: () => ({
      filterConnectionId: connectionIdRef.current,
      staleCount,
      itemCount: materializedItems.length,
      selectedCount: selectedRowKeys.length,
    }),
    refresh: loadStatus,
    applyMutation: (mutation) => {
      if (
        mutation.type.startsWith('materialization.') ||
        mutation.scope?.includes('materialization') ||
        mutation.scope === 'bizdata.database.status'
      ) {
        void loadStatus();
      }
    },
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata' &&
      (mutation.type.startsWith('materialization.') ||
        mutation.scope === 'bizdata.database.status' ||
        mutation.scope === 'bizdata.materialization.execute'),
  });

  const handleMockData = () => {
    if (!selectedItems.length) return;
    sendMockUserMessage(buildMockDataPrompt(selectedItems, connectionId));
  };

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      <Space orientation="vertical" size={16} style={{ width: '100%', paddingTop: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 240 }}
            placeholder="选择数据库连接"
            value={connectionId}
            options={connections.map((c) => ({
              label: `${c.name} (${c.dbType})`,
              value: c.id,
            }))}
            onChange={setConnectionId}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadStatus()}>
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button type="primary" onClick={handleMockData}>
              AI MOCK数据
            </Button>
          )}
        </Space>
        <MaterializedTableList
          items={materializedItems}
          loading={loading}
          showConnectionInfo
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={(keys) => setSelectedRowKeys(keys)}
        />
      </Space>
    </PageContainer>
  );
};

export default MaterializedDatabasePage;
