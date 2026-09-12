import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import React from 'react';
import AppTransferTab from './AppTransferTab';
import {
  ApiServiceSettingsTab,
  BackupSettingsTab,
  MetadataSettingsTab,
} from './tabs';

const SystemSettingsPage: React.FC = () => {
  return (
    <PageContainer title={<></>}>
      <Tabs
        items={[
          {
            key: 'metadata',
            label: '元数据',
            children: <MetadataSettingsTab />,
          },
          {
            key: 'api-service',
            label: 'API 服务',
            children: <ApiServiceSettingsTab />,
          },
          { key: 'backup', label: '备份', children: <BackupSettingsTab /> },
          {
            key: 'app-transfer',
            label: '应用导出/导入',
            children: <AppTransferTab />,
          },
        ]}
      />
    </PageContainer>
  );
};

export default SystemSettingsPage;
