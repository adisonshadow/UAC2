import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  ActionType,
  PageContainer,
  ProForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Drawer, Form, Modal, Space, Spin, message } from 'antd';
import React, { useRef, useState } from 'react';
import {
  deleteAdminProvidersId,
  getAdminProviders,
  getAdminProvidersId,
  patchAdminProvidersId,
  postAdminProviders,
} from '@/services/UAC/api/adminProviders';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { ADAPTER_TYPE_OPTIONS, SLUG_PATTERN } from '../constants';
import { providerTableColumns } from './schema';

type DrawerMode = 'create' | 'view' | 'edit';

const ProvidersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [currentId, setCurrentId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setDrawerMode('create');
    setCurrentId(undefined);
    form.resetFields();
    form.setFieldsValue({ adapterType: 'openai_compatible', isActive: true });
    setDrawerOpen(true);
  };

  const openDetail = async (id: string, editable: boolean) => {
    try {
      setLoading(true);
      const response = await getAdminProvidersId({ id });
      if (!isApiSuccess(response)) {
        messageApi.error('获取服务商详情失败');
        return;
      }
      const data = getApiData<API.AdminProvider>(response);
      setDrawerMode(editable ? 'edit' : 'view');
      setCurrentId(id);
      form.setFieldsValue({
        ...data,
        apiKey: undefined,
      });
      setDrawerOpen(true);
    } catch {
      messageApi.error('获取服务商详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (drawerMode === 'create') {
        const response = await postAdminProviders({
          name: values.name,
          slug: values.slug?.trim() || undefined,
          baseUrl: values.baseUrl,
          apiKey: values.apiKey,
          adapterType: values.adapterType,
        });
        if (isApiSuccess(response)) {
          messageApi.success('创建成功');
          setDrawerOpen(false);
          actionRef.current?.reload();
        } else {
          messageApi.error(response.message || '创建失败');
        }
        return;
      }

      if (drawerMode === 'edit' && currentId) {
        const payload: Record<string, unknown> = {
          name: values.name,
          slug: values.slug,
          baseUrl: values.baseUrl,
          adapterType: values.adapterType,
          isActive: values.isActive,
        };
        if (values.apiKey) {
          payload.apiKey = values.apiKey;
        }
        const response = await patchAdminProvidersId({ id: currentId }, payload);
        if (isApiSuccess(response)) {
          messageApi.success('更新成功');
          setDrawerOpen(false);
          actionRef.current?.reload();
        } else {
          messageApi.error(response.message || '更新失败');
        }
      }
    } catch (error: any) {
      if (!error?.errorFields) {
        messageApi.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

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

  const isReadonly = drawerMode === 'view';

  return (
    <PageContainer  pageHeaderRender={() => {return <></> }}>
      {contextHolder}
      <ProTable<API.AdminProvider>
        actionRef={actionRef}
        rowKey="id"
        columns={[
          ...providerTableColumns,
          {
            title: '操作',
            valueType: 'option',
            width: 150,
            render: (_, record) => [
              <Button
                key="view"
                type="link"
                icon={<EyeOutlined />}
                onClick={() => openDetail(record.id || '', false)}
              >
                查看
              </Button>,
              <Button
                key="edit"
                type="link"
                icon={<EditOutlined />}
                onClick={() => openDetail(record.id || '', true)}
              >
                编辑
              </Button>,
              <Button
                key="delete"
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              >
                停用
              </Button>,
            ],
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
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建服务商
          </Button>,
        ]}
        pagination={{ pageSize: 10 }}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer
        title={
          drawerMode === 'create'
            ? '新建 AI 服务商'
            : drawerMode === 'edit'
              ? '编辑 AI 服务商'
              : 'AI 服务商详情'
        }
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          !isReadonly ? (
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button type="primary" loading={saving} onClick={handleSubmit}>
                保存
              </Button>
            </Space>
          ) : (
            <Button type="primary" onClick={() => setDrawerMode('edit')}>
              编辑
            </Button>
          )
        }
      >
        <Spin spinning={loading}>
          <ProForm form={form} submitter={false} layout="vertical" readonly={isReadonly}>
            <ProFormText
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入名称' }]}
            />
            <ProFormText
              name="slug"
              label="Slug"
              extra="留空将根据名称自动生成"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || !String(value).trim()) {
                      return Promise.resolve();
                    }
                    if (!SLUG_PATTERN.test(String(value).trim())) {
                      return Promise.reject(new Error('仅允许小写字母、数字和连字符'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            />
            <ProFormText
              name="baseUrl"
              label="Base URL"
              rules={[{ required: true, message: '请输入 Base URL' }]}
            />
            <ProFormText.Password
              name="apiKey"
              label="API Key"
              rules={drawerMode === 'create' ? [{ required: true, message: '请输入 API Key' }] : []}
              fieldProps={{ visibilityToggle: !isReadonly }}
              extra={drawerMode === 'edit' ? '留空表示不修改' : undefined}
            />
            <ProFormSelect
              name="adapterType"
              label="适配器类型"
              options={ADAPTER_TYPE_OPTIONS}
              rules={[{ required: true, message: '请选择适配器类型' }]}
            />
            {drawerMode !== 'create' && (
              <ProFormSwitch name="isActive" label="启用" />
            )}
          </ProForm>
        </Spin>
      </Drawer>
    </PageContainer>
  );
};

export default ProvidersPage;
