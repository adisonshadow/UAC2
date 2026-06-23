import { Button, Form, Input, InputNumber, Modal, Segmented, Select, Space, Switch, Alert } from 'antd';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { sendMockUserMessage } from '@euac/ai-base';
import FieldList from '../FieldList';
import IndexManager, { type IndexManagerRef } from '../IndexManager';
import RelationManager, { type RelationManagerRef } from '../RelationManager';

export interface FieldsManagerRef {
  openCreate: () => void;
  openAutoCreate: () => void;
}

interface FieldsManagerProps {
  entity: API.BusinessDataEntity;
  entities: API.BusinessDataEntity[];
  relations: API.BusinessDataRelation[];
  onSaveFields: (fields: API.BusinessDataField[]) => Promise<void>;
  onRefresh: () => void;
  saving?: boolean;
}

type SegmentKey = 'fields' | 'indexes' | 'relations';

const INDEX_AUTO_PROMPT = (entity: API.BusinessDataEntity) =>
  `请帮我为实体「${entity.label}」(${entity.code}) 自动创建和补齐索引。

请分析当前实体的字段结构，自动为以下情况创建合适的索引：
1. 主键字段（如果存在）
2. 外键字段（如果存在）
3. 唯一字段（如果存在）
4. 经常用于查询的字段（如姓名、邮箱、手机号等）
5. 时间字段（如创建时间、更新时间等）
6. 状态字段（如状态、类型等）

请根据字段特点创建合适的索引类型（普通索引、唯一索引、复合索引），使用 bizdata_update_entity 写入 layout.indexes。`;

const RELATION_AUTO_PROMPT = (entity: API.BusinessDataEntity) =>
  `请帮我为实体「${entity.label}」(${entity.code}) 自动创建和补齐关系。

请分析当前实体的字段结构和业务逻辑，自动创建合适的关系（一对一、一对多、多对多），使用 bizdata_add_relation 等工具完成，并分析项目中其他实体建立合理的关系网络。`;

