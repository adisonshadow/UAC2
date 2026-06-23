import {
  deleteBusinessDataEntity,
  getBusinessDataEntity,
  getBusinessDataEntities,
  getBusinessDataSchema,
  patchBusinessDataEntity,
  postBusinessDataEntity,
  postBusinessDataEnum,
  postBusinessDataRelation,
  putBusinessDataEntityFields,
} from '@/services/UAC/api/businessData';
import { registerFunctionCall, unregisterFunctionCall } from '@euac/ai-base';
import { getApiData, parseApiListResponse } from '@/utils/apiResponse';
import {
  loadEntityFields,
  mergeEntityFields,
  normalizeBizDataField,
  resolveBizDataEntityId,
} from './bizdataFieldUtils';

const TOOL_NAMES = [
  'bizdata_list_entities',
  'bizdata_get_entity',
  'bizdata_create_entity',
  'bizdata_update_entity',
  'bizdata_delete_entity',
  'bizdata_create_enum',
  'bizdata_add_relation',
  'bizdata_validate_model',
] as const;

export function registerBizDataTools() {
  registerFunctionCall({
    name: 'bizdata_list_entities',
    description: '列出业务数据实体',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string' },
        entityKind: { type: 'string', enum: ['er_table', 'json_schema'] },
      },
    },
    handler: async (args) => {
      const res = await getBusinessDataEntities({
        codePrefix: args.codePrefix as string,
        entityKind: args.entityKind as string,
        size: 200,
      });
      return getApiData(res) ?? parseApiListResponse(res).items;
    },
  });

  registerFunctionCall({
    name: 'bizdata_get_entity',
    description: '获取实体详情（含字段）',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: '实体 UUID' },
        entityCode: { type: 'string', description: '实体 code，如 sale:customer' },
      },
    },
    handler: async (args) => {
      const entityId = await resolveBizDataEntityId(args as Record<string, unknown>);
      const res = await getBusinessDataEntity(entityId);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_create_entity',
    description: '创建实体',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        label: { type: 'string' },
        entityKind: { type: 'string' },
        tableName: { type: 'string' },
      },
      required: ['code', 'label'],
    },
    handler: async (args) => {
      const res = await postBusinessDataEntity({
        code: String(args.code),
        label: String(args.label),
        entityKind: (args.entityKind as 'er_table' | 'json_schema') || 'er_table',
        tableName: args.tableName as string,
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_update_entity',
    description: '更新实体元信息或字段（字段默认与已有合并，replaceFields=true 时全量替换）',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: '实体 UUID' },
        entityCode: { type: 'string', description: '实体 code，如 sale:customer' },
        label: { type: 'string' },
        replaceFields: { type: 'boolean', description: 'true=全量替换字段，false=与已有合并（默认）' },
        fields: {
          type: 'array',
          description: '字段列表。每项需含 fieldKey 或 name；type/label/nullable 可写在顶层',
          items: {
            type: 'object',
            properties: {
              fieldKey: { type: 'string' },
              name: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string' },
              length: { type: 'integer' },
              nullable: { type: 'boolean' },
              unique: { type: 'boolean' },
              primary: { type: 'boolean' },
              columnInfo: { type: 'object' },
              typeormConfig: { type: 'object' },
            },
          },
        },
      },
    },
    handler: async (args) => {
      const entityId = await resolveBizDataEntityId(args as Record<string, unknown>);
      if (args.label) {
        await patchBusinessDataEntity(entityId, { label: String(args.label) });
      }
      if (Array.isArray(args.fields)) {
        const incoming = args.fields.map((field, index) =>
          normalizeBizDataField(field as Record<string, unknown>, index),
        );
        const existing = await loadEntityFields(entityId);
        const merged = mergeEntityFields(existing, incoming, args.replaceFields === true);
        const res = await putBusinessDataEntityFields(entityId, merged);
        return getApiData(res);
      }
      const res = await getBusinessDataEntity(entityId);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_delete_entity',
    description: '删除实体',
    parameters: {
      type: 'object',
      properties: { entityId: { type: 'string' } },
      required: ['entityId'],
    },
    handler: async (args) => {
      await deleteBusinessDataEntity(String(args.entityId));
      return { success: true };
    },
  });

  registerFunctionCall({
    name: 'bizdata_create_enum',
    description: '创建枚举',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        label: { type: 'string' },
        values: { type: 'object' },
      },
      required: ['code'],
    },
    handler: async (args) => {
      const res = await postBusinessDataEnum({
        code: String(args.code),
        enumInfo: { code: args.code, label: args.label || args.code },
        values: (args.values as Record<string, unknown>) || {},
        items: {},
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_add_relation',
    description: '添加实体关系',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        name: { type: 'string' },
        fromEntityId: { type: 'string' },
        toEntityId: { type: 'string' },
      },
      required: ['type', 'name', 'fromEntityId', 'toEntityId'],
    },
    handler: async (args) => {
      const res = await postBusinessDataRelation({
        type: String(args.type),
        name: String(args.name),
        fromEntityId: String(args.fromEntityId),
        toEntityId: String(args.toEntityId),
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_validate_model',
    description: '校验实体模型结构',
    parameters: {
      type: 'object',
      properties: { entityId: { type: 'string' } },
    },
    handler: async (args) => {
      const schema = await getBusinessDataSchema();
      const data = getApiData<API.BusinessDataSchema>(schema);
      if (args.entityId) {
        const entity = data?.entities?.find((e) => e.id === args.entityId);
        if (!entity) return { isValid: false, errors: ['实体不存在'] };
        const errors: string[] = [];
        if (!entity.code?.includes(':')) errors.push('code 应包含 Scope 层级');
        if (entity.entityKind === 'er_table' && !(entity.fields?.length)) {
          errors.push('ER 实体建议至少有一个字段');
        }
        return { isValid: errors.length === 0, errors, entity };
      }
      return {
        isValid: true,
        entityCount: data?.entities?.length || 0,
        relationCount: data?.relations?.length || 0,
      };
    },
  });
}

export function unregisterBizDataTools() {
  TOOL_NAMES.forEach((name) => unregisterFunctionCall(name));
}
