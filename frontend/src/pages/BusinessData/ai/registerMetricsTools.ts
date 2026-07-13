import { registerFunctionCall, unregisterFunctionCall } from '@EADAF/ai-base';
import { createMutatingHandler } from '@/ai/toolMutation';
import { history } from '@/utils/navigation';
import {
  deleteBizdataMetric,
  getBizdataMetric,
  getBizdataMetricRuns,
  getBizdataMetricValue,
  getBizdataMetricValues,
  getBizdataMetrics,
  getBizdataMetricsDashboard,
  patchBizdataMetric,
  postBizdataMetric,
  postBizdataMetricExecute,
  postBizdataMetricExecuteBatch,
} from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

const DOMAIN = 'bizdata';
const LIST_SURFACE = 'bizdata.metrics.list';
const CREATE_SURFACE = 'bizdata.metrics.create';
const EDIT_SURFACE = 'bizdata.metrics.edit';
const DASHBOARD_SURFACE = 'bizdata.metrics.dashboard';

function editOrCreateScope(args: Record<string, unknown>) {
  return args.metricId ? EDIT_SURFACE : CREATE_SURFACE;
}

const TOOL_NAMES = [
  'bizdata_metric_list',
  'bizdata_metric_filter',
  'bizdata_metric_get',
  'bizdata_metric_upsert',
  'bizdata_metric_delete',
  'bizdata_metric_execute',
  'bizdata_metric_execute_batch',
  'bizdata_metric_list_runs',
  'bizdata_metric_list_values',
  'bizdata_metric_get_value',
  'bizdata_metric_get_dashboard',
  'bizdata_metric_suggest_definition',
  'bizdata_metric_navigate',
] as const;

async function resolveMetricId(args: Record<string, unknown>) {
  if (args.metricId) return String(args.metricId);
  const code = String(args.code || '').trim();
  if (code) {
    const res = await getBizdataMetrics({ codePrefix: code, size: 100 });
    const data = getApiData<API.BizdataMetricList>(res);
    const exact = data?.items?.find((item) => item.code === code);
    if (exact?.id) return exact.id;
    if (data?.items?.length === 1 && data.items[0]?.id) return data.items[0].id!;
  }
  throw new Error('请提供 metricId 或 code，或在 Surface 上下文中操作');
}

