import { registerFunctionCall, unregisterFunctionCall } from '@EADAF/ai-base';
import { createMutatingHandler } from '@/ai/toolMutation';
import { history } from '@/utils/navigation';
import {
  deleteCollectionPipeline,
  getCollectionPipeline,
  getCollectionPipelineTestProfile,
  getCollectionPipelines,
  patchCollectionPipeline,
  postCollectionPipeline,
  postCollectionPipelineDisable,
  postCollectionPipelinePublish,
  postCollectionPipelineTest,
} from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

const DOMAIN = 'bizdata';
const TEST_SURFACE = 'bizdata.collection-pipeline.test';
const EDIT_SURFACE = 'bizdata.collection-pipeline.edit';
const CREATE_SURFACE = 'bizdata.collection-pipeline.create';

function editOrCreateScope(args: Record<string, unknown>) {
  return args.pipelineId ? EDIT_SURFACE : CREATE_SURFACE;
}

const TOOL_NAMES = [
  'collection_pipeline_list',
  'collection_pipeline_filter',
  'collection_pipeline_get',
  'collection_pipeline_upsert',
  'collection_pipeline_publish',
  'collection_pipeline_disable',
  'collection_pipeline_delete',
  'collection_pipeline_get_test_profile',
  'collection_pipeline_run_test',
  'collection_pipeline_suggest_scripts',
  'collection_pipeline_navigate',
] as const;

async function resolvePipelineId(args: Record<string, unknown>) {
  if (args.pipelineId) return String(args.pipelineId);
  if (args.code) {
    const res = await getCollectionPipelines({ codePrefix: String(args.code), size: 50 });
    const data = getApiData<API.CollectionPipelineList>(res);
    const exact = data?.items?.find((item) => item.code === args.code);
    if (exact?.id) return exact.id;
  }
  throw new Error('请提供 pipelineId 或在 Surface 上下文中操作');
}

