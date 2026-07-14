import { registerFunctionCall, unregisterFunctionCall } from '@EADAF/ai-base';
import { createMutatingHandler } from '@/ai/toolMutation';
import { history } from '@/utils/navigation';
import {
  deleteApiService,
  getApiService,
  getApiServiceOperationCatalog,
  getApiServiceTestProfile,
  getApiServiceTree,
  patchApiService,
  postApiService,
  postApiServicePublish,
  postApiServiceSuggestTestParams,
  postApiServiceTest,
  putApiServiceTestMockParams,
} from '@/services/UAC/api/apiServices';
import { getApiData, isApiSuccess } from '@/utils/apiResponse';
import { formatApiServiceTestError, extractApiServiceValidationErrors, isApiServiceTestFailure, describeApiServiceTestFailure } from './apiServiceTestError';
import { normalizeApiServiceCode } from './apiServiceCodeUtils';
import { executeBatchCreateServices, DEFAULT_CRUD_OPERATIONS, type BatchCreateArgs } from './apiServiceBatchCreate';
import { resolveApiServiceConnection } from './apiServiceConnectionResolve';
import { resolveApiServiceId } from './apiServiceResolve';
import { verifyApiServiceById, verifyApiServiceListed, verifyApiServicePublished } from './apiServiceVerify';
import { queryApiServicesForTool } from './apiServiceListQuery';

const API_SERVICE_DOMAIN = 'bizdata';
const LIST_SURFACE = 'api-services.list';
const TEST_SURFACE = 'api-services.test';

const TOOL_NAMES = [
  'apiservice_list_services',
  'apiservice_list_draft_services',
  'apiservice_filter_services',
  'apiservice_get_service',
  'apiservice_resolve_connection',
  'apiservice_create_service',
  'apiservice_create_services_batch',
  'apiservice_update_service',
  'apiservice_publish_service',
  'apiservice_delete_service',
  'apiservice_list_operations',
  'apiservice_get_tree',
  'apiservice_get_test_profile',
  'apiservice_suggest_test_params',
  'apiservice_set_test_params',
  'apiservice_run_test',
  'apiservice_navigate',
] as const;

