import { getBusinessDataEntity, getBusinessDataEntities } from '@/services/UAC/api/businessData';
import {
  postApiService,
  postApiServicePublish,
} from '@/services/UAC/api/apiServices';
import {
  getApiData,
  getApiErrorMessage,
  isApiSuccess,
} from '@/utils/apiResponse';
import { normalizeApiServiceCode, suggestApiServiceCodeFromEntity } from './apiServiceCodeUtils';
import { resolveApiServiceConnection } from './apiServiceConnectionResolve';
import { verifyApiServiceListed } from './apiServiceVerify';

export const DEFAULT_CRUD_OPERATIONS = ['find', 'create', 'updateOne', 'deleteOne'] as const;

const OPERATION_SUFFIX: Record<string, string> = {
  find: 'Find',
  findOne: 'FindOne',
  findById: 'FindById',
  create: 'Create',
  insertOne: 'Create',
  updateOne: 'Update',
  updateMany: 'UpdateMany',
  deleteOne: 'Delete',
  deleteMany: 'DeleteMany',
  count: 'Count',
  aggregate: 'Aggregate',
};

const OPERATION_LABEL: Record<string, string> = {
  find: '列表查询',
  findOne: '单条查询',
  findById: '按 ID 查询',
  create: '创建',
  insertOne: '创建',
  updateOne: '更新',
  updateMany: '批量更新',
  deleteOne: '删除',
  deleteMany: '批量删除',
  count: '计数',
  aggregate: '聚合',
};

export interface BatchServiceDraft {
  code: string;
  name: string;
  definitionScript: string;
  enabledOperations: [string];
  entityId?: string;
  entityCode?: string;
}

export interface BatchCreateArgs {
  connectionId?: string;
  scopeCode?: string;
  entityCode?: string;
  entityCodes?: string[];
  entityId?: string;
  entityIds?: string[];
  operations?: string[];
  namePrefix?: string;
  tags?: string[];
  publish?: boolean;
  services?: Array<{
    code?: string;
    name?: string;
    definitionScript?: string;
    operation?: string;
    enabledOperations?: string[];
  }>;
}

export interface BatchCreateResult {
  created: API.ApiService[];
  skipped: Array<{ code?: string; operation?: string; reason: string }>;
  failed: Array<{ code?: string; operation?: string; error: string }>;
  connectionId: string;
  connectionName?: string;
  targetSchema?: string;
  total: number;
  successCount: number;
  skippedCount: number;
}

function isDuplicateError(message: string): boolean {
  return /已存在|409|duplicate|exists/i.test(message);
}

async function resolveEntityByCode(entityCode: string): Promise<API.BusinessDataEntity | undefined> {
  const res = await getBusinessDataEntities({ codePrefix: entityCode, size: 200 });
  const data = getApiData<{ items?: API.BusinessDataEntity[] }>(res);
  const items = data?.items || [];
  return items.find((item) => item.code === entityCode) || items[0];
}

async function resolveEntity(args: BatchCreateArgs): Promise<API.BusinessDataEntity | undefined> {
  if (args.entityId) {
    const res = await getBusinessDataEntity(String(args.entityId));
    return getApiData<API.BusinessDataEntity>(res) || undefined;
  }
  const entityIds = args.entityIds?.filter(Boolean) || [];
  if (entityIds.length) {
    const res = await getBusinessDataEntity(entityIds[0]);
    return getApiData<API.BusinessDataEntity>(res) || undefined;
  }
  const entityCode =
    args.entityCode?.trim() ||
    args.entityCodes?.[0]?.trim() ||
    undefined;
  if (!entityCode) return undefined;
  return resolveEntityByCode(entityCode);
}

