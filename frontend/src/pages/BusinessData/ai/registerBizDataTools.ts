import {
  deleteBusinessDataEntity,
  deleteBusinessDataRelation,
  getBusinessDataEntity,
  getBusinessDataEntities,
  getBusinessDataEnums,
  getBusinessDataRelations,
  getBusinessDataSchema,
  patchBusinessDataEntity,
  postBusinessDataEntity,
  postBusinessDataEnum,
  postBusinessDataRelation,
  putBusinessDataEntityFields,
} from '@/services/UAC/api/businessData';
import { registerFunctionCall, unregisterFunctionCall } from '@EADAF/ai-base';
import { createMutatingHandler } from '@/ai/toolMutation';
import { getApiData, getApiErrorMessage, isApiSuccess, parseApiListResponse } from '@/utils/apiResponse';
import {
  loadEntity,
  loadEntityFields,
  mergeEntityFields,
  mergeEntityIndexes,
  normalizeBizDataField,
  normalizeBizDataIndex,
  readEntityIndexes,
  resolveBizDataEntityId,
} from './bizdataFieldUtils';
import {
  assertCodeRenameOnlyArgs,
  assertEntityCodeNotExists,
  executeEntityCodeRename,
} from './entityCodeRename';

const BIZDATA_DOMAIN = 'bizdata';
const BIZDATA_SURFACE = 'bizdata.model-designer';

const TOOL_NAMES = [
  'bizdata_list_entities',
  'bizdata_get_entity',
  'bizdata_create_entity',
  'bizdata_update_entity',
  'bizdata_rename_entity_code',
  'bizdata_delete_entity',
  'bizdata_create_enum',
  'bizdata_list_enums',
  'bizdata_list_relations',
  'bizdata_add_relation',
  'bizdata_delete_relation',
  'bizdata_upsert_entity_indexes',
  'bizdata_validate_model',
] as const;

type RelationInput = Record<string, unknown>;

const BIZDATA_FIELD_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    fieldKey: { type: 'string' },
    name: { type: 'string', description: '同 fieldKey' },
    label: { type: 'string' },
    type: {
      type: 'string',
      description:
        '字段类型：varchar/int/uuid/decimal 等；有限取值字段须用 adb-enum（配合 enumCode）',
    },
    enumCode: {
      type: 'string',
      description: '枚举 code（如 production:WorkOrderStatus）；type=adb-enum 时必填',
    },
    enumConfig: {
      type: 'object',
      properties: {
        enumCode: { type: 'string' },
        isMultiple: { type: 'boolean' },
      },
    },
    length: { type: 'integer' },
    nullable: { type: 'boolean' },
    unique: { type: 'boolean' },
    primary: { type: 'boolean' },
    columnInfo: { type: 'object' },
    typeormConfig: { type: 'object' },
  },
} as const;

const ENUM_LIKE_FIELD_RE = /(^status$|_status$|^state$|_state$|_type$|^type$)/i;

async function resetEntityModelValidated(entityId: string) {
  const entity = await loadEntity(entityId);
  if (entity.entityInfo?.modelValidated !== true) return;
  await patchBusinessDataEntity(entityId, {
    entityInfo: { ...(entity.entityInfo || {}), modelValidated: false },
  });
}

async function resolveRelationEntityIds(rel: RelationInput): Promise<{ fromEntityId: string; toEntityId: string }> {
  const fromEntityId = await resolveBizDataEntityId({
    entityId: rel.fromEntityId,
    entityCode: rel.fromEntityCode,
  });
  const toEntityId = await resolveBizDataEntityId({
    entityId: rel.toEntityId,
    entityCode: rel.toEntityCode,
  });
  return { fromEntityId, toEntityId };
}