const FieldsManager = forwardRef<FieldsManagerRef, FieldsManagerProps>(
  ({ entity, entities, relations, onSaveFields, onRefresh, saving }, ref) => {
    const [segment, setSegment] = useState<SegmentKey>('fields');
    const [modalOpen, setModalOpen] = useState(false);
    const [isCreate, setIsCreate] = useState(true);
    const [editing, setEditing] = useState<API.BusinessDataField | null>(null);
    const [form] = Form.useForm();
    const indexRef = useRef<IndexManagerRef>(null);
    const relationRef = useRef<RelationManagerRef>(null);
    const sendAIChat = sendMockUserMessage;

    const disabled = !!entity.isLocked;
    const fields = entity.fields || [];
    const fieldKeys = fields.map((f) => f.fieldKey!).filter(Boolean);

    const openFieldModal = (field?: API.BusinessDataField) => {
      if (disabled) return;
      setIsCreate(!field);
      setEditing(
        field || {
          fieldKey: '',
          columnInfo: { label: '' },
          typeormConfig: { type: 'varchar', nullable: true },
        },
      );
      form.setFieldsValue({
        fieldKey: field?.fieldKey,
        label: field?.columnInfo?.label,
        type: field?.typeormConfig?.type || 'varchar',
        length: field?.typeormConfig?.length,
        nullable: field?.typeormConfig?.nullable !== false,
        unique: !!field?.typeormConfig?.unique,
        primary: !!field?.typeormConfig?.primary,
      });
      setModalOpen(true);
    };

    useImperativeHandle(ref, () => ({
      openCreate: () => {
        if (segment === 'fields') openFieldModal();
        else if (segment === 'indexes') indexRef.current?.openCreate();
        else relationRef.current?.openCreate();
      },
      openAutoCreate: () => {
        if (segment === 'indexes') indexRef.current?.autoCreate();
        else if (segment === 'relations') {
          sendAIChat(RELATION_AUTO_PROMPT(entity));
        }
      },
    }));

    const persistFields = async (nextFields: API.BusinessDataField[]) => {
      await onSaveFields(nextFields.map((f, index) => ({ ...f, sortOrder: index })));
    };

    const handleFieldOk = async () => {
      const values = await form.validateFields();
      const newField: API.BusinessDataField = {
        ...editing,
        fieldKey: values.fieldKey,
        columnInfo: { ...(editing?.columnInfo || {}), label: values.label },
        typeormConfig: {
          type: values.type,
          length: values.length,
          nullable: values.nullable,
          unique: values.unique,
          primary: values.primary,
        },
      };
      const idx = fields.findIndex((f) => f.fieldKey === newField.fieldKey);
      const next =
        idx >= 0 ? fields.map((f, i) => (i === idx ? newField : f)) : [...fields, newField];
      setModalOpen(false);
      await persistFields(next);
    };

    const toolbar = (
      <Space size="small">
        {segment === 'fields' && (
          <Button size="small" type="primary" disabled={disabled} onClick={() => openFieldModal()}>
            添加字段
          </Button>
        )}
        {segment === 'indexes' && (
          <>
            <Button size="small" disabled={disabled} onClick={() => indexRef.current?.autoCreate()}>
              自动创建
            </Button>
            <Button size="small" type="primary" disabled={disabled} onClick={() => indexRef.current?.openCreate()}>
              添加索引
            </Button>
          </>
        )}
        {segment === 'relations' && (
          <>
            <Button
              size="small"
              disabled={disabled}
              onClick={() => sendAIChat(RELATION_AUTO_PROMPT(entity))}
            >
              自动生成
            </Button>
            <Button size="small" type="primary" disabled={disabled} onClick={() => relationRef.current?.openCreate()}>
              添加关系
            </Button>
          </>
        )}
      </Space>
    );

    return (
      <div>
        {disabled && (
          <Alert
            type="warning"
            showIcon
            message="实体已锁定，无法编辑字段、索引和关系"
            style={{ marginBottom: 12 }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Segmented
            size="small"
            value={segment}
            onChange={(v) => setSegment(v as SegmentKey)}
            options={[
              { label: '字段', value: 'fields' },
              { label: '索引', value: 'indexes' },
              { label: '关系', value: 'relations' },
            ]}
          />
          {toolbar}
        </div>

        {segment === 'fields' && (
          <FieldList
            fields={fields}
            disabled={disabled}
            onEdit={openFieldModal}
            onDelete={async (field) => {
              await persistFields(fields.filter((f) => f.fieldKey !== field.fieldKey));
            }}
            onAddToChat={(field) =>
              sendAIChat(
                `我要设计实体「${entity.label}」(${entity.code}) 的字段「${field.columnInfo?.label || field.fieldKey}」(${field.fieldKey})，请先调用 bizdata_get_entity 查看现状并给出建议。`,
              )
            }
            onSortChange={persistFields}
          />
        )}

        {segment === 'indexes' && (
          <IndexManager
            ref={indexRef}
            entity={entity}
            fieldKeys={fieldKeys}
            disabled={disabled}
            onSaved={onRefresh}
            onAutoCreate={() => sendAIChat(INDEX_AUTO_PROMPT(entity))}
          />
        )}

        {segment === 'relations' && (
          <RelationManager
            ref={relationRef}
            entity={entity}
            entities={entities}
            relations={relations}
            onRefresh={onRefresh}
          />
        )}

        <Modal
          title={isCreate ? '添加字段' : '编辑字段'}
          open={modalOpen}
          confirmLoading={saving}
          onOk={handleFieldOk}
          onCancel={() => setModalOpen(false)}
          destroyOnClose
        >
          <Form form={form} layout="vertical">
            <Form.Item name="fieldKey" label="字段名" rules={[{ required: true }]}>
              <Input disabled={!isCreate} />
            </Form.Item>
            <Form.Item name="label" label="显示名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="type" label="TypeORM 类型" rules={[{ required: true }]}>
              <Select
                options={[
                  'varchar', 'int', 'bigint', 'boolean', 'text', 'jsonb', 'timestamptz', 'uuid', 'decimal',
                ].map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
            <Form.Item name="length" label="长度">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="nullable" label="可空" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="unique" label="唯一" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="primary" label="主键" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  },
);

FieldsManager.displayName = 'FieldsManager';

export default FieldsManager;
