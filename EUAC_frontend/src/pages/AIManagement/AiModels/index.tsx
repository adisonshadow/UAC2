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
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Drawer, Form, Modal, Space, Spin, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  deleteAdminModelsId,
  getAdminModels,
  getAdminModelsId,
  patchAdminModelsId,
  postAdminModels,
} from '@/services/UAC/api/adminModels';
import { getAdminProviders } from '@/services/UAC/api/adminProviders';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import {
  AI_CAPABILITIES,
  AI_MODALITIES,
  SLUG_PATTERN,
} from '../constants';
import { modelTableColumns } from './schema';

type DrawerMode = 'create' | 'view' | 'edit';

const ModelsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [currentId, setCurrentId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [providerOptions, setProviderOptions] = useState<{ label: string; value: string }[]>([]);

  const loadProviders = async () => {
    const response = await getAdminProviders({ page: 1, size: 100, isActive: true });
    const { items } = parseApiListResponse<API.AdminProvider>(response);
    setProviderOptions(
      items.map((item) => ({
        label: `${item.name} (${item.slug})`,
        value: item.id || '',
      })),
    );
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const parseDefaultParams = (value?: string) => {
    if (!value || !value.trim()) {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('defaultParams 必须是合法 JSON');
    }
  };

  const stringifyDefaultParams = (value?: Record<string, unknown>) => {
    if (!value || Object.keys(value).length === 0) {
      return '';
    }
    return JSON.stringify(value, null, 2);
  };

  const openCreate = async () => {
    await loadProviders();
    setDrawerMode('create');
    setCurrentId(undefined);
    form.resetFields();
    form.setFieldsValue({ isActive: true, inputTags: ['text'], outputTags: ['text'] });
    setDrawerOpen(true);
  };

  const openDetail = async (id: string, editable: boolean) => {
    try {
      setLoading(true);
      await loadProviders();
      const response = await getAdminModelsId({ id });
      if (!isApiSuccess(response)) {
        messageApi.error('获取模型详情失败');
        return;
      }
      const data = getApiData<API.AdminAiModel>(response);
      setDrawerMode(editable ? 'edit' : 'view');
      setCurrentId(id);
      form.setFieldsValue({
        ...data,
        defaultParams: stringifyDefaultParams(data?.defaultParams),
      });
      setDrawerOpen(true);
    } catch {
      messageApi.error('获取模型详情失败');
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = (values: Record<string, any>) => {
    const defaultParams = parseDefaultParams(values.defaultParams);
    return {
      providerId: values.providerId,
      slug: values.slug?.trim() || undefined,
      modelId: values.modelId,
      displayName: values.displayName,
      defaultParams,
      capabilities: values.capabilities,
      inputTags: values.inputTags,
      outputTags: values.outputTags,
      isActive: values.isActive,
    };
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (drawerMode === 'create') {
        const payload = buildPayload(values);
        const response = await postAdminModels(payload);
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
        const payload = buildPayload(values);
        const response = await patchAdminModelsId({ id: currentId }, payload);
        if (isApiSuccess(response)) {
          messageApi.success('更新成功');
          setDrawerOpen(false);
          actionRef.current?.reload();
        } else {
          messageApi.error(response.message || '更新失败');
        }
      }
    } catch (error: any) {
      if (error?.message === 'defaultParams 必须是合法 JSON') {
        messageApi.error(error.message);
        return;
      }
      if (!error?.errorFields) {
        messageApi.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record: API.AdminAiModel) => {
    Modal.confirm({
      title: '确认停用',
      content: `确定要停用模型「${record.displayName}」吗？`,
      onOk: async () => {
        const response = await deleteAdminModelsId({ id: record.id || '' });
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
    <PageContainer pageHeaderRender={() => {return <></> }}>
      {contextHolder}
      <ProTable<API.AdminAiModel>
        actionRef={actionRef}
        rowKey="id"
        columns={[
          ...modelTableColumns,
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
          const response = await getAdminModels({
            page: params.current,
            size: params.pageSize,
          });
          const { items, total, success } = parseApiListResponse<API.AdminAiModel>(response);
          return { data: items, total, success };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建模型
          </Button>,
        ]}
        pagination={{ pageSize: 10 }}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer
        title={
          drawerMode === 'create'
            ? '新建 AI 模型'
            : drawerMode === 'edit'
              ? '编辑 AI 模型'
              : 'AI 模型详情'
        }
        width={640}
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
            <ProFormSelect
              name="providerId"
              label="服务商"
              options={providerOptions}
              rules={[{ required: true, message: '请选择服务商' }]}
              showSearch
            />
            <ProFormText
              name="slug"
              label="Slug"
              extra="留空将根据显示名称自动生成"
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
              name="modelId"
              label="上游模型 ID"
              rules={[{ required: true, message: '请输入上游模型 ID' }]}
            />
            <ProFormText
              name="displayName"
              label="显示名称"
              rules={[{ required: true, message: '请输入显示名称' }]}
            />
            <ProFormTextArea
              name="defaultParams"
              label="默认参数 (JSON)"
              fieldProps={{ rows: 4, placeholder: '{"temperature": 0.7, "max_tokens": 4096}' }}
            />
            <ProFormSelect
              name="capabilities"
              label="能力标签"
              mode="multiple"
              options={AI_CAPABILITIES}
              rules={[{ required: true, message: '请选择能力标签' }]}
            />
            <ProFormSelect
              name="inputTags"
              label="输入模态"
              mode="multiple"
              options={AI_MODALITIES}
            />
            <ProFormSelect
              name="outputTags"
              label="输出模态"
              mode="multiple"
              options={AI_MODALITIES}
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

export default ModelsPage;
