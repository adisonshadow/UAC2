import {
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { ActionType, PageContainer, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useAISurface } from '@EADAF/ai-base';
import { Button, Popconfirm, Tag, message } from 'antd';
import React, { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableActionButton, TableActions, TABLE_ACTION_COLUMN_BASE } from '@/components/TableActions';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import {
  deleteCollectionPipeline,
  getCollectionPipelines,
  postCollectionPipelineDisable,
  postCollectionPipelinePublish,
} from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

const PROTOCOL_LABEL: Record<string, string> = {
  serial: '串口',
  modbus_rtu: 'Modbus RTU',
  modbus_tcp: 'Modbus TCP',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  published: 'success',
  disabled: 'warning',
};

const CollectionPipelineListPage: React.FC = () => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const actionRef = useRef<ActionType>();

  useAISurface({
    id: 'bizdata.collection-pipelines.list',
    domain: 'bizdata',
    label: '采集管道列表',
    read: () => ({ path: '/api_services/collection-pipelines' }),
    refresh: () => actionRef.current?.reload(),
  });

  const handlePublish = async (id: string) => {
    const res = await postCollectionPipelinePublish(id);
    if (isApiSuccess(res)) {
      messageApi.success('已发布');
      actionRef.current?.reload();
    } else {
      messageApi.error(getApiErrorMessage(res, '发布失败'));
    }
  };

  const handleDisable = async (id: string) => {
    const res = await postCollectionPipelineDisable(id);
    if (isApiSuccess(res)) {
      messageApi.success('已禁用');
      actionRef.current?.reload();
    } else {
      messageApi.error(getApiErrorMessage(res, '禁用失败'));
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteCollectionPipeline(id);
    if (isApiSuccess(res)) {
      messageApi.success('已删除');
      actionRef.current?.reload();
    } else {
      messageApi.error(getApiErrorMessage(res, '删除失败'));
    }
  };

  const columns: ProColumns<API.CollectionPipeline>[] = [
    { title: 'code', dataIndex: 'code', copyable: true, ellipsis: true, width: 220 },
    { title: '名称', dataIndex: 'name', width: 140 },
    {
      title: '协议',
      dataIndex: 'protocolType',
      width: 120,
      render: (_, r) => PROTOCOL_LABEL[r.protocolType || ''] || r.protocolType,
    },
    {
      title: '采集 API',
      dataIndex: 'basePath',
      ellipsis: true,
      copyable: true,
      width: 220,
      render: (_, r) => r.basePath || `/api/v1/ingest/${r.routePath}`,
    },
    { title: '实体', dataIndex: 'entityCode', ellipsis: true, width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, r) => <Tag color={STATUS_COLOR[r.status || '']}>{r.status}</Tag>,
    },
    {
      ...TABLE_ACTION_COLUMN_BASE,
      dataIndex: 'option',
      width: 180,
      render: (_, record) => (
        <TableActions>
          <TableActionButton
            title="编辑"
            icon={<EditOutlined />}
            onClick={() => navigate(`/api_services/collection-pipelines/${record.id}/edit`)}
          />
          <TableActionButton
            title="测试"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(`/api_services/collection-pipelines/${record.id}/test`)}
          />
          {record.status === 'draft' || record.status === 'disabled' ? (
            <TableActionButton
              title="发布"
              icon={<CloudUploadOutlined />}
              onClick={() => void handlePublish(record.id!)}
            />
          ) : null}
          {record.status === 'published' ? (
            <TableActionButton
              title="禁用"
              icon={<StopOutlined />}
              onClick={() => void handleDisable(record.id!)}
            />
          ) : null}
          <Popconfirm title="确定删除该采集管道？" onConfirm={() => void handleDelete(record.id!)}>
            <TableActionButton title="删除" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </TableActions>
      ),
    },
  ];

  const request = useCallback(async (params: { current?: number; pageSize?: number; code?: string }) => {
    const res = await getCollectionPipelines({
      page: params.current,
      size: params.pageSize,
      codePrefix: params.code,
    });
    const data = getApiData<API.CollectionPipelineList>(res);
    return {
      data: data?.items || [],
      success: isApiSuccess(res),
      total: data?.total || 0,
    };
  }, []);

  return (
    <PageContainer
      title="采集数据结构化"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/api_services/collection-pipelines/create')}>
          新建管道
        </Button>
      }
    >
      {contextHolder}
      <ProTable<API.CollectionPipeline>
        actionRef={actionRef}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        columns={columns}
        request={request}
        search={{ labelWidth: 'auto' }}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />
    </PageContainer>
  );
};

export default CollectionPipelineListPage;
