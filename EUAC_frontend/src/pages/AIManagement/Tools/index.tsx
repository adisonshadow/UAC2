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
  deleteAdminToolsId,
  getAdminTools,
  getAdminToolsId,
  patchAdminToolsId,
  postAdminTools,
} from '@/services/UAC/api/adminTools';
import { getAdminScopes } from '@/services/UAC/api/adminScopes';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { EXECUTION_TYPE_OPTIONS, SLUG_PATTERN } from '../constants';
import { toolTableColumns } from './schema';

type DrawerMode = 'create' | 'view' | 'edit';

const ToolsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [currentId, setCurrentId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scopeOptions, setScopeOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    getAdminScopes({ page: 1, size: 100, isActive: true }).then((response) => {
      if (isApiSuccess(response)) {
        const data = getApiData<{ items: Record<string, any>[] }>(response);
        setScopeOptions((data?.items || []).map((item) => ({ label: `${item.name} (${item.slug})`, value: item.id })));
      }
    });
  }, []);

  const openCreate = () => {
    setDrawerMode('create');
    setCurrentId(undefined);
    form.resetFields();
    form.setFieldsValue({
      executionType: 'client',
      parametersSchemaText: '{\n  "type": "object",\n  "properties": {}\n}',
      isActive: true,
    });
    setDrawerOpen(true);
  };

  const openDetail = async (id: string, editable: boolean) => {
    try {
      setLoading(true);
      const response = await getAdminToolsId({ id });
      if (!isApiSuccess(response)) {
        messageApi.error('获取 Tool 详情失败');
        return;
      }
      const data = getApiData<Record<string, any>>(response);
      if (data) {
        setDrawerMode(editable ? 'edit' : 'view');
        setCurrentId(id);
        form.setFieldsValue({
          ...data,
          scopeId: data.scopeId,
          parametersSchemaText: JSON.stringify(data.parametersSchema || {}, null, 2),
          serverConfigText: data.serverConfig ? JSON.stringify(data.serverConfig, null, 2) : '',
        });
        setDrawerOpen(true);
      }
    } catch {
      messageApi.error('获取 Tool 详情失败');
    } finally {
      setLoading(false);
    }
  };

  const parseJsonField = (text: string | undefined, fieldName: string) => {
    if (!text?.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${fieldName} 不是合法 JSON`);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const parametersSchema = parseJsonField(values.parametersSchemaText, 'Parameters Schema');
      const serverConfig = parseJsonField(values.serverConfigText, 'Server Config');
      setSaving(true);

      const payload = {
        scopeId: values.scopeId,
        name: values.name,
        slug: values.slug?.trim() || undefined,
        functionName: values.functionName,
        description: values.description,
        executionType: values.executionType,
        parametersSchema,
        reviewMarkdown: values.reviewMarkdown,
        serverConfig,
        isActive: values.isActive,
      };

      if (drawerMode === 'create') {
        const response = await postAdminTools(payload);
        if (!isApiSuccess(response)) {
          messageApi.error('创建 Tool 失败');
          return;
        }
        messageApi.success('创建成功');
      } else if (currentId) {
        const response = await patchAdminToolsId({ id: currentId }, payload);
        if (!isApiSuccess(response)) {
          messageApi.error('更新 Tool 失败');
          return;
        }
        messageApi.success('更新成功');
      }
      setDrawerOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认停用该 Tool？',
      onOk: async () => {
        const response = await deleteAdminToolsId({ id });
        if (!isApiSuccess(response)) {
          messageApi.error('停用失败');
          return;
        }
        messageApi.success('已停用');
        actionRef.current?.reload();
      },
    });
  };

  const readOnly = drawerMode === 'view';

  return (
    <PageContainer pageHeaderRender={() => {return <></> }}>
      {contextHolder}
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        columns={[
          ...toolTableColumns,
          {
            title: '操作',
            valueType: 'option',
            width: 180,
            render: (_, record) => (
              <Space>
                <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record.id, false)} />
                <Button type="link" icon={<EditOutlined />} onClick={() => openDetail(record.id, true)} />
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
              </Space>
            ),
          },
        ]}
        request={async (params) => {
          const response = await getAdminTools({ page: params.current, size: params.pageSize });
          return parseApiListResponse(response);
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建 Tool
          </Button>,
        ]}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer
        title={drawerMode === 'create' ? '新建 Tool' : drawerMode === 'edit' ? '编辑 Tool' : 'Tool 详情'}
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          readOnly ? null : (
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button type="primary" loading={saving} onClick={handleSubmit}>
                保存
              </Button>
            </Space>
          )
        }
      >
        <Spin spinning={loading}>
          <ProForm form={form} submitter={false} readonly={readOnly} layout="vertical">
            <ProFormSelect name="scopeId" label="Scope" options={scopeOptions} rules={[{ required: true }]} />
            <ProFormText name="name" label="名称" rules={[{ required: true }]} />
            <ProFormText name="functionName" label="Function Name" rules={[{ required: true }]} />
            <ProFormText name="slug" label="Slug" rules={[{ pattern: SLUG_PATTERN, message: 'slug 格式无效' }]} />
            <ProFormSelect name="executionType" label="执行类型" options={EXECUTION_TYPE_OPTIONS} rules={[{ required: true }]} />
            <ProFormTextArea name="description" label="描述" />
            <ProFormTextArea name="parametersSchemaText" label="Parameters Schema (JSON)" fieldProps={{ rows: 6, style: { fontFamily: 'monospace' } }} />
            <ProFormTextArea name="reviewMarkdown" label="Review Markdown" fieldProps={{ rows: 4 }} />
            <ProFormTextArea name="serverConfigText" label="Server Config (JSON)" fieldProps={{ rows: 4, style: { fontFamily: 'monospace' } }} />
            {drawerMode !== 'create' && <ProFormSwitch name="isActive" label="启用" />}
          </ProForm>
        </Spin>
      </Drawer>
    </PageContainer>
  );
};

export default ToolsPage;
