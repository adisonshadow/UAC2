import { PageContainer } from '@ant-design/pro-components';
import { message } from '@/utils/antdAppApis';

import { useAISurface } from '@EADAF/ai-base';
import React from 'react';
import DatabaseConnectionManager from '../components/DatabaseConnectionManager';
import { useDatabaseConnections } from '../hooks/useMaterializationData';

const DatabaseConnectionsPage: React.FC = () => {
  const { connections, loading, loadConnections } = useDatabaseConnections();

  useAISurface({
    id: 'bizdata.database.connections',
    domain: 'bizdata',
    label: '数据库连接',
    read: () => ({ path: '/business_data/database-connections', count: connections.length }),
    refresh: () => loadConnections(),
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata' && mutation.type.startsWith('materialization.'),
  });

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      <div style={{ paddingTop: 16 }}>
        <DatabaseConnectionManager
          connections={connections}
          loading={loading}
          onRefresh={() => {
            void loadConnections();
            message.success('连接列表已刷新');
          }}
        />
      </div>
    </PageContainer>
  );
};

export default DatabaseConnectionsPage;
