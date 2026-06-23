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
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Drawer, Form, Modal, Space, Spin, message } from 'antd';
import React, { useRef, useState } from 'react';
import {
  deleteAdminScopesId,
  getAdminScopes,
  getAdminScopesId,
  patchAdminScopesId,
  postAdminScopes,
} from '@/services/UAC/api/adminScopes';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { SLUG_PATTERN } from '../constants';
import { scopeTableColumns } from './schema';

type DrawerMode = 'create' | 'view' | 'edit';

const ScopesPage: React.FC = () => {
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
    form.setFieldsValue({ isActive: true });
    setDrawerOpen(true);
  };

  const openDetail = async (id: string, editable: boolean) => {
    try {
      setLoading(true);
      const response = await getAdminScopesId({ id });
      if (!isApiSuccess(response)) {
        messageApi.error('获取 Scope 详情失败');
        return;
      }
      const data = getApiData<Record<string, any>>(response);
      setDrawerMode(editable ? 'edit' : 'view');
      setCurrentId(id);
      form.setFieldsValue(data);
      setDrawerOpen(true);
    } catch {
      messageApi.error('获取 Scope 详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (drawerMode === 'create') {
        const response = await postAdminScopes({
          name: values.name,
          slug: values.slug?.trim() || undefined,
          description: values.description,
        });
        if (!isApiSuccess(response)) {
          messageApi.error('创建 Scope 失败');
          return;
        }
        messageApi.success('创建成功');
      } else if (currentId) {
        const response = await patchAdminScopesId({ id: currentId }, values);
        if (!isApiSuccess(response)) {
          messageApi.error('更新 Scope 失败');
          return;
        }
        messageApi.success('更新成功');
      }
      setDrawerOpen(false);
      actionRef.current?.reload();
    } catch {
      // validation
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认停用该 Scope？',
      onOk: async () => {
        const response = await deleteAdminScopesId({ id });
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
          ...scopeTableColumns,
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
          const response = await getAdminScopes({
            page: params.current,
            size: params.pageSize,
          });
          return parseApiListResponse(response);
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建 Scope
          </Button>,
        ]}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer
        title={drawerMode === 'create' ? '新建 Scope' : drawerMode === 'edit' ? '编辑 Scope' : 'Scope 详情'}
        width={520}
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
            <ProFormText name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]} />
            <ProFormText
              name="slug"
              label="Slug"
              rules={[{ pattern: SLUG_PATTERN, message: 'slug 格式无效' }]}
            />
            <ProFormTextArea name="description" label="描述" />
            {drawerMode !== 'create' && <ProFormSwitch name="isActive" label="启用" />}
          </ProForm>
        </Spin>
      </Drawer>
    </PageContainer>
  );
};

export default ScopesPage;