async function resolveEntitiesForBatch(args: BatchCreateArgs): Promise<API.BusinessDataEntity[]> {
  if (Array.isArray(args.services) && args.services.length) {
    const entity = await resolveEntity(args);
    return entity ? [entity] : [];
  }

  const codes = [
    ...(args.entityCode?.trim() ? [args.entityCode.trim()] : []),
    ...(args.entityCodes?.map((c) => c.trim()).filter(Boolean) || []),
  ];
  const uniqueCodes = [...new Set(codes)];

  if (uniqueCodes.length > 1) {
    const entities: API.BusinessDataEntity[] = [];
    for (const code of uniqueCodes) {
      const entity = await resolveEntityByCode(code);
      if (entity) entities.push(entity);
    }
    return entities;
  }

  const entity = await resolveEntity(args);
  return entity ? [entity] : [];
}

function operationSuffix(operation: string): string {
  return OPERATION_SUFFIX[operation] || operation.charAt(0).toUpperCase() + operation.slice(1);
}

function buildDefaultSql(
  tableName: string,
  targetSchema: string,
  operation: string,
): string {
  const qualified = `"${targetSchema}"."${tableName}"`;
  switch (operation) {
    case 'find':
      return `SELECT *\nFROM ${qualified}\nWHERE 1 = 1\n-- 过滤条件示例: AND status = :status\nORDER BY id DESC\nLIMIT :limit OFFSET :skip`;
    case 'findOne':
    case 'findById':
      return `SELECT *\nFROM ${qualified}\nWHERE id = :id\nLIMIT 1`;
    case 'create':
    case 'insertOne':
      return `-- create 操作：Gateway 将基于请求体生成 INSERT\n-- 以下为结构参考\nSELECT *\nFROM ${qualified}\nWHERE 1 = 0`;
    case 'updateOne':
      return `UPDATE ${qualified}\nSET updated_at = NOW()\n--  SET field = :field\nWHERE id = :id\nRETURNING *`;
    case 'deleteOne':
      return `DELETE FROM ${qualified}\nWHERE id = :id\nRETURNING id`;
    case 'count':
      return `SELECT COUNT(*) AS total\nFROM ${qualified}\nWHERE 1 = 1`;
    case 'aggregate':
      return `SELECT COUNT(*) AS total\nFROM ${qualified}\nWHERE 1 = 1\n-- aggregate 可扩展 GROUP BY`;
    default:
      return `SELECT *\nFROM ${qualified}\nLIMIT 100`;
  }
}

export function buildCrudServiceDrafts(
  entity: API.BusinessDataEntity,
  operations: string[],
  options?: { namePrefix?: string; targetSchema?: string },
): BatchServiceDraft[] {
  const tableName = entity.tableName || entity.code?.split(':').pop() || 'Entity';
  const targetSchema = options?.targetSchema || 'bizdata_mat';
  const label = options?.namePrefix || entity.label || entity.code || 'API';

  return operations.map((operation) => {
    const suffix = operationSuffix(operation);
    const code = suggestApiServiceCodeFromEntity(String(entity.code || ''), suffix);
    const opLabel = OPERATION_LABEL[operation] || operation;
    return {
      code,
      name: `${label} - ${opLabel}`,
      definitionScript: buildDefaultSql(tableName, targetSchema, operation),
      enabledOperations: [operation],
      entityId: entity.id,
      entityCode: entity.code,
    };
  });
}

export function normalizeBatchDrafts(
  args: BatchCreateArgs,
  entities: API.BusinessDataEntity[],
  targetSchema?: string,
): BatchServiceDraft[] {
  if (Array.isArray(args.services) && args.services.length) {
    const entity = entities[0];
    return args.services.map((item) => {
      const operation =
        item.operation ||
        (Array.isArray(item.enabledOperations) ? item.enabledOperations[0] : 'find');
      const entityCode = entity?.code || args.entityCode;
      const code = normalizeApiServiceCode(item.code, {
        entityCode: entityCode ? suggestApiServiceCodeFromEntity(entityCode, operationSuffix(operation)) : undefined,
        scopeCode: args.scopeCode,
        fallbackName: item.name,
      });
      const schema = targetSchema || 'bizdata_mat';
      const tableName = entity?.tableName || entity?.code?.split(':').pop() || 'Entity';
      return {
        code,
        name: item.name || code,
        definitionScript:
          item.definitionScript || buildDefaultSql(tableName, schema, operation),
        enabledOperations: [operation],
        entityId: entity?.id,
        entityCode: entity?.code,
      };
    });
  }

  if (!entities.length) {
    throw new Error('批量创建需要 entityCode/entityId 或显式 services 列表');
  }

  const operations =
    args.operations?.length ? args.operations : [...DEFAULT_CRUD_OPERATIONS];

  return entities.flatMap((entity) =>
    buildCrudServiceDrafts(entity, operations, {
      namePrefix: args.namePrefix,
      targetSchema,
    }),
  );
}