export function registerMetricsTools() {
  registerFunctionCall({
    name: 'bizdata_metric_list',
    description: '列出业务指标，可按 code 前缀、状态过滤',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: '如 sales 或 sales:order' },
        status: { type: 'string', enum: ['enabled', 'disabled'] },
        page: { type: 'integer' },
        size: { type: 'integer' },
      },
    },
    handler: async (args) => {
      const res = await getBizdataMetrics({
        codePrefix: args.codePrefix as string,
        status: args.status as string,
        page: args.page as number,
        size: args.size as number,
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_metric_filter',
    description: '按页面过滤项检索指标（code 前缀 + 状态），返回全部命中项；面向检索而非分页浏览',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: 'code 前缀，如 sales 或 sales:order' },
        status: { type: 'string', enum: ['enabled', 'disabled'] },
      },
    },
    handler: async (args) => {
      const res = await getBizdataMetrics({
        codePrefix: args.codePrefix as string,
        status: args.status as string,
        size: -1,
      });
      const data = getApiData<API.BizdataMetricList>(res);
      return { items: data?.items || [], total: data?.items?.length || 0 };
    },
  });

  registerFunctionCall({
    name: 'bizdata_metric_get',
    description: '获取指标详情（SQL、公式、调度等）',
    parameters: {
      type: 'object',
      properties: {
        metricId: { type: 'string' },
        code: { type: 'string' },
      },
    },
    handler: async (args) => {
      const id = await resolveMetricId(args as Record<string, unknown>);
      const res = await getBizdataMetric(id);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_metric_upsert',
    description: '创建或更新业务指标（SQL 聚合或复合公式）',
    parameters: {
      type: 'object',
      // code 与 label 必填，与指标管理页表单一致：
      // 列表页用 CodePathTreeTable 按冒号分层 code 渲染，空 code 的指标会被树丢弃而"消失"。
      required: ['code', 'label', 'metricType'],
      properties: {
        metricId: { type: 'string' },
        code: {
          type: 'string',
          description: '指标编码，建议用冒号分层（如 web:user:total_count），列表页按此分层展示',
        },
        label: { type: 'string', description: '指标名称' },
        description: { type: 'string' },
        metricType: { type: 'string', enum: ['sql', 'formula'] },
        connectionId: { type: 'string' },
        queryScript: { type: 'string' },
        formulaConfig: { type: 'object' },
        computeMode: { type: 'string', enum: ['scheduled', 'on_demand', 'both'] },
        scheduleType: { type: 'string', enum: ['manual', 'hourly', 'daily', 'cron'] },
        scheduleConfig: { type: 'object' },
        unit: { type: 'string' },
        status: { type: 'string', enum: ['enabled', 'disabled'] },
      },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'metric.updated',
      scope: editOrCreateScope,
      buildResourceId: (args) => String(args.metricId || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const body: Partial<API.BizdataMetric> = {
          code: args.code as string,
          label: args.label as string,
          description: args.description as string,
          metricType: args.metricType as API.BizdataMetric['metricType'],
          connectionId: args.connectionId as string,
          queryScript: args.queryScript as string,
          formulaConfig: args.formulaConfig as API.BizdataMetric['formulaConfig'],
          computeMode: args.computeMode as API.BizdataMetric['computeMode'],
          scheduleType: args.scheduleType as API.BizdataMetric['scheduleType'],
          scheduleConfig: args.scheduleConfig as API.BizdataMetric['scheduleConfig'],
          unit: args.unit as string,
          status: args.status as API.BizdataMetric['status'],
        };
        if (args.metricId) {
          const res = await patchBizdataMetric(String(args.metricId), body);
          if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '更新失败'));
          return getApiData(res);
        }
        const res = await postBizdataMetric(body);
        if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '创建失败'));
        return getApiData(res);
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_metric_delete',
    description: '删除业务指标',
    parameters: {
      type: 'object',
      properties: { metricId: { type: 'string' }, code: { type: 'string' } },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'metric.deleted',
      scope: LIST_SURFACE,
      buildResourceId: (args) => String(args.metricId || args.code || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const id = await resolveMetricId(args as Record<string, unknown>);
        const res = await deleteBizdataMetric(id);
        if (!isApiSuccess(res)) throw new Error(getApiErrorMessage(res, '删除失败'));
        return { deleted: true, metricId: id };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_metric_execute',
    description: '手动执行单个指标计算',
    parameters: {
      type: 'object',
      properties: { metricId: { type: 'string' }, code: { type: 'string' } },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'metric.executed',
      scope: (args) => String(args.metricId || args.code || LIST_SURFACE),
      buildResourceId: (args) => String(args.metricId || args.code || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const id = await resolveMetricId(args as Record<string, unknown>);
        const res = await postBizdataMetricExecute(id);
        if (!isApiSuccess(res)) {
          return { success: false, error: getApiErrorMessage(res, '执行失败') };
        }
        const data = getApiData<Record<string, unknown>>(res);
        return { success: true, ...data };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_metric_execute_batch',
    description: '按 code 前缀批量执行指标（公式指标须依赖项已有结果）',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: '如 sales 或 sales:order' },
      },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'metric.executed',
      scope: LIST_SURFACE,
      buildResourceId: (args) => String(args.codePrefix || 'batch'),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const res = await postBizdataMetricExecuteBatch({
          codePrefix: args.codePrefix as string,
        });
        if (!isApiSuccess(res)) {
          return { success: false, error: getApiErrorMessage(res, '批量执行失败') };
        }
        return { success: true, ...getApiData(res) };
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_metric_list_runs',
    description: '分页获取指标执行记录',
    parameters: {
      type: 'object',
      properties: {
        metricId: { type: 'string' },
        code: { type: 'string' },
        page: { type: 'integer' },
        size: { type: 'integer' },
      },
    },
    handler: async (args) => {
      const id = await resolveMetricId(args as Record<string, unknown>);
      const res = await getBizdataMetricRuns(id, {
        page: args.page as number,
        size: args.size as number,
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_metric_list_values',
    description: '分页获取指标历史计算值',
    parameters: {
      type: 'object',
      properties: {
        metricId: { type: 'string' },
        code: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        dimensionKey: { type: 'string' },
        page: { type: 'integer' },
        size: { type: 'integer' },
      },
    },
    handler: async (args) => {
      const id = await resolveMetricId(args as Record<string, unknown>);
      const res = await getBizdataMetricValues(id, {
        from: args.from as string,
        to: args.to as string,
        dimensionKey: args.dimensionKey as string,
        page: args.page as number,
        size: args.size as number,
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_metric_get_value',
    description: '获取指标最新值（可选 refresh=true 先执行再读）',
    parameters: {
      type: 'object',
      properties: {
        metricId: { type: 'string' },
        code: { type: 'string' },
        refresh: { type: 'boolean' },
      },
    },
    handler: async (args) => {
      const id = await resolveMetricId(args as Record<string, unknown>);
      const res = await getBizdataMetricValue(id, args.refresh === true);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'bizdata_metric_get_dashboard',
    description: '获取指标看板（按 category 分组）',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string' },
        refresh: { type: 'boolean', description: '为 true 时先刷新各指标再返回' },
      },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'metric.dashboard_refreshed',
      scope: DASHBOARD_SURFACE,
      buildResourceId: () => 'dashboard',
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const res = await getBizdataMetricsDashboard({
          codePrefix: args.codePrefix as string,
          refresh: args.refresh === true,
        });
        return getApiData(res);
      },
    }),
  });

  registerFunctionCall({
    name: 'bizdata_metric_suggest_definition',
    description: '将 AI 生成的 SQL / 公式配置同步到当前指标编辑页（mutation）',
    parameters: {
      type: 'object',
      properties: {
        metricId: { type: 'string' },
        queryScript: { type: 'string' },
        formulaConfig: { type: 'object' },
        description: { type: 'string' },
        unit: { type: 'string' },
      },
    },
    handler: createMutatingHandler({
      domain: DOMAIN,
      type: 'metric.updated',
      scope: editOrCreateScope,
      buildResourceId: (args) => String(args.metricId || ''),
      buildPayload: (args) => ({
        queryScript: args.queryScript,
        formulaConfig: args.formulaConfig,
        description: args.description,
        unit: args.unit,
      }),
      handler: async (args) => ({
        queryScript: args.queryScript,
        formulaConfig: args.formulaConfig,
        description: args.description,
        unit: args.unit,
      }),
    }),
  });

  registerFunctionCall({
    name: 'bizdata_metric_navigate',
    description: '在指标 list / dashboard 页面间跳转',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['list', 'dashboard'] },
        metricId: { type: 'string' },
      },
      required: ['target'],
    },
    handler: async (args) => {
      const target = args.target as string;
      const id = args.metricId as string | undefined;
      const paths: Record<string, string> = {
        list: '/business_data/metrics',
        dashboard: '/business_data/metrics/dashboard',
      };
      history.push(paths[target] || paths.list);
      return { navigated: true, path: paths[target] };
    },
  });
}

export function unregisterMetricsTools() {
  TOOL_NAMES.forEach((name) => unregisterFunctionCall(name));
}
