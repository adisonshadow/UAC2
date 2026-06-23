import { EyeOutlined } from '@ant-design/icons';
import { ActionType, PageContainer, ProDescriptions, ProTable } from '@ant-design/pro-components';
import { Button, Drawer, Spin, message } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getAdminAiRequestLogs,
  getAdminAiRequestLogsId,
} from '@/services/UAC/api/adminAiRequestLogs';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { requestLogTableColumns } from './schema';

const RequestLogsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, any>>();

  const openDetail = async (id: string) => {
    try {
      setLoading(true);
      setDrawerOpen(true);
      const response = await getAdminAiRequestLogsId({ id });
      if (!isApiSuccess(response)) {
        messageApi.error('获取日志详情失败');
        return;
      }
      setDetail(getApiData<Record<string, any>>(response));
    } catch {
      messageApi.error('获取日志详情失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      {contextHolder}
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        search={false}
        columns={[
          ...requestLogTableColumns,
          {
            title: '操作',
            valueType: 'option',
            width: 80,
            render: (_, record) => (
              <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record.id)} />
            ),
          },
        ]}
        request={async (params) => {
          const response = await getAdminAiRequestLogs({
            page: params.current,
            size: params.pageSize,
          });
          return parseApiListResponse(response);
        }}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer title="请求日志详情" width={520} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Spin spinning={loading}>
          {detail && (
            <ProDescriptions column={1} dataSource={detail}>
              <ProDescriptions.Item label="Trace ID" dataIndex="traceId" copyable />
              <ProDescriptions.Item label="Model Slug" dataIndex="slug" />
              <ProDescriptions.Item label="状态码" dataIndex="statusCode" />
              <ProDescriptions.Item label="耗时(ms)" dataIndex="durationMs" />
              <ProDescriptions.Item label="错误码" dataIndex="errorCode" />
              <ProDescriptions.Item label="创建时间" dataIndex="createdAt" valueType="dateTime" />
            </ProDescriptions>
          )}
        </Spin>
      </Drawer>
    </PageContainer>
  );
};

export default RequestLogsPage;