export function registerCollectionPipelineTools() {
  registerFunctionCall({
    name: 'collection_pipeline_list',
    description: '列出采集管道',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'disabled'] },
        protocolType: { type: 'string', enum: ['serial', 'modbus_rtu', 'modbus_tcp'] },
        page: { type: 'integer' },
        size: { type: 'integer' },
      },
    },
    handler: async (args) => {
      const res = await getCollectionPipelines({
        codePrefix: args.codePrefix as string,
        status: args.status as string,
        protocolType: args.protocolType as string,
        page: args.page as number,
        size: args.size as number,
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_filter',
    description: '按页面过滤项检索采集管道（code 前缀 + 状态 + 协议类型），返回全部命中项；面向检索而非分页浏览',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: 'code 前缀' },
        status: { type: 'string', enum: ['draft', 'published', 'disabled'] },
        protocolType: { type: 'string', enum: ['serial', 'modbus_rtu', 'modbus_tcp'] },
      },
    },
    handler: async (args) => {
      const res = await getCollectionPipelines({
        codePrefix: args.codePrefix as string,
        status: args.status as string,
        protocolType: args.protocolType as string,
        size: -1,
      });
      const data = getApiData<API.CollectionPipelineList>(res);
      return { items: data?.items || [], total: data?.items?.length || 0 };
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_get',
    description: '获取采集管道详情',
    parameters: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string' },
        code: { type: 'string' },
      },
    },
    handler: async (args) => {
      const id = await resolvePipelineId(args as Record<string, unknown>);
      const res = await getCollectionPipeline(id);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_upsert',
    description: '创建或更新采集管道（含脚本、样本、目标 interface）',
    parameters: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string' },
        scopeCode: { type: 'string' },
        pipelineSlug: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        protocolType: { type: 'string', enum: ['serial', 'modbus_rtu', 'modbus_tcp'] },
        entityId: { type: 'string' },
        sampleData: { type: 'string' },
        targetStructure: { type: 'string' },
        parseScript: { type: 'string' },
        storeScript: { type: 'string' },
        restrictSources: { type: 'boolean' },
        applicationIds: { type: 'array', items: { type: 'string' } },
      },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'collection_pipeline.updated',
      scope: editOrCreateScope,
      buildResourceId: (args) => String(args.pipelineId || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const body = {
          scopeCode: args.scopeCode as string,
          pipelineSlug: args.pipelineSlug as string,
          name: args.name as string,
          description: args.description as string,
          protocolType: args.protocolType as API.CollectionPipelineProtocolType,
          entityId: args.entityId as string,
          sampleData: args.sampleData as string,
          targetStructure: args.targetStructure as string,
          parseScript: args.parseScript as string,
          storeScript: args.storeScript as string,
          restrictSources: args.restrictSources as boolean,
          applicationIds: args.applicationIds as string[],
        };
        if (args.pipelineId) {
          const res = await patchCollectionPipeline(String(args.pipelineId), body);
          if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '更新失败'));
          return getApiData(res);
        }
        const res = await postCollectionPipeline(body);
        if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '创建失败'));
        return getApiData(res);
      },
    }),
  });

  registerFunctionCall({
    name: 'collection_pipeline_publish',
    description: '发布采集管道',
    parameters: {
      type: 'object',
      properties: { pipelineId: { type: 'string' }, code: { type: 'string' } },
    },
    handler: async (args) => {
      const id = await resolvePipelineId(args as Record<string, unknown>);
      const res = await postCollectionPipelinePublish(id);
      if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '发布失败'));
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_disable',
    description: '禁用采集管道',
    parameters: {
      type: 'object',
      properties: { pipelineId: { type: 'string' }, code: { type: 'string' } },
    },
    handler: async (args) => {
      const id = await resolvePipelineId(args as Record<string, unknown>);
      const res = await postCollectionPipelineDisable(id);
      if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '禁用失败'));
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_delete',
    description: '删除采集管道',
    parameters: {
      type: 'object',
      properties: { pipelineId: { type: 'string' }, code: { type: 'string' } },
    },
    handler: async (args) => {
      const id = await resolvePipelineId(args as Record<string, unknown>);
      const res = await deleteCollectionPipeline(id);
      if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '删除失败'));
      return { deleted: true, pipelineId: id };
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_get_test_profile',
    description: '获取采集管道测试配置',
    parameters: {
      type: 'object',
      properties: { pipelineId: { type: 'string' }, code: { type: 'string' } },
    },
    handler: async (args) => {
      const id = await resolvePipelineId(args as Record<string, unknown>);
      const res = await getCollectionPipelineTestProfile(id);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'collection_pipeline_run_test',
    description: '执行采集管道测试（存储事务回滚）',
    parameters: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string' },
        code: { type: 'string' },
        rawInput: { type: 'string' },
        runType: { type: 'string', enum: ['test', 'ai_test'] },
      },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'collection_pipeline.test_completed',
      scope: TEST_SURFACE,
      buildResourceId: (args) => String(args.pipelineId || args.code || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const id = await resolvePipelineId(args as Record<string, unknown>);
        try {
          const res = await postCollectionPipelineTest(id, {
            rawInput: args.rawInput as string,
            runType: (args.runType as string) || 'ai_test',
          });
          if (isApiSuccess(res)) {
            const data = getApiData<API.CollectionPipelineTestResult>(res);
            return { success: true, ...data };
          }
          return { success: false, error: getApiErrorMessage(res, '测试失败') };
        } catch (err) {
          return { success: false, error: getApiErrorMessage(err, '测试失败') };
        }
      },
    }),
  });

  registerFunctionCall({
    name: 'collection_pipeline_suggest_scripts',
    description: '将 parse/store 脚本草稿写入当前编辑页（通过 mutation 同步）',
    parameters: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string' },
        parseScript: { type: 'string' },
        storeScript: { type: 'string' },
        targetStructure: { type: 'string' },
      },
      required: ['parseScript', 'storeScript'],
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'collection_pipeline.updated',
      scope: editOrCreateScope,
      buildResourceId: (args) => String(args.pipelineId || ''),
      buildPayload: (args) => ({
        parseScript: args.parseScript,
        storeScript: args.storeScript,
        targetStructure: args.targetStructure,
      }),
      handler: async (args) => ({
        parseScript: args.parseScript,
        storeScript: args.storeScript,
        targetStructure: args.targetStructure,
      }),
    }),
  });

  registerFunctionCall({
    name: 'collection_pipeline_navigate',
    description: '在采集管道 list / test 页面间跳转',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['list', 'test'] },
        pipelineId: { type: 'string' },
      },
      required: ['target'],
    },
    handler: async (args) => {
      const target = args.target as string;
      const id = args.pipelineId as string | undefined;
      const paths: Record<string, string> = {
        list: '/api_services/collection-pipelines',
        test: id ? `/api_services/collection-pipelines/${id}/test` : '/api_services/collection-pipelines',
      };
      history.push(paths[target] || paths.list);
      return { navigated: true, path: paths[target] };
    },
  });
}

export function unregisterCollectionPipelineTools() {
  TOOL_NAMES.forEach((name) => unregisterFunctionCall(name));
}