export function registerApiServiceTools() {
  registerFunctionCall({
    name: 'apiservice_list_services',
    description:
      '列出 API 服务（默认 size=-1 拉全量）。找未发布 draft 时须传 status=draft，或直接用 apiservice_list_draft_services',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: '域前缀，如 fmms（勿传单个服务全 code）' },
        status: { type: 'string', enum: ['draft', 'published', 'disabled'] },
        connectionId: { type: 'string' },
        tag: { type: 'string' },
        page: { type: 'integer' },
        size: { type: 'integer', description: '默认 -1 全量；分页时 total 为匹配总数，returnedCount 为本页条数' },
      },
    },
    handler: async (args) => queryApiServicesForTool(args as Record<string, unknown>),
  });

  registerFunctionCall({
    name: 'apiservice_list_draft_services',
    description:
      '列出未发布(draft)的 API 服务。批量「测试并发布」任务必须先用本 Tool 获取待处理列表，禁止对已是 published 的服务重复 publish',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: '域前缀，如 fmms' },
        tag: { type: 'string' },
        connectionId: { type: 'string' },
      },
    },
    handler: async (args) => {
      const result = await queryApiServicesForTool({
        codePrefix: args.codePrefix as string,
        status: 'draft',
        tag: args.tag as string,
        connectionId: args.connectionId as string,
        size: -1,
      });
      return {
        ...result,
        hint:
          result.items.length === 0
            ? '当前过滤条件下无 draft 服务'
            : `共 ${result.items.length} 个 draft 待发布；仅对这些 code 调用 publish/run_test`,
      };
    },
  });

  registerFunctionCall({
    name: 'apiservice_filter_services',
    description:
      '按 status/codePrefix 过滤 API 服务（等同 list，默认 size=-1）。找 draft 须传 status=draft 或改用 apiservice_list_draft_services',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string', description: 'code 前缀，如 equipment' },
        status: { type: 'string', enum: ['draft', 'published', 'disabled'] },
        tag: { type: 'string', description: '标签精确匹配' },
        connectionId: { type: 'string' },
      },
    },
    handler: async (args) => queryApiServicesForTool(args as Record<string, unknown>),
  });

  registerFunctionCall({
    name: 'apiservice_get_service',
    description: '获取 API 服务详情',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
      },
    },
    handler: async (args) => {
      const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
      const res = await getApiService(serviceId);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'apiservice_resolve_connection',
    description:
      '自动推断 API 服务应使用的数据库连接：仅一个连接时直接返回；多个连接时根据 Scope/Entity 物化记录选择，禁止向用户索要 connectionId',
    parameters: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: '通常无需传入，仅在用户明确指定时使用' },
        scopeCode: { type: 'string', description: 'Scope 引用 code，如 equipment' },
        entityCodes: { type: 'array', items: { type: 'string' }, description: '实体 code 列表' },
        entityIds: { type: 'array', items: { type: 'string' }, description: '实体 ID 列表' },
      },
    },
    handler: async (args) => resolveApiServiceConnection({
      connectionId: args.connectionId as string | undefined,
      scopeCode: args.scopeCode as string | undefined,
      entityCodes: args.entityCodes as string[] | undefined,
      entityIds: args.entityIds as string[] | undefined,
    }),
  });

  registerFunctionCall({
    name: 'apiservice_create_service',
    description:
      '创建单个 API 服务（draft，一次一个主 operation）。code 可基于 entityCode 自动补全；connectionId 可省略',
    requiresVerification: true,
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '域:服务名；可省略，优先使用 scopeCode+serviceSlug' },
        name: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        connectionId: { type: 'string', description: '禁止向用户索要；省略时按 Scope 物化记录自动推断' },
        scopeCode: { type: 'string', description: 'Scope 编码（单选）' },
        serviceSlug: { type: 'string', description: '服务短名，与 scopeCode 组合生成 code' },
        entityCodes: { type: 'array', items: { type: 'string' }, description: '实体 code，用于推断连接' },
        entityIds: { type: 'array', items: { type: 'string' } },
        entityId: { type: 'string' },
        definitionScript: { type: 'string', description: 'scriptMode=sql' },
        handlerScript: { type: 'string', description: 'scriptMode=typescript' },
        scriptMode: { type: 'string', enum: ['sql', 'typescript'] },
        requestParameterInterface: { type: 'string', description: '设计期 TS interface；文件字段须为 storage objectId' },
        accessRestriction: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['none', 'role', 'department'] },
            roleIds: { type: 'array', items: { type: 'string' } },
            departmentIds: { type: 'array', items: { type: 'string' } },
          },
        },
        enabledOperations: {
          type: 'array',
          items: { type: 'string' },
          description: '只传一个主 operation，如 ["find"]。不要一次传 CRUD 全套',
        },
        transportProtocols: {
          type: 'array',
          items: { type: 'string', enum: ['http', 'sse', 'websocket'] },
          description: '访问协议，至少一项，默认 ["http"]',
        },
        publish: { type: 'boolean' },
      },
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.created',
      scope: LIST_SURFACE,
      buildResourceId: (_args, data) => (data as API.ApiService)?.id,
      handler: async (args) => {
        const primaryEntityCode = Array.isArray(args.entityCodes)
          ? String(args.entityCodes[0] || '').trim() || undefined
          : undefined;

        const serviceCode = args.scopeCode && args.serviceSlug
          ? `${String(args.scopeCode).trim()}:${String(args.serviceSlug).trim()}`
          : normalizeApiServiceCode(args.code as string | undefined, {
              entityCode: primaryEntityCode,
              scopeCode: args.scopeCode as string | undefined,
              fallbackName: args.name as string | undefined,
            });

        const enabledOperations = Array.isArray(args.enabledOperations)
          ? (args.enabledOperations as string[]).slice(0, 1)
          : ['find'];

        const resolved = await resolveApiServiceConnection({
          connectionId: args.connectionId as string | undefined,
          scopeCode: args.scopeCode as string | undefined,
          entityCodes: Array.isArray(args.entityCodes) ? (args.entityCodes as string[]) : undefined,
          entityIds: (() => {
            const ids = [
              ...(args.entityId ? [String(args.entityId)] : []),
              ...(Array.isArray(args.entityIds) ? (args.entityIds as string[]) : []),
            ];
            return ids.length ? ids : undefined;
          })(),
        });

        const accessRestriction = args.accessRestriction as API.ApiServiceAccessRestriction | undefined;
        const scriptMode = args.scriptMode === 'typescript' ? 'typescript' : 'sql';

        const createRes = await postApiService({
          scopeCode: args.scopeCode ? String(args.scopeCode) : undefined,
          serviceSlug: args.serviceSlug ? String(args.serviceSlug) : undefined,
          code: args.scopeCode && args.serviceSlug ? undefined : serviceCode,
          name: args.name ? String(args.name) : undefined,
          description: args.description ? String(args.description) : undefined,
          tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
          connectionId: resolved.connectionId,
          entityId: args.entityId ? String(args.entityId) : undefined,
          scriptMode,
          definitionScript:
            scriptMode === 'sql' && args.definitionScript ? String(args.definitionScript) : undefined,
          handlerScript:
            scriptMode === 'typescript' && args.handlerScript ? String(args.handlerScript) : undefined,
          requestParameterInterface: args.requestParameterInterface
            ? String(args.requestParameterInterface)
            : undefined,
          accessRestriction,
          enabledOperations,
          transportProtocols: Array.isArray(args.transportProtocols)
            ? (args.transportProtocols as string[])
            : undefined,
        });
        const created = getApiData<API.ApiService>(createRes);
        if (!created?.id) throw new Error('创建 API 服务失败');

        const result = {
          ...created,
          _normalizedCode: serviceCode,
          _resolvedConnection: resolved,
          _enabledOperations: enabledOperations,
        };

        if (args.publish === true) {
          const pubRes = await postApiServicePublish(created.id, { skipErrorHandler: true });
          const published = getApiData<API.ApiService>(pubRes);
          if (!published?.id) throw new Error('创建成功但发布失败');
          const verified = await verifyApiServicePublished(published.id, serviceCode);
          const listed = await verifyApiServiceListed(verified.code, { expectedStatus: 'published' });
          const allVerified = verified.verified && listed.verified;
          return {
            ...published,
            _resolvedConnection: resolved,
            _verification: {
              ...verified,
              listedInApiList: listed.verified,
              verified: allVerified,
              message: allVerified
                ? verified.message
                : listed.message || verified.message,
            },
          };
        }

        const verified = await verifyApiServiceById(created.id, { expectedCode: serviceCode });
        const listed = await verifyApiServiceListed(verified.code);
        const allVerified = verified.verified && listed.verified;
        return {
          ...result,
          _verification: {
            ...verified,
            listedInApiList: listed.verified,
            verified: allVerified,
            message: `已创建 draft 服务「${serviceCode}」（未发布；发布须 apiservice_publish_service）`,
          },
        };
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_create_services_batch',
    description:
      '批量创建 API 服务（如 CRUD 全套）。每个服务一个 operation；可传 entityCode 自动生成 find/create/updateOne/deleteOne',
    requiresVerification: true,
    parameters: {
      type: 'object',
      properties: {
        entityCode: { type: 'string', description: '实体 code，如 equipment:Device' },
        entityId: { type: 'string' },
        entityCodes: { type: 'array', items: { type: 'string' } },
        scopeCode: { type: 'string', description: '仅用于推断连接' },
        connectionId: { type: 'string', description: '可选，省略时自动推断' },
        operations: {
          type: 'array',
          items: { type: 'string' },
          description: `默认 CRUD: ${DEFAULT_CRUD_OPERATIONS.join(', ')}`,
        },
        namePrefix: { type: 'string', description: '服务显示名称前缀，如「设备资料」' },
        tags: { type: 'array', items: { type: 'string' } },
        publish: { type: 'boolean' },
        services: {
          type: 'array',
          description: '显式服务列表（每项一个 operation），提供时忽略 operations 自动生成',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              name: { type: 'string' },
              operation: { type: 'string' },
              definitionScript: { type: 'string' },
            },
          },
        },
      },
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.batch_created',
      scope: LIST_SURFACE,
      buildPayload: (_args, data) => data,
      handler: async (args) =>
        executeBatchCreateServices({
          connectionId: args.connectionId as string | undefined,
          scopeCode: args.scopeCode as string | undefined,
          entityCode: args.entityCode as string | undefined,
          entityId: args.entityId as string | undefined,
          entityCodes: args.entityCodes as string[] | undefined,
          operations: args.operations as string[] | undefined,
          namePrefix: args.namePrefix as string | undefined,
          tags: args.tags as string[] | undefined,
          publish: args.publish === true,
          services: args.services as BatchCreateArgs['services'],
        }),
    }),
  });

  registerFunctionCall({
    name: 'apiservice_update_service',
    description: '更新 API 服务',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        connectionId: { type: 'string' },
        scopeCode: { type: 'string' },
        serviceSlug: { type: 'string' },
        definitionScript: { type: 'string' },
        handlerScript: { type: 'string' },
        scriptMode: { type: 'string', enum: ['sql', 'typescript'] },
        requestParameterInterface: { type: 'string' },
        accessRestriction: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['none', 'role', 'department'] },
            roleIds: { type: 'array', items: { type: 'string' } },
            departmentIds: { type: 'array', items: { type: 'string' } },
          },
        },
        enabledOperations: { type: 'array', items: { type: 'string' } },
        transportProtocols: {
          type: 'array',
          items: { type: 'string', enum: ['http', 'sse', 'websocket'] },
        },
      },
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.updated',
      buildResourceId: (_args, data) => (data as API.ApiService)?.id,
      handler: async (args) => {
        const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
        const body: Partial<API.ApiServiceCreateInput> = {};
        if (args.name !== undefined) body.name = String(args.name);
        if (args.description !== undefined) body.description = String(args.description);
        if (args.tags !== undefined) body.tags = args.tags as string[];
        if (args.scopeCode !== undefined) body.scopeCode = String(args.scopeCode);
        if (args.serviceSlug !== undefined) body.serviceSlug = String(args.serviceSlug);
        if (args.connectionId !== undefined) body.connectionId = String(args.connectionId);
        if (args.scriptMode !== undefined) {
          body.scriptMode = args.scriptMode === 'typescript' ? 'typescript' : 'sql';
        }
        if (args.definitionScript !== undefined) body.definitionScript = String(args.definitionScript);
        if (args.handlerScript !== undefined) body.handlerScript = String(args.handlerScript);
        if (args.requestParameterInterface !== undefined) {
          body.requestParameterInterface = String(args.requestParameterInterface);
        }
        if (args.accessRestriction !== undefined) {
          body.accessRestriction = args.accessRestriction as API.ApiServiceAccessRestriction;
        }
        if (args.enabledOperations !== undefined) {
          body.enabledOperations = args.enabledOperations as string[];
        }
        if (args.transportProtocols !== undefined) {
          body.transportProtocols = args.transportProtocols as string[];
        }
        const res = await patchApiService(serviceId, body);
        const data = getApiData<API.ApiService>(res);
        if (!data) throw new Error('更新 API 服务失败');
        return data;
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_publish_service',
    description:
      '发布 API 服务（draft→published）。成功后信封须 verified=true 且 status=published；禁止用 run_test 代替本 Tool',
    requiresVerification: true,
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
      },
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.published',
      scope: LIST_SURFACE,
      buildResourceId: (_args, data) => (data as API.ApiService)?.id,
      handler: async (args) => {
        const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
        const code = args.code ? String(args.code).trim() : undefined;
        const before = await verifyApiServiceById(serviceId, { expectedCode: code });

        if (before.status === 'published') {
          return {
            success: false,
            verified: false,
            alreadyPublished: true,
            error: `服务「${before.code}」已是 published，未产生 draft→published 变更。请用 apiservice_list_draft_services 获取待发布列表`,
            serviceId,
            code: before.code,
            status: before.status,
          };
        }

        if (before.status === 'disabled') {
          return {
            success: false,
            verified: false,
            error: `服务「${before.code}」为 disabled，无法直接发布`,
            serviceId,
            code: before.code,
            status: before.status,
          };
        }

        try {
          const pubRes = await postApiServicePublish(serviceId, { skipErrorHandler: true });
          const data = getApiData<API.ApiService>(pubRes);
          if (!data?.id) throw new Error('发布失败：接口未返回服务');
          const verified = await verifyApiServicePublished(data.id, code || data.code);
          const listed = await verifyApiServiceListed(verified.code, { expectedStatus: 'published' });
          return {
            ...data,
            previousStatus: before.status || 'draft',
            _verification: {
              ...verified,
              listedInApiList: listed.verified,
              verified: verified.verified && listed.verified,
              statusTransition: `${before.status || 'draft'}→published`,
              message:
                verified.verified && listed.verified
                  ? verified.message
                  : listed.message || verified.message,
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : '发布失败';
          return {
            success: false,
            verified: false,
            error: message,
            serviceId,
            code: before.code,
            previousStatus: before.status,
          };
        }
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_delete_service',
    description: '删除 API 服务',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
      },
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.deleted',
      scope: LIST_SURFACE,
      buildResourceId: (args) => String(args.serviceId || args.code || ''),
      buildPayload: () => ({ success: true }),
      handler: async (args) => {
        const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
        await deleteApiService(serviceId);
        return { success: true, serviceId };
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_list_operations',
    description: '获取 operation 目录',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const res = await getApiServiceOperationCatalog();
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'apiservice_get_tree',
    description: '获取 API 服务域树；禁止用于实体/API 覆盖率对比',
    parameters: {
      type: 'object',
      properties: {
        codePrefix: { type: 'string' },
      },
    },
    handler: async (args) => {
      const res = await getApiServiceTree({
        codePrefix: args.codePrefix as string,
      });
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'apiservice_get_test_profile',
    description: '获取 API 服务测试上下文（参数结构、mock 参数、请求预览）',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
      },
    },
    handler: async (args) => {
      const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
      const res = await getApiServiceTestProfile(serviceId);
      return getApiData(res);
    },
  });

  registerFunctionCall({
    name: 'apiservice_suggest_test_params',
    description: '为指定 operation 生成 mock 测试参数，并同步到测试弹窗',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
        operation: { type: 'string', description: '如 find、create、updateOne' },
      },
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.test_params.suggested',
      scope: TEST_SURFACE,
      buildResourceId: (args) => String(args.serviceId || args.code || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
        const res = await postApiServiceSuggestTestParams(serviceId, {
          operation: args.operation as string | undefined,
        });
        const data = getApiData<API.ApiServiceSuggestTestParamsResult>(res);
        if (!data) throw new Error('生成模拟参数失败');
        return data;
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_set_test_params',
    description: '保存并同步 mock 测试参数到测试页（持久化到服务配置，按 operation 存储）',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
        operation: { type: 'string', description: '必填，如 create、find' },
        parameters: { type: 'object', description: '完整 mock 参数 JSON 对象' },
        mockParameters: { type: 'object', description: '同 parameters，二选一' },
      },
      required: ['operation'],
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.test_params.set',
      scope: TEST_SURFACE,
      buildResourceId: (args) => String(args.serviceId || args.code || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
        const operation = args.operation ? String(args.operation).trim() : '';
        if (!operation) {
          throw new Error('operation 必填');
        }
        const mockParameters = (args.parameters || args.mockParameters) as Record<string, unknown> | undefined;
        if (!mockParameters || typeof mockParameters !== 'object') {
          throw new Error('parameters / mockParameters 必须为对象');
        }
        const res = await putApiServiceTestMockParams(serviceId, { operation, mockParameters });
        if (!isApiSuccess(res)) {
          throw new Error(formatApiServiceTestError(res, '保存模拟参数失败'));
        }
        const data = getApiData<API.ApiServiceSaveTestMockParamsResult>(res);
        return {
          operation,
          mockParameters: data?.mockParameters || mockParameters,
          saved: true,
        };
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_run_test',
    description: '使用指定 operation 与 parameters 执行 API 服务测试（写操作事务回滚）；结果同步到测试页',
    requiresVerification: true,
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        code: { type: 'string' },
        operation: { type: 'string' },
        parameters: { type: 'object', description: '测试参数 JSON' },
      },
      required: ['operation'],
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.test_completed',
      scope: TEST_SURFACE,
      buildResourceId: (args) => String(args.serviceId || args.code || ''),
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const serviceId = await resolveApiServiceId(args as Record<string, unknown>);
        const code = args.code ? String(args.code).trim() : undefined;
        if (code) {
          await verifyApiServiceListed(code);
        }
        try {
          const res = await postApiServiceTest(
            serviceId,
            {
              operation: args.operation as string,
              parameters: (args.parameters as Record<string, unknown>) || {},
            },
            { skipErrorHandler: true },
          );
          if (isApiSuccess(res)) {
            const data = getApiData<API.ApiServiceTestResult>(res);
            if (!data) throw new Error('测试请求失败');
            const failureMessage = describeApiServiceTestFailure(data);
            if (isApiServiceTestFailure(data)) {
              return {
                success: false,
                verified: false,
                error: failureMessage || '测试未通过',
                ...data,
              };
            }
            const parameters = (args.parameters as Record<string, unknown>) || {};
            const operation = String(args.operation || data.operation || '');
            let savedMockParameters = data.savedMockParameters;
            if (
              data.executable !== false
              && operation
              && Object.keys(parameters).length > 0
              && !savedMockParameters
            ) {
              const saveRes = await putApiServiceTestMockParams(serviceId, {
                operation,
                mockParameters: parameters,
              });
              if (isApiSuccess(saveRes)) {
                const saved = getApiData<API.ApiServiceSaveTestMockParamsResult>(saveRes);
                savedMockParameters = saved?.mockParameters || parameters;
              }
            }
            return {
              success: true,
              verified: true,
              ...data,
              mockParametersSaved: data.mockParametersSaved ?? Boolean(savedMockParameters),
              savedMockParameters: savedMockParameters || parameters,
              operation: operation || data.operation,
            };
          }
          const error = formatApiServiceTestError(res);
          return {
            success: false,
            verified: false,
            error,
            validationErrors: extractApiServiceValidationErrors(res),
          };
        } catch (err) {
          return {
            success: false,
            error: formatApiServiceTestError(err),
            validationErrors: extractApiServiceValidationErrors(err),
          };
        }
      },
    }),
  });

  registerFunctionCall({
    name: 'apiservice_navigate',
    description: '在 API 服务相关页面间跳转：list / test；可携带 autoRunTest 返回测试页后自动重测',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['list', 'test'], description: '目标页面' },
        serviceId: { type: 'string' },
        code: { type: 'string' },
        autoRunTest: { type: 'boolean', description: '跳转到 test 页后是否自动执行测试' },
        fixContext: {
          type: 'object',
          description: '传递给测试页的修复上下文，如 { errorMessage }',
        },
      },
      required: ['target'],
    },
    handler: createMutatingHandler({
      domain: API_SERVICE_DOMAIN,
      type: 'apiservice.navigate',
      buildPayload: (_args, data) => data,
      handler: async (args) => {
        const target = String(args.target || 'list');
        let resolvedServiceId: string | undefined;
        if (args.serviceId || args.code) {
          resolvedServiceId = await resolveApiServiceId(args as Record<string, unknown>);
        }
        let path = '/api_services/list';
        if (target === 'test' && resolvedServiceId) {
          path = `/api_services/${resolvedServiceId}/test`;
        } else if (target !== 'list' && !resolvedServiceId) {
          throw new Error('跳转到 test 需要提供 serviceId 或 code');
        }

        const payload = {
          target,
          serviceId: resolvedServiceId,
          path,
          autoRunTest: args.autoRunTest === true,
          fixContext: args.fixContext as Record<string, unknown> | undefined,
        };

        history.push(path, {
          autoRunTest: payload.autoRunTest,
          fixContext: payload.fixContext,
          fromAutoFix: true,
        });

        return payload;
      },
    }),
  });
}

export function unregisterApiServiceTools() {
  TOOL_NAMES.forEach((name) => unregisterFunctionCall(name));
}
