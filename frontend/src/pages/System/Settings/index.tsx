import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import React from 'react';
import AppTransferTab from './AppTransferTab';
import PlatformTransferTab from './PlatformTransferTab';
import {
  ApiServiceSettingsTab,
  BackupSettingsTab,
  GeneralSettingsTab,
  MetadataSettingsTab,
} from './tabs';

const SystemSettingsPage: React.FC = () => {
  return (
    <PageContainer title={<></>}>
      <Tabs
        items={[
          {
            key: 'general',
            label: '通用',
            children: <GeneralSettingsTab />,
          },
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
          {
            key: 'platform-transfer',
            label: 'EADAF 平台导出/导入',
            children: <PlatformTransferTab />,
          },
        ]}
      />
    </PageContainer>
  );
};

export default SystemSettingsPage;
