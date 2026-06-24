import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Splitter,
  Tag,
  Typography,
  message,
} from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { useChatReference } from '@euac/ai-base';
import React, { useCallback, useEffect, useState } from 'react';
import ChatReferenceTarget from '@/components/ChatReferenceTarget';
import { buildEntityReference } from '../ai/chatReferenceUtils';
import ScopeEntityTree from '../components/ScopeEntityTree';
import FieldsManager from '../components/FieldsManager';
import JsonSchemaEditor from '../components/JsonSchemaEditor';
import EnumManager from '../components/EnumManager';
import {
  deleteBusinessDataEntity,
  getBusinessDataSchema,
  patchBusinessDataEntity,
  postBusinessDataEntity,
  putBusinessDataEntityFields,
} from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

const ModelDesigner: React.FC = () => {
  const [schema, setSchema] = useState<API.BusinessDataSchema>({ entities: [], enums: [], relations: [] });
  const [selected, setSelected] = useState<API.BusinessDataEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [enumModalOpen, setEnumModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<API.BusinessDataEntity | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { addReference } = useChatReference();

  const loadSchema = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBusinessDataSchema();
      const data = getApiData<API.BusinessDataSchema>(res);
      if (!isApiSuccess(res) || !data) {
        message.error(getApiErrorMessage(res, '加载业务数据模型失败'));
        return null;
      }
      setSchema(data);
      if (selected?.id) {
        const updated = data.entities?.find((e) => e.id === selected.id);
        setSelected(updated || null);
      }
      return data;
    } catch (error) {
      message.error(getApiErrorMessage(error, '加载业务数据模型失败'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [selected?.id]);

  useEffect(() => {
    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectEntity = (entity: API.BusinessDataEntity) => {
    setSelected(entity);
  };

  const handleCreateEntity = async () => {
    const values = await createForm.validateFields();
    const res = await postBusinessDataEntity({
      code: values.code,
      label: values.label,
      entityKind: values.entityKind,
      tableName: values.tableName,
    });
    if (isApiSuccess(res)) {
      message.success('实体已创建');
      setCreateOpen(false);
      createForm.resetFields();
      const data = await loadSchema();
      const entity = getApiData<API.BusinessDataEntity>(res);
      const created = entity || data?.entities?.find((e) => e.code === values.code);
      if (created) setSelected(created);
    } else {
      message.error(getApiErrorMessage(res, '创建失败'));
    }
  };

  const handleEditEntity = async () => {
    if (!editingEntity?.id) return;
    const values = await editForm.validateFields();
    const res = await patchBusinessDataEntity(editingEntity.id, {
      label: values.label,
      tableName: values.tableName,
      status: values.status,
    });
    if (isApiSuccess(res)) {
      message.success('实体已更新');
      setEditOpen(false);
      await loadSchema();
    } else {
      message.error(getApiErrorMessage(res, '更新失败'));
    }
  };

  const handleToggleLock = async (entity: API.BusinessDataEntity) => {
    if (!entity.id) return;
    const res = await patchBusinessDataEntity(entity.id, { isLocked: !entity.isLocked });
    if (isApiSuccess(res)) {
      message.success(entity.isLocked ? '已解锁' : '已锁定');
      await loadSchema();
    } else {
      message.error(getApiErrorMessage(res, '操作失败'));
    }
  };

  const handleDeleteEntity = async (entity: API.BusinessDataEntity) => {
    if (!entity.id) return;
    const res = await deleteBusinessDataEntity(entity.id);
    if (isApiSuccess(res)) {
      message.success('实体已删除');
      if (selected?.id === entity.id) setSelected(null);
      await loadSchema();
    } else {
      message.error(getApiErrorMessage(res, '删除失败'));
    }
  };

  const handleSaveFields = async (fields: API.BusinessDataField[]) => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const res = await putBusinessDataEntityFields(selected.id, fields);
      if (isApiSuccess(res)) {
        message.success('字段已保存');
        await loadSchema();
      } else {
        message.error(getApiErrorMessage(res, '保存字段失败'));
      }
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (entity: API.BusinessDataEntity) => {
    setEditingEntity(entity);
    editForm.setFieldsValue({
      label: entity.label,
      tableName: entity.tableName,
      status: entity.status || 'enabled',
    });
    setEditOpen(true);
  };

  const renderDetail = () => {
    if (!selected) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="请在左侧选择实体进行设计" />
        </div>
      );
    }

    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '0 4px' }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Space wrap align="center">
              <Typography.Text strong>{selected.label}</Typography.Text>
              <ChatReferenceTarget
                onClick={() => addReference(buildEntityReference(selected))}
              />
              <Typography.Text type="secondary">{selected.code}</Typography.Text>
              {selected.isLocked && <Tag color="gold">已锁定</Tag>}
              <Tag color="blue">v{selected.version}</Tag>
              <Tag>{selected.entityKind === 'json_schema' ? 'JSON 结构' : 'ER 表'}</Tag>
              {selected.tableName && <Tag>{selected.tableName}</Tag>}
            </Space>
          </div>

          {selected.entityKind === 'json_schema' ? (
            <JsonSchemaEditor entity={selected} onSaved={loadSchema} />
          ) : (
            <FieldsManager
              entity={selected}
              entities={schema.entities || []}
              relations={schema.relations || []}
              onSaveFields={handleSaveFields}
              onRefresh={loadSchema}
              saving={saving}
            />
          )}
        </Space>
      </div>
    );
  };

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      <Splitter style={{ height: 'calc(100vh - 64px)', minHeight: 480 }}>
        <Splitter.Panel defaultSize="38%" min="260px" max="50%">
          <div
            style={{
              height: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              paddingRight: 8,
            }}
          >
            <Space wrap size="small" style={{ marginBottom: 8, flexShrink: 0 }}>
              <Button type="primary" size="small" onClick={() => setCreateOpen(true)}>
                新建实体
              </Button>
              <Button size="small" onClick={() => setEnumModalOpen(true)}>
                枚举管理
              </Button>
              <Button size="small" loading={loading} onClick={() => loadSchema()}>
                刷新
              </Button>
            </Space>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <ScopeEntityTree
                entities={schema.entities || []}
                selectedEntityId={selected?.id}
                showHeader={false}
                onSelectEntity={handleSelectEntity}
                onToggleLock={handleToggleLock}
                onEditEntity={openEditModal}
                onDeleteEntity={handleDeleteEntity}
              />
            </div>
          </div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div style={{ height: 'calc(100vh - 64px)', overflow: 'auto' }}>{renderDetail()}</div>
        </Splitter.Panel>
      </Splitter>

      <Modal title="新建实体" open={createOpen} onOk={handleCreateEntity} onCancel={() => setCreateOpen(false)}>
        <Form form={createForm} layout="vertical" initialValues={{ entityKind: 'er_table' }}>
          <Form.Item name="code" label="Code (Scope:Entity)" rules={[{ required: true }]}>
            <Input placeholder="sales:order:Order" />
          </Form.Item>
          <Form.Item name="label" label="显示名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="entityKind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'ER 表', value: 'er_table' },
                { label: 'JSON 结构', value: 'json_schema' },
              ]}
            />
          </Form.Item>
          <Form.Item name="tableName" label="表名（ER 可选）">
            <Input placeholder="orders" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑实体" open={editOpen} onOk={handleEditEntity} onCancel={() => setEditOpen(false)}>
        <Form form={editForm} layout="vertical">
          <Form.Item label="Code">
            <Input value={editingEntity?.code} disabled />
          </Form.Item>
          <Form.Item name="label" label="显示名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tableName" label="表名">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { label: '启用', value: 'enabled' },
                { label: '禁用', value: 'disabled' },
                { label: '归档', value: 'archived' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <EnumManager
        enums={schema.enums || []}
        open={enumModalOpen}
        onClose={() => setEnumModalOpen(false)}
        onRefresh={loadSchema}
      />
    </PageContainer>
  );
};

export default ModelDesigner;
