import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { ActionType, PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Modal, message } from 'antd';
import React, { useRef, useMemo } from 'react';
import { useAIChatPrompts, useChatReference } from '@EADAF/ai-base';
import { buildAIProviderPrompts } from '@/ai/pageChatPrompts';
import { useNavigate } from 'react-router-dom';
import { useAIListSurface } from '@/ai/useAIListSurface';
import { TableActionButton, TableActions, TABLE_ACTION_COLUMN_BASE } from '@/components/TableActions';
import { deleteAdminProvidersId, getAdminProviders } from '@/services/UAC/api/adminProviders';
import { isApiSuccess, parseApiListResponse } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { useProTableSearchCollapse } from '@/hooks/useProTableSearchCollapse';
import { augmentColumnsWithChatReference } from '@/utils/augmentColumnsWithChatReference';
import { buildAIProviderReference } from '@/ai/chatReferenceBuilders';
import { providerTableColumns } from './schema';

const ProvidersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { references } = useChatReference();
  const chatPrompts = useMemo(() => buildAIProviderPrompts(references), [references]);
  useAIChatPrompts(chatPrompts);

  useAIListSurface('aibase.providers.list', 'AI 服务商列表', actionRef);
  const search = useProTableSearchCollapse('ai-management.providers');

  const handleDelete = (record: API.AdminProvider) => {
    Modal.confirm({
      title: '确认停用',
      content: `确定要停用服务商「${record.name}」吗？`,
      onOk: async () => {
        const response = await deleteAdminProvidersId({ id: record.id || '' });
        if (isApiSuccess(response)) {
          messageApi.success('已停用');
          actionRef.current?.reload();
        } else {
          messageApi.error(response.message || '操作失败');
        }
      },
    });
  };

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      {contextHolder}
      <ProTable<API.AdminProvider>
        actionRef={actionRef}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        search={search}
        columns={[
          ...augmentColumnsWithChatReference(providerTableColumns, 'name', buildAIProviderReference),
          {
            ...TABLE_ACTION_COLUMN_BASE,
            width: 120,
            render: (_, record) => (
              <TableActions>
                <TableActionButton
                  title="查看"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/ai_management/providers/${record.id}`)}
                />
                <TableActionButton
                  title="编辑"
                  icon={<EditOutlined />}
                  onClick={() => navigate(`/ai_management/providers/${record.id}/edit`)}
                />
                <TableActionButton
                  title="停用"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record)}
                />
              </TableActions>
            ),
          },
        ]}
        request={async (params) => {
          const response = await getAdminProviders({
            page: params.current,
            size: params.pageSize,
          });
          const { items, total, success } = parseApiListResponse<API.AdminProvider>(response);
          return { data: items, total, success };
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/ai_management/providers/create')}
          >
            新建服务商
          </Button>,
        ]}
        pagination={{ pageSize: 10 }}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />
    </PageContainer>
  );
};

export default ProvidersPage;
