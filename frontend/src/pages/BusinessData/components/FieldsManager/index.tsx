import { Button, Segmented, Space, Alert, message } from 'antd';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { sendMockUserMessage } from '@EADAF/ai-base';
import FieldList from '../FieldList';
import FieldEditModal from './FieldEditModal';
import IndexManager, { type IndexManagerRef } from '../IndexManager';
import RelationManager, { type RelationManagerRef } from '../RelationManager';
import { buildEntityValidatePrompt } from '../../utils/entityValidation';

export interface FieldsManagerRef {
  openCreate: () => void;
  openAutoCreate: () => void;
}

interface FieldsManagerProps {
  entity: API.BusinessDataEntity;
  entities: API.BusinessDataEntity[];
  relations: API.BusinessDataRelation[];
  enums: API.BusinessDataEnum[];
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

请根据字段特点创建合适的索引类型（普通索引、唯一索引、复合索引），使用 bizdata_upsert_entity_indexes 写入索引。`;

const RELATION_AUTO_PROMPT = (entity: API.BusinessDataEntity) =>
  `请帮我为实体「${entity.label}」(${entity.code}) 自动创建和补齐关系。

请分析当前实体的字段结构和业务逻辑，自动创建合适的关系（一对一、一对多、多对多），使用 bizdata_add_relation 等工具完成，并分析项目中其他实体建立合理的关系网络。`;

const FieldsManager = forwardRef<FieldsManagerRef, FieldsManagerProps>(
  ({ entity, entities, relations, enums, onSaveFields, onRefresh, saving }, ref) => {
    const [segment, setSegment] = useState<SegmentKey>('fields');
    const [modalOpen, setModalOpen] = useState(false);
    const [isCreate, setIsCreate] = useState(true);
    const [editing, setEditing] = useState<API.BusinessDataField | null>(null);
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

    const handleFieldOk = async (newField: API.BusinessDataField) => {
      const oldKey = editing?.fieldKey;
      const newKey = newField.fieldKey;
      let next: API.BusinessDataField[];

      if (!isCreate && oldKey && newKey && oldKey !== newKey) {
        const oldIdx = fields.findIndex((f) => f.fieldKey === oldKey);
        if (oldIdx < 0) {
          next = [...fields, newField];
        } else if (fields.some((f) => f.fieldKey === newKey && f.fieldKey !== oldKey)) {
          message.error('字段名已存在');
          return;
        } else {
          next = fields.map((f, i) => (i === oldIdx ? newField : f));
        }
      } else {
        const idx = fields.findIndex((f) => f.fieldKey === newKey);
        next = idx >= 0 ? fields.map((f, i) => (i === idx ? newField : f)) : [...fields, newField];
      }

      setModalOpen(false);
      await persistFields(next);
    };

    const toolbar = (
      <Space size="small">
        {segment === 'fields' && (
          <>
            <Button
              size="small"
              disabled={disabled}
              onClick={() => sendAIChat(buildEntityValidatePrompt(entity))}
            >
              AI校验
            </Button>
            <Button size="small" color="primary" variant="outlined" disabled={disabled} onClick={() => openFieldModal()}>
              添加字段
            </Button>
          </>
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
            title="实体已锁定，无法编辑字段、索引和关系"
            style={{ marginBottom: 12 }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
          <Segmented
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
            entity={entity}
            fields={fields}
            disabled={disabled}
            onEdit={openFieldModal}
            onDelete={async (field) => {
              await persistFields(fields.filter((f) => f.fieldKey !== field.fieldKey));
            }}
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

        <FieldEditModal
          open={modalOpen}
          isCreate={isCreate}
          field={editing}
          entityId={entity.id}
          entityCode={entity.code}
          enums={enums}
          saving={saving}
          onOk={handleFieldOk}
          onCancel={() => setModalOpen(false)}
        />
      </div>
    );
  },
);

FieldsManager.displayName = 'FieldsManager';

export default FieldsManager;