export async function executeBatchCreateServices(args: BatchCreateArgs): Promise<BatchCreateResult> {
  const entities = await resolveEntitiesForBatch(args);
  const entityCodes = [
    ...(args.entityCode ? [args.entityCode] : []),
    ...(args.entityCodes || []),
    ...(entities.map((e) => e.code).filter(Boolean) as string[]),
  ];

  const resolved = await resolveApiServiceConnection({
    connectionId: args.connectionId,
    scopeCode: args.scopeCode,
    entityCodes: entityCodes.length ? entityCodes : undefined,
    entityIds: [
      ...(args.entityId ? [String(args.entityId)] : []),
      ...(args.entityIds || []),
      ...(entities.map((e) => e.id).filter(Boolean) as string[]),
    ],
  });

  const drafts = normalizeBatchDrafts(args, entities, resolved.targetSchema);
  const created: API.ApiService[] = [];
  const skipped: BatchCreateResult['skipped'] = [];
  const failed: BatchCreateResult['failed'] = [];

  for (const draft of drafts) {
    try {
      const createRes = await postApiService({
        code: draft.code,
        name: draft.name,
        tags: args.tags,
        connectionId: resolved.connectionId,
        entityId: draft.entityId,
        definitionScript: draft.definitionScript,
        enabledOperations: draft.enabledOperations,
      });

      if (!isApiSuccess(createRes)) {
        const errMsg = getApiErrorMessage(createRes, '创建失败');
        if (isDuplicateError(errMsg)) {
          skipped.push({
            code: draft.code,
            operation: draft.enabledOperations[0],
            reason: errMsg,
          });
        } else {
          failed.push({
            code: draft.code,
            operation: draft.enabledOperations[0],
            error: errMsg,
          });
        }
        continue;
      }

      let service = getApiData<API.ApiService>(createRes);
      if (!service?.id && createRes && typeof createRes === 'object' && 'id' in createRes) {
        service = createRes as API.ApiService;
      }

      if (!service?.id) {
        try {
          const listed = await verifyApiServiceListed(draft.code);
          service = {
            id: listed.id,
            code: listed.code,
            name: listed.name,
            status: listed.status,
          } as API.ApiService;
        } catch {
          // fall through to failed
        }
      }

      if (!service?.id) {
        failed.push({
          code: draft.code,
          operation: draft.enabledOperations[0],
          error: getApiErrorMessage(createRes, '创建成功但未返回服务 ID'),
        });
        continue;
      }

      if (args.publish === true) {
        const pubRes = await postApiServicePublish(service.id);
        service = getApiData<API.ApiService>(pubRes) || service;
      }
      created.push(service);
    } catch (error) {
      const errMsg = getApiErrorMessage(error, error instanceof Error ? error.message : String(error));
      if (isDuplicateError(errMsg)) {
        skipped.push({
          code: draft.code,
          operation: draft.enabledOperations[0],
          reason: errMsg,
        });
      } else {
        failed.push({
          code: draft.code,
          operation: draft.enabledOperations[0],
          error: errMsg,
        });
      }
    }
  }

  return {
    created,
    skipped,
    failed,
    connectionId: resolved.connectionId,
    connectionName: resolved.connectionName,
    targetSchema: resolved.targetSchema,
    total: drafts.length,
    successCount: created.length,
    skippedCount: skipped.length,
  };
}
