import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';
import '@ant-design/x-markdown/themes/light.css';
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
  deleteAdminSkillsId,
  getAdminSkills,
  getAdminSkillsId,
  patchAdminSkillsId,
  postAdminSkills,
} from '@/services/UAC/api/adminSkills';
import { getAdminTools } from '@/services/UAC/api/adminTools';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { SLUG_PATTERN } from '../constants';
import { skillTableColumns } from './schema';

type DrawerMode = 'create' | 'view' | 'edit';

const SkillsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [currentId, setCurrentId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: string }[]>([]);
  const [previewMarkdown, setPreviewMarkdown] = useState('');

  useEffect(() => {
    getAdminTools({ page: 1, size: 200, isActive: true }).then((response) => {
      if (isApiSuccess(response)) {
        const data = getApiData<{ items: Record<string, any>[] }>(response);
        setToolOptions(
          (data?.items || []).map((item) => ({
            label: `${item.name} (${item.functionName})`,
            value: item.id,
          })),
        );
      }
    });
  }, []);

  const openCreate = () => {
    setDrawerMode('create');
    setCurrentId(undefined);
    form.resetFields();
    form.setFieldsValue({ isActive: true, contentMarkdown: '# 新 Skill\n\n在此编写 Skill 指令...' });
    setPreviewMarkdown('# 新 Skill\n\n在此编写 Skill 指令...');
    setDrawerOpen(true);
  };

  const openDetail = async (id: string, editable: boolean) => {
    try {
      setLoading(true);
      const response = await getAdminSkillsId({ id });
      if (!isApiSuccess(response)) {
        messageApi.error('获取 Skill 详情失败');
        return;
      }
      const data = getApiData<Record<string, any>>(response);
      if (!data) {
        messageApi.error('获取 Skill 详情失败');
        return;
      }
      setDrawerMode(editable ? 'edit' : 'view');
      setCurrentId(id);
      form.setFieldsValue({
        ...data,
        toolIds: (data.tools || []).map((t: any) => t.id),
      });
      setPreviewMarkdown(data.contentMarkdown || '');
      setDrawerOpen(true);
    } catch {
      messageApi.error('获取 Skill 详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        slug: values.slug?.trim() || undefined,
        description: values.description,
        contentMarkdown: values.contentMarkdown,
        toolIds: values.toolIds || [],
        isActive: values.isActive,
      };

      if (drawerMode === 'create') {
        const response = await postAdminSkills(payload);
        if (!isApiSuccess(response)) {
          messageApi.error('创建 Skill 失败');
          return;
        }
        messageApi.success('创建成功');
      } else if (currentId) {
        const response = await patchAdminSkillsId({ id: currentId }, payload);
        if (!isApiSuccess(response)) {
          messageApi.error('更新 Skill 失败');
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
      title: '确认停用该 Skill？',
      onOk: async () => {
        const response = await deleteAdminSkillsId({ id });
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
          ...skillTableColumns,
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
          const response = await getAdminSkills({ page: params.current, size: params.pageSize });
          return parseApiListResponse(response);
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建 Skill
          </Button>,
        ]}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer
        title={drawerMode === 'create' ? '新建 Skill' : drawerMode === 'edit' ? '编辑 Skill' : 'Skill 详情'}
        width={800}
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
            <ProFormText name="name" label="名称" rules={[{ required: true }]} />
            <ProFormText name="slug" label="Slug" rules={[{ pattern: SLUG_PATTERN, message: 'slug 格式无效' }]} />
            <ProFormTextArea name="description" label="描述" />
            <ProFormSelect
              name="toolIds"
              label="关联 Tool"
              mode="multiple"
              options={toolOptions}
            />
            {drawerMode !== 'create' && <ProFormSwitch name="isActive" label="启用" />}
          </ProForm>

            <ProFormTextArea
              name="contentMarkdown"
              label="Skill 内容 (Markdown)"
              fieldProps={{
                rows: 12,
                style: { fontFamily: 'monospace' },
                onChange: (e) => setPreviewMarkdown(e.target.value),
              }}
            />
            <div style={{ marginTop: 8 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>预览</div>
              <div className="x-markdown-light" style={{ minHeight: 200, padding: 12, border: '1px solid #f0f0f0' }}>
                <XMarkdown content={previewMarkdown || form.getFieldValue('contentMarkdown') || ''} />
              </div>
            </div>
        </Spin>
      </Drawer>
    </PageContainer>
  );
};

export default SkillsPage;