async function createRelationFromInput(rel: RelationInput) {
  const { type, name, inverseName, joinTable, config } = rel;
  if (!type || !name) {
    throw new Error('关系缺少 type 或 name');
  }
  const hasFrom = rel.fromEntityId || rel.fromEntityCode;
  const hasTo = rel.toEntityId || rel.toEntityCode;
  if (!hasFrom || !hasTo) {
    throw new Error('关系须同时指定 fromEntityCode/toEntityCode（或对应 UUID）');
  }
  const { fromEntityId, toEntityId } = await resolveRelationEntityIds(rel);
  const res = await postBusinessDataRelation({
    type: String(type),
    name: String(name),
    inverseName: inverseName ? String(inverseName) : undefined,
    fromEntityId,
    toEntityId,
    joinTable: joinTable ? String(joinTable) : undefined,
    config: (config as Record<string, unknown>) || undefined,
  });
  const data = getApiData(res);
  if (!data) throw new Error('创建关系失败');
  await resetEntityModelValidated(fromEntityId);
  await resetEntityModelValidated(toEntityId);
  return data;
}

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
    description: '获取实体详情（含字段与 layout.indexes）；优先传 entityCode（如 equipment:Device）',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: '实体 UUID（须来自 list 响应，禁止编造）' },
        entityCode: { type: 'string', description: '实体 code，如 equipment:Device' },
      },
    },
    handler: async (args) => {
      const entityId = await resolveBizDataEntityId(args as Record<string, unknown>);
      const res = await getBusinessDataEntity(entityId);
      const data = getApiData<API.BusinessDataEntity>(res);
      if (!data) {
        throw new Error(getApiErrorMessage(res, '获取实体详情失败'));
      }
      return data;
    },
  });

  registerFunctionCall({
    name: 'bizdata_create_entity',
    description:
      '创建全新实体（code 须不存在）；可同时传 fields、indexes、relations。调整 Scope/重命名已有实体请用 bizdata_rename_entity_code，禁止 delete + create',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Scope:EntityName，如 sale:Customer' },
        label: { type: 'string' },
        entityKind: { type: 'string', enum: ['er_table', 'json_schema'] },
        tableName: { type: 'string' },
        fields: {
          type: 'array',
          description:
            '字段列表；status/state/type 等有限取值字段须 type=adb-enum 并指定 enumCode（先 bizdata_create_enum）',
          items: BIZDATA_FIELD_ITEM_SCHEMA,
        },
        indexes: {
          type: 'array',
          description: '可选，写入 layout.indexes；字段名须为已存在或同批 fields 中的 fieldKey',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '索引名，如 idx_customer_email' },
              fields: { type: 'array', items: { type: 'string' }, description: 'fieldKey 数组' },
              unique: { type: 'boolean' },
              type: { type: 'string', enum: ['btree', 'hash', 'gin', 'gist'] },
            },
            required: ['name', 'fields'],
          },
        },
        relations: {
          type: 'array',
          description:
            '可选，创建后建立的关系；用 fromEntityCode/toEntityCode（推荐）或 UUID；新建实体可用本实体的 code',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['oneToMany', 'manyToOne', 'oneToOne', 'manyToMany'],
              },
              name: { type: 'string' },
              inverseName: { type: 'string' },
              fromEntityCode: { type: 'string' },
              toEntityCode: { type: 'string' },
              fromEntityId: { type: 'string' },
              toEntityId: { type: 'string' },
              joinTable: { type: 'string', description: 'manyToMany 时可选中间表名' },
            },
            required: ['type', 'name'],
          },
        },
      },
      required: ['code', 'label'],
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'entity.created',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => {
        const wrapped = data as { entity?: API.BusinessDataEntity };
        return wrapped?.entity?.id ?? (data as API.BusinessDataEntity)?.id;
      },
      handler: async (args) => {
        const code = String(args.code).trim();
        await assertEntityCodeNotExists(code);

        const res = await postBusinessDataEntity({
          code,
          label: String(args.label),
          entityKind: (args.entityKind as 'er_table' | 'json_schema') || 'er_table',
          tableName: args.tableName as string,
        });
        let entity = getApiData<API.BusinessDataEntity>(res);
        if (!entity?.id) throw new Error('创建实体失败');

        if (Array.isArray(args.fields) && args.fields.length) {
          const incoming = args.fields.map((field, index) =>
            normalizeBizDataField(field as Record<string, unknown>, index),
          );
          const fieldsRes = await putBusinessDataEntityFields(entity.id!, incoming);
          entity = getApiData<API.BusinessDataEntity>(fieldsRes) || entity;
        }

        if (Array.isArray(args.indexes) && args.indexes.length) {
          const incoming = args.indexes.map((idx, index) =>
            normalizeBizDataIndex(idx as Record<string, unknown>, index),
          );
          const patchRes = await patchBusinessDataEntity(entity.id!, {
            layout: { ...(entity.layout || {}), indexes: incoming },
          });
          entity = getApiData<API.BusinessDataEntity>(patchRes) || entity;
        }

        const createdRelations: API.BusinessDataRelation[] = [];
        if (Array.isArray(args.relations)) {
          for (const rel of args.relations) {
            const row = rel as RelationInput;
            const needsFrom = !row.fromEntityId && !row.fromEntityCode;
            const needsTo = !row.toEntityId && !row.toEntityCode;
            const patched: RelationInput = { ...row };
            if (needsFrom) patched.fromEntityCode = entity.code;
            if (needsTo) patched.toEntityCode = entity.code;
            createdRelations.push(await createRelationFromInput(patched));
          }
        }

        const finalEntity = await loadEntity(entity.id!);
        return {
          entity: finalEntity,
          relations: createdRelations,
        };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_rename_entity_code',
    description:
      '调整实体 Scope 层级或重命名 code（保留字段/索引/关系/物化/MOCK）。FMMS 按二级子 Scope 重建等批量改 Scope 必须用本 Tool；仅传 entityCode + code，禁止 delete + create',
    parameters: {
      type: 'object',
      properties: {
        entityCode: {
          type: 'string',
          description: '当前/旧实体 code，如 fmms:WorkCard',
        },
        code: {
          type: 'string',
          description: '新实体 code，如 fmms:production:WorkCard',
        },
        tableName: {
          type: 'string',
          description: '可选；ER 物理表名，不填且原为默认推导值时随 code 同步',
        },
      },
      required: ['entityCode', 'code'],
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'entity.updated',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => (data as { entity?: API.BusinessDataEntity })?.entity?.id,
      buildPayload: (_args, data) => (data as { entity?: API.BusinessDataEntity })?.entity,
      handler: async (args) =>
        executeEntityCodeRename(
          String(args.entityCode),
          String(args.code),
          args.tableName as string | undefined,
        ),
    }),
  });

  registerFunctionCall({
    name: 'bizdata_update_entity',
    description:
      '更新实体 label/字段/layout/jsonSchema。改 Scope 或重命名 code 请优先用 bizdata_rename_entity_code；若用本 Tool 改 code 则仅传 entityCode + code（可选 tableName），勿传 fields 等',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: '实体 UUID' },
        entityCode: {
          type: 'string',
          description: '定位用：当前/旧实体 code，如 fmms:WorkCard（与 entityId 二选一）',
        },
        code: {
          type: 'string',
          description: '新的实体 code，如 fmms:production:WorkCard；变更时级联更新引用',
        },
        label: { type: 'string' },
        tableName: {
          type: 'string',
          description: 'ER 表物理表名；不填且原为默认推导值时随 code 同步',
        },
        status: { type: 'string', enum: ['enabled', 'disabled', 'archived'] },
        replaceFields: { type: 'boolean', description: 'true=全量替换字段，false=与已有合并（默认）' },
        layout: { type: 'object', description: '实体 layout；indexes 建议用 bizdata_upsert_entity_indexes' },
        jsonSchema: { type: 'object', description: 'JSON Schema 结构（json_schema 实体）' },
        fields: {
          type: 'array',
          description: '字段列表；有限取值字段须 type=adb-enum + enumCode',
          items: BIZDATA_FIELD_ITEM_SCHEMA,
        },
      },
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'entity.updated',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => (data as API.BusinessDataEntity)?.id,
      handler: async (args) => {
        const typedArgs = args as Record<string, unknown>;
        const hasCodeChange =
          args.code !== undefined && args.code !== null && String(args.code).trim().length > 0;

        if (hasCodeChange) {
          assertCodeRenameOnlyArgs(typedArgs);
          let oldCode = args.entityCode ? String(args.entityCode).trim() : '';
          if (!oldCode) {
            const entityId = await resolveBizDataEntityId(typedArgs);
            const entity = await loadEntity(entityId);
            oldCode = entity.code || '';
          }
          if (!oldCode) {
            throw new Error('修改 code 时须传 entityCode（当前/旧 code）或有效 entityId');
          }
          return executeEntityCodeRename(
            oldCode,
            String(args.code),
            args.tableName as string | undefined,
          );
        }

        const entityId = await resolveBizDataEntityId(typedArgs);
        const patchPayload: Record<string, unknown> = {};
        if (args.label) patchPayload.label = String(args.label);
        if (args.tableName !== undefined) {
          patchPayload.tableName = String(args.tableName).trim() || undefined;
        }
        if (args.status) patchPayload.status = String(args.status);
        if (args.layout !== undefined) patchPayload.layout = args.layout;
        if (args.jsonSchema !== undefined) patchPayload.jsonSchema = args.jsonSchema;

        if (Object.keys(patchPayload).length) {
          const patchRes = await patchBusinessDataEntity(entityId, patchPayload);
          if (!isApiSuccess(patchRes)) {
            throw new Error(getApiErrorMessage(patchRes, '更新实体失败'));
          }
        }

        if (Array.isArray(args.fields)) {
          const incoming = args.fields.map((field, index) =>
            normalizeBizDataField(field as Record<string, unknown>, index),
          );
          const existing = await loadEntityFields(entityId);
          const merged = mergeEntityFields(existing, incoming, args.replaceFields === true);
          const res = await putBusinessDataEntityFields(entityId, merged);
          const data = getApiData<API.BusinessDataEntity>(res);
          if (!data) throw new Error('更新实体字段失败');
          await resetEntityModelValidated(entityId);
          return loadEntity(entityId);
        }

        return loadEntity(entityId);
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_delete_entity',
    description:
      '永久删除实体（字段/索引/关系/物化/MOCK 均丢失）。禁止用于 Scope 调整或 code 重命名，请用 bizdata_rename_entity_code；仅当用户明确要求删除且确认数据可丢弃时使用',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: '实体 UUID（须来自 list，禁止编造）' },
        entityCode: { type: 'string', description: '实体 code，如 fmms:WorkCard（与 entityId 二选一）' },
      },
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'entity.deleted',
      scope: BIZDATA_SURFACE,
      buildResourceId: (args) => String(args.entityId || args.entityCode),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const entityId = await resolveBizDataEntityId(args as Record<string, unknown>);
        const entity = await loadEntity(entityId);
        const fieldCount = entity.fields?.length ?? 0;

        try {
          await deleteBusinessDataEntity(entityId);
        } catch (error) {
          throw new Error(getApiErrorMessage(error, '删除实体失败'));
        }

        try {
          await loadEntity(entityId);
          throw new Error(`删除未生效：实体「${entity.code}」仍存在`);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('删除未生效')) {
            throw error;
          }
        }

        return {
          success: true,
          deletedEntityId: entityId,
          deletedCode: entity.code,
          _verification: {
            verified: true,
            deletedCode: entity.code,
            message: `已验证实体「${entity.code}」已删除`,
          },
          _warning:
            fieldCount > 0
              ? '该实体含字段/关系/物化数据，Scope 调整应使用 bizdata_rename_entity_code 而非 delete + create'
              : undefined,
        };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_list_enums',
    description: '列出已定义的 ADB 枚举（创建 status 等字段前应先查询是否已有可复用枚举）',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: '按 code 前缀过滤，如 production:' },
      },
    },
    handler: async (args) => {
      const res = await getBusinessDataEnums({ size: 200 });
      const { items } = parseApiListResponse<API.BusinessDataEnum>(res);
      const prefix = args.codePrefix ? String(args.codePrefix) : '';
      return prefix ? items.filter((item) => item.code?.startsWith(prefix)) : items;
    },
  });

  registerFunctionCall({
    name: 'bizdata_create_enum',
    description:
      '创建 ADB 枚举定义；有限取值字段（status/state/type 等）须先建枚举，再在实体字段中用 type=adb-enum + enumCode 引用',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '枚举 code，如 production:WorkOrderStatus' },
        label: { type: 'string' },
        values: {
          type: 'object',
          description: '键值映射，如 { "PENDING": "pending", "DONE": "done" }',
        },
        items: {
          type: 'object',
          description: '展示项，如 { "PENDING": { "label": "待处理", "sort": 1 } }',
        },
      },
      required: ['code', 'values'],
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'enum.created',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => (data as { id?: string })?.id,
      handler: async (args) => {
        const res = await postBusinessDataEnum({
          code: String(args.code),
          enumInfo: {
            code: args.code,
            label: args.label || args.code,
            ...(args.description ? { description: String(args.description) } : {}),
          },
          values: (args.values as Record<string, unknown>) || {},
          items: (args.items as Record<string, unknown>) || {},
        });
        const data = getApiData(res);
        if (!data) throw new Error('创建枚举失败');
        return data;
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_list_relations',
    description: '列出全部实体关系（含 fromEntity/toEntity 的 code）',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const res = await getBusinessDataRelations();
      return getApiData(res) ?? [];
    },
  });

  registerFunctionCall({
    name: 'bizdata_add_relation',
    description:
      '添加实体关系；优先传 fromEntityCode/toEntityCode（如 sale:Order → sale:Customer），禁止编造 UUID',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['oneToMany', 'manyToOne', 'oneToOne', 'manyToMany'],
          description: 'oneToMany=一对多，manyToOne=多对一，oneToOne=一对一，manyToMany=多对多',
        },
        name: { type: 'string', description: '关系名，如 orders、customer' },
        inverseName: { type: 'string', description: '反向关系名（可选）' },
        fromEntityCode: { type: 'string', description: '源实体 code' },
        toEntityCode: { type: 'string', description: '目标实体 code' },
        fromEntityId: { type: 'string', description: '源实体 UUID（须来自 list）' },
        toEntityId: { type: 'string', description: '目标实体 UUID（须来自 list）' },
        joinTable: { type: 'string', description: 'manyToMany 中间表名（可选）' },
        config: { type: 'object' },
      },
      required: ['type', 'name'],
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'relation.created',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => (data as { id?: string })?.id,
      handler: async (args) => createRelationFromInput(args as RelationInput),
    }),
  });

  registerFunctionCall({
    name: 'bizdata_delete_relation',
    description: '删除实体关系',
    parameters: {
      type: 'object',
      properties: { relationId: { type: 'string' } },
      required: ['relationId'],
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'relation.deleted',
      scope: BIZDATA_SURFACE,
      buildResourceId: (args) => String(args.relationId),
      buildPayload: () => ({ success: true }),
      handler: async (args) => {
        await deleteBusinessDataRelation(String(args.relationId));
        return { success: true, relationId: String(args.relationId) };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_upsert_entity_indexes',
    description:
      '为实体创建或更新索引（写入 layout.indexes）；创建实体后应主动为主键、外键、唯一字段、常用查询字段建索引',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        entityCode: { type: 'string', description: '如 sale:Customer' },
        replaceIndexes: {
          type: 'boolean',
          description: 'true=全量替换索引，false=按 name 合并（默认）',
        },
        indexes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string', description: '如 idx_customer_email、pk_id' },
              fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'fieldKey 数组，复合索引传多个',
              },
              unique: { type: 'boolean' },
              type: { type: 'string', enum: ['btree', 'hash', 'gin', 'gist'] },
            },
            required: ['name', 'fields'],
          },
        },
      },
      required: ['indexes'],
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'entity.updated',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => (data as { entity?: API.BusinessDataEntity })?.entity?.id,
      buildPayload: (_args, data) => (data as { entity?: API.BusinessDataEntity })?.entity,
      handler: async (args) => {
        if (!Array.isArray(args.indexes) || !args.indexes.length) {
          throw new Error('indexes 不能为空');
        }
        const entityId = await resolveBizDataEntityId(args as Record<string, unknown>);
        const entity = await loadEntity(entityId);
        const incoming = args.indexes.map((idx, index) =>
          normalizeBizDataIndex(idx as Record<string, unknown>, index),
        );
        const existing = readEntityIndexes(entity);
        const merged = mergeEntityIndexes(existing, incoming, args.replaceIndexes === true);
        const fieldKeys = new Set((entity.fields || []).map((f) => f.fieldKey).filter(Boolean));
        for (const idx of merged) {
          const invalid = idx.fields.filter((k) => !fieldKeys.has(k));
          if (invalid.length) {
            throw new Error(
              `索引「${idx.name}」引用了不存在的字段: ${invalid.join(', ')}；请先 bizdata_update_entity 添加字段`,
            );
          }
        }
        const res = await patchBusinessDataEntity(entityId, {
          layout: { ...(entity.layout || {}), indexes: merged },
        });
        const data = getApiData<API.BusinessDataEntity>(res);
        if (!data) throw new Error('保存索引失败');
        await resetEntityModelValidated(entityId);
        return {
          entityId,
          indexes: readEntityIndexes(data),
          entity: await loadEntity(entityId),
        };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_validate_model',
    description:
      '校验实体模型完整性；默认 markValidated=true，校验通过时写入 entityInfo.modelValidated=true',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        entityCode: { type: 'string', description: '如 production:WorkOrder' },
        markValidated: {
          type: 'boolean',
          description: '为 true 时根据校验结果更新「是否验证通过」，默认 true',
        },
      },
    },
    handler: createMutatingHandler({
      domain: BIZDATA_DOMAIN,
      type: 'entity.updated',
      scope: BIZDATA_SURFACE,
      buildResourceId: (_args, data) => (data as { entity?: API.BusinessDataEntity })?.entity?.id,
      buildPayload: (_args, data) => (data as { entity?: API.BusinessDataEntity })?.entity,
      handler: async (args) => {
        const schema = await getBusinessDataSchema();
        const data = getApiData<API.BusinessDataSchema>(schema);
        const relations = data?.relations || [];
        const markValidated = args.markValidated !== false;

        if (args.entityId || args.entityCode) {
          const entityId = await resolveBizDataEntityId(args as Record<string, unknown>);
          const entity = data?.entities?.find((e) => e.id === entityId) || (await loadEntity(entityId));
          if (!entity) return { isValid: false, errors: ['实体不存在'], entity: null };

          const errors: string[] = [];
          if (!entity.code?.includes(':')) errors.push('code 应包含 Scope 层级');
          if (entity.entityKind === 'er_table' && !(entity.fields?.length)) {
            errors.push('ER 实体建议至少有一个字段');
          }

          const fieldKeys = new Set((entity.fields || []).map((f) => f.fieldKey).filter(Boolean));
          const indexes = readEntityIndexes(entity);
          if (!indexes.length && (entity.fields?.length || 0) > 0) {
            errors.push('建议为主键/外键/唯一/常用查询字段创建索引（bizdata_upsert_entity_indexes）');
          }
          indexes.forEach((idx) => {
            const invalid = (idx.fields || []).filter((k) => !fieldKeys.has(k));
            if (invalid.length) {
              errors.push(`索引「${idx.name}」引用了不存在的字段: ${invalid.join(', ')}`);
            }
          });

          (entity.fields || []).forEach((field) => {
            const key = field.fieldKey || '';
            const extendType = field.columnInfo?.extendType;
            const typeormType = String(field.typeormConfig?.type || '').toLowerCase();
            const isEnumField = extendType === 'adb-enum';
            if (ENUM_LIKE_FIELD_RE.test(key) && !isEnumField) {
              errors.push(
                `字段「${key}」疑似状态/类型字段，应使用 type=adb-enum 并关联 enumCode（先 bizdata_create_enum）`,
              );
            }
            if (isEnumField && !field.columnInfo?.enumConfig?.enumCode) {
              errors.push(`枚举字段「${key}」缺少 enumConfig.enumCode`);
            }
            if (isEnumField && typeormType && typeormType !== 'varchar') {
              errors.push(`枚举字段「${key}」的 typeorm type 应为 varchar`);
            }
          });

          const related = relations.filter(
            (r) => r.fromEntityId === entity.id || r.toEntityId === entity.id,
          );
          if (
            !related.length &&
            (entity.fields || []).some((f) => {
              const key = f.fieldKey || '';
              return key.endsWith('_id') || key === 'id';
            })
          ) {
            errors.push('存在疑似外键字段但未建立关系（bizdata_add_relation）');
          }

          const isValid = errors.length === 0;
          let resultEntity = entity;

          if (markValidated) {
            const patchRes = await patchBusinessDataEntity(entityId, {
              entityInfo: {
                ...(entity.entityInfo || {}),
                modelValidated: isValid,
              },
            });
            const patched = getApiData<API.BusinessDataEntity>(patchRes);
            if (patched) resultEntity = patched;
          }

          return {
            isValid,
            errors,
            entity: resultEntity,
            modelValidated: resultEntity.entityInfo?.modelValidated === true,
            indexCount: indexes.length,
            relationCount: related.length,
          };
        }

        return {
          isValid: true,
          entityCount: data?.entities?.length || 0,
          relationCount: relations.length,
        };
      },
    }),
  });
}

export function unregisterBizDataTools() {
  TOOL_NAMES.forEach((name) => unregisterFunctionCall(name));
}
