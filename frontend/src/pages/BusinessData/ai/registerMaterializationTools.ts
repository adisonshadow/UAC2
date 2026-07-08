import {
  getMaterializedTableRows,
  getMaterializedTableSchema,
  postMaterializedMockData,
} from '@/services/UAC/api/businessData';
import { registerFunctionCall, unregisterFunctionCall } from '@EADAF/ai-base';
import { createMutatingHandler } from '@/ai/toolMutation';
import { getApiData, getApiErrorMessage } from '@/utils/apiResponse';
import { resolveBizDataEntityId } from './bizdataFieldUtils';

const BIZDATA_MATERIALIZATION_SURFACE = 'bizdata.materialization.browse';

const TOOL_NAMES = [
  'bizdata_browse_materialized_schema',
  'bizdata_browse_materialized_rows',
  'bizdata_insert_mock_data',
] as const;

async function resolveMaterializationEntityId(args: Record<string, unknown>): Promise<string> {
  if (args.entityId) return String(args.entityId);
  if (args.entityCode) return resolveBizDataEntityId(args);
  throw new Error('须指定 entityId 或 entityCode');
}

export function registerMaterializationTools() {
  registerFunctionCall({
    name: 'bizdata_browse_materialized_schema',
    description: '读取已物化物理表的列定义（插入 MOCK 前必须先调用，rows 的 key 须与 columns.name 一致）',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        entityCode: { type: 'string', description: '如 production:Plan' },
        connectionId: { type: 'string' },
      },
      required: ['connectionId'],
    },
    handler: async (args) => {
      const entityId = await resolveMaterializationEntityId(args);
      const connectionId = String(args.connectionId || '');
      if (!connectionId) throw new Error('connectionId 为必填项');
      const res = await getMaterializedTableSchema(entityId, { connectionId });
      const data = getApiData(res);
      if (!data) throw new Error(getApiErrorMessage(res, '获取物化表结构失败'));
      return data;
    },
  });

  registerFunctionCall({
    name: 'bizdata_browse_materialized_rows',
    description: '分页读取已物化物理表数据（开发预览）',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        entityCode: { type: 'string' },
        connectionId: { type: 'string' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
      },
      required: ['connectionId'],
    },
    handler: async (args) => {
      const entityId = await resolveMaterializationEntityId(args);
      const connectionId = String(args.connectionId || '');
      if (!connectionId) throw new Error('connectionId 为必填项');
      const res = await getMaterializedTableRows(entityId, {
        connectionId,
        page: Number(args.page) || 1,
        size: Number(args.pageSize || args.size) || 20,
      });
      const data = getApiData(res);
      if (!data) throw new Error(getApiErrorMessage(res, '获取物化表数据失败'));
      return data;
    },
  });

  registerFunctionCall({
    name: 'bizdata_insert_mock_data',
    description:
      '向已物化物理表插入 MOCK 测试数据；须先 bizdata_browse_materialized_schema，rows 列名须与物理表一致',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        entityCode: { type: 'string' },
        connectionId: { type: 'string' },
        rows: {
          type: 'array',
          items: { type: 'object' },
          description: '行对象数组，key 为物理表列名（columns.name）',
        },
        rowCount: { type: 'integer', description: '仅供参考，须传 rows' },
      },
      required: ['connectionId', 'rows'],
    },
    handler: createMutatingHandler({
      domain: 'bizdata',
      type: 'materialization.mock_data.inserted',
      scope: BIZDATA_MATERIALIZATION_SURFACE,
      buildResourceId: (args) => String(args.entityId || args.entityCode || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const entityId = await resolveMaterializationEntityId(args);
        const connectionId = String(args.connectionId || '');
        if (!connectionId) throw new Error('connectionId 为必填项');
        const rows = args.rows as Record<string, unknown>[] | undefined;
        if (!Array.isArray(rows) || !rows.length) {
          throw new Error('rows 不能为空');
        }
        const res = await postMaterializedMockData(
          entityId,
          { connectionId, rows },
          { connectionId },
        );
        const data = getApiData(res);
        if (!data) throw new Error(getApiErrorMessage(res, 'MOCK 数据插入失败'));
        return data;
      },
    }),
  });
}

export function unregisterMaterializationTools() {
  TOOL_NAMES.forEach((name) => unregisterFunctionCall(name));
}
