/**
 * 将应用的公开 API 目录（getPublicApiCatalog 结果）转换为 OpenAPI 3.0 JSON。
 *
 * 用途：供 AI / 第三方工具直接 GET 机器可读的接口契约，
 * 替代抓取 api-docs HTML 页面（更快、更准、不依赖渲染）。
 *
 * 覆盖范围：
 * - 业务 API 服务（services[].operations[]）
 * - 内置 API（builtinApis[]）
 * - 采集 API（collectionApis[]，POST /api/v1/ingest/...）
 *
 * 明确不包含：outboundWebhooks（提交外部 API，仅公开文档独立页展示）。
 *
 * 路径合并规则：业务 API 用 basePath + routePattern；内置 API 用 routePath；采集 API 用 basePath。
 * 若同一 path + method 出现多次（不同 service），用 service code 做后缀去重，
 * 避免覆盖。
 */
const { getPublicApiCatalog } = require('./applicationApiCatalogService');
const businessDataService = require('./businessData/businessDataService');
const {
  resolveResponsesSchema,
  buildEntitySchemaResolver,
} = require('./apiService/operationParameterSchemas');

const VALID_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']);

/** 把任意路径规范化为以 / 开头、无多余斜杠的形式 */
function normalizePath(path) {
  const p = String(path || '').trim();
  if (!p) return '/';
  return `/${p.split('/').filter(Boolean).join('/')}`;
}

/** Express `:id` → OpenAPI `{id}` */
function toOpenApiPath(path) {
  return normalizePath(path).replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
}

function extractPathParamNames(routePattern = '') {
  return new Set(
    String(routePattern || '')
      .match(/:[A-Za-z_][A-Za-z0-9_]*/g)
      ?.map((token) => token.slice(1)) || [],
  );
}

function buildPathParameter(name, propSchema, requestExample) {
  const prop = propSchema && typeof propSchema === 'object' ? propSchema : {};
  const exampleFromRequest = requestExample && Object.prototype.hasOwnProperty.call(requestExample, name)
    ? requestExample[name]
    : undefined;
  const resolvedExample = exampleFromRequest !== undefined ? exampleFromRequest : prop.example;
  const paramSchema = { type: prop.type || 'string' };
  if (prop.format) paramSchema.format = prop.format;
  else if (name === 'id') paramSchema.format = 'uuid';
  if (prop.description) paramSchema.description = prop.description;
  if (resolvedExample != null) paramSchema.example = resolvedExample;
  const param = {
    name,
    in: 'path',
    required: true,
    schema: paramSchema,
  };
  if (prop.description) param.description = prop.description;
  if (resolvedExample != null) param.example = resolvedExample;
  return param;
}

/** HTTP method 决定参数来源：GET/HEAD/DELETE 的参数在 URL query string，无 request body */
const QUERY_ONLY_METHODS = new Set(['get', 'head', 'delete']);

/** 传输协议的人类可读标签 */
const TRANSPORT_LABELS = {
  http: 'REST (HTTP)',
  sse: 'SSE 流式',
  websocket: 'WebSocket',
};

/** 把传输协议数组转为可读字符串，用于拼到 description */
function describeTransportProtocols(protocols) {
  const list = Array.isArray(protocols) ? protocols.filter(Boolean) : [];
  if (!list.length) return '';
  const labels = list.map((p) => TRANSPORT_LABELS[String(p).toLowerCase()] || String(p).toUpperCase());
  return `协议: ${labels.join(' / ')}`;
}

/**
 * 将运行时参数 JSON Schema 映射为 OpenAPI parameters / requestBody。
 *
 * 关键规则（HTTP 语义）：
 * - GET / HEAD / DELETE：参数在 URL query string（path 参数除外），**不生成 requestBody**。
 *   将对象 schema 的 properties 逐项拆为 `in: 'query'` 参数。
 * - POST / PUT / PATCH：对象 schema 作为 `requestBody`（application/json）。
 * - path 参数（出现在 routePattern 中的 :id / :field）：标记为 `in: 'path'`。
 *
 * @param {object} parametersSchema 运行时参数 JSON Schema
 * @param {string} method 小写 HTTP method（get/post/put/...）
 * @param {string} routePattern 路由模式（如 ''、'/:id'、'/distinct/:field'），用于识别 path 参数
 */
function buildParametersAndBody(parametersSchema, method, routePattern = '', requestExample) {
  const result = { parameters: [], requestBody: undefined };
  if (!parametersSchema || typeof parametersSchema !== 'object') return result;

  const schema = parametersSchema;
  const type = schema.type || (schema.properties ? 'object' : undefined);
  const isQueryMethod = QUERY_ONLY_METHODS.has(String(method || 'get'));
  const pathParamNames = extractPathParamNames(routePattern);

  // GET / HEAD / DELETE：对象 schema 的 properties 拆为 query / path 参数，不生成 body
  if (isQueryMethod && type === 'object' && schema.properties) {
    Object.entries(schema.properties).forEach(([name, propSchema]) => {
      const prop = propSchema && typeof propSchema === 'object' ? propSchema : {};
      const inPath = pathParamNames.has(name) ? 'path' : 'query';
      const required = inPath === 'path' || Boolean(schema.required?.includes(name));
      const exampleFromRequest = requestExample && Object.prototype.hasOwnProperty.call(requestExample, name)
        ? requestExample[name]
        : undefined;
      const resolvedExample = exampleFromRequest !== undefined ? exampleFromRequest : prop.example;
      const paramSchema = { type: prop.type || 'string' };
      if (prop.format) paramSchema.format = prop.format;
      if (prop.minimum != null) paramSchema.minimum = prop.minimum;
      if (prop.maximum != null) paramSchema.maximum = prop.maximum;
      if (prop.default != null) paramSchema.default = prop.default;
      if (prop.description) paramSchema.description = prop.description;
      if (resolvedExample != null) paramSchema.example = resolvedExample;
      if (prop.type === 'object') {
        paramSchema.properties = prop.properties || {};
        paramSchema.additionalProperties = prop.additionalProperties !== false;
      } else if (prop.type === 'array' && prop.items) {
        paramSchema.items = prop.items;
      }
      const param = {
        name,
        in: inPath,
        required,
        schema: paramSchema,
      };
      if (prop.description) param.description = prop.description;
      if (resolvedExample != null) param.example = resolvedExample;
      result.parameters.push(param);
    });
    // routePattern 声明了但 schema 未列的 path 参数（兜底）
    pathParamNames.forEach((name) => {
      if (result.parameters.some((p) => p.name === name && p.in === 'path')) return;
      result.parameters.push(buildPathParameter(name, { type: 'string' }, requestExample));
    });
    return result;
  }

  // POST / PUT / PATCH：path 参数 + 其余字段作为 requestBody
  if (type === 'object' && schema.properties) {
    pathParamNames.forEach((name) => {
      result.parameters.push(
        buildPathParameter(name, schema.properties[name] || { type: 'string' }, requestExample),
      );
    });

    const bodyProperties = { ...schema.properties };
    pathParamNames.forEach((name) => {
      delete bodyProperties[name];
    });
    const bodyRequired = Array.isArray(schema.required)
      ? schema.required.filter((name) => !pathParamNames.has(name) && bodyProperties[name])
      : undefined;

    if (Object.keys(bodyProperties).length > 0) {
      const bodySchema = {
        ...schema,
        properties: bodyProperties,
        ...(bodyRequired?.length ? { required: bodyRequired } : { required: undefined }),
      };
      if (!bodyRequired?.length) delete bodySchema.required;

      let bodyExample;
      if (requestExample && typeof requestExample === 'object' && !Array.isArray(requestExample)) {
        bodyExample = { ...requestExample };
        pathParamNames.forEach((name) => {
          delete bodyExample[name];
        });
      }

      const mediaType = { schema: bodySchema };
      if (bodyExample && Object.keys(bodyExample).length) {
        mediaType.example = bodyExample;
      }
      result.requestBody = {
        required: true,
        content: {
          'application/json': mediaType,
        },
      };
    }
    return result;
  }

  // 非 object：尝试作为单个 query 参数
  if (schema.name || schema.description) {
    result.parameters.push({
      name: schema.name || 'value',
      in: 'query',
      required: Boolean(schema.required),
      schema: { type: schema.type || 'string' },
      ...(schema.description ? { description: schema.description } : {}),
    });
  }

  return result;
}

function buildOperationObject({
  operationId,
  summary,
  description,
  method,
  parametersSchema,
  routePattern,
  requestExample,
  tags,
  transportProtocols,
  responseSchema,
  responsesSchema,
}) {
  const { parameters, requestBody } = buildParametersAndBody(
    parametersSchema,
    method,
    routePattern,
    requestExample,
  );

  // 把协议信息拼到 description，确保人类可读（REST/SSE/WebSocket + HTTP method 语义）
  const methodUpper = String(method || 'get').toUpperCase();
  const transportDesc = describeTransportProtocols(transportProtocols);
  const methodSemantics = QUERY_ONLY_METHODS.has(String(method || 'get'))
    ? '参数通过 URL query string 传递，无 request body'
    : '参数通过 request body (application/json) 传递';
  const descParts = [description, `${methodUpper}: ${methodSemantics}`, transportDesc].filter(Boolean);
  // 异常响应统一放到文档根的 /exceptionResponses，operation 仅做提示
  descParts.push('异常响应信息请阅读本文档的 /exceptionResponses');
  const fullDescription = descParts.join(' · ');

  const resolvedResponses = responsesSchema && typeof responsesSchema === 'object'
    ? {
      ...responsesSchema,
      default: responsesSchema.default || {
        description: '异常响应（401/403/404/409/500 等），详细信息请阅读本文档根的 /exceptionResponses',
      },
    }
    : {
      200: {
        description: '成功响应',
        content: { 'application/json': { schema: responseSchema || { type: 'object' } } },
      },
      default: {
        description: '异常响应（401/403/404/409/500 等），详细信息请阅读本文档根的 /exceptionResponses',
      },
    };

  // 组装 responses：200 成功响应 + 一个异常响应引用提示（详细异常见文档根）
  const op = {
    tags: tags || [],
    summary: summary || '',
    description: fullDescription,
    operationId,
    responses: resolvedResponses,
  };
  if (parameters.length) op.parameters = parameters;
  if (requestBody) op.requestBody = requestBody;
  // 协议类型（REST/SSE/WebSocket）作为 OpenAPI 扩展字段，便于工具识别
  if (transportProtocols && transportProtocols.length) {
    op['x-transportProtocols'] = transportProtocols;
  }
  return op;
}

/**
 * 生成 OpenAPI 3.0 文档。
 * @param {string} applicationKey 应用 code 或 application_id
 * @returns {Promise<object>} OpenAPI 3.0 JSON 对象
 */
async function getPublicApiOpenApi(applicationKey) {
  const catalog = await getPublicApiCatalog(applicationKey);
  const {
    application,
    services = [],
    builtinApis = [],
    collectionApis = [],
    exceptionResponses = [],
  } = catalog;

  const paths = {};
  // 记录 (path, method) 去重，已占用时给 operationId 加后缀
  const usedOpIds = new Set();
  const usedPathMethods = new Set();

  const entityByCode = new Map();
  const { items: entities = [] } = await businessDataService.listEntities({ size: 200 });
  entities.forEach((entity) => {
    if (entity?.code) entityByCode.set(entity.code, entity);
  });
  const resolveEntitySchema = buildEntitySchemaResolver(entityByCode);

  const registerOperation = (path, methodLower, opObject) => {
    const key = `${methodLower} ${path}`;
    if (!paths[path]) paths[path] = {};
    if (usedPathMethods.has(key)) {
      // 同 path+method 冲突：加序号后缀路径，避免覆盖
      let i = 2;
      let altPath = `${path}__${i}`;
      // eslint-disable-next-line no-loop-func
      while (usedPathMethods.has(`${methodLower} ${altPath}`)) {
        i += 1;
        altPath = `${path}__${i}`;
      }
      usedPathMethods.add(`${methodLower} ${altPath}`);
      paths[altPath] = paths[altPath] || {};
      paths[altPath][methodLower] = opObject;
      return;
    }
    usedPathMethods.add(key);
    paths[path][methodLower] = opObject;
  };

  const ensureUniqueOpId = (base) => {
    if (!usedOpIds.has(base)) {
      usedOpIds.add(base);
      return base;
    }
    let i = 2;
    let candidate = `${base}_${i}`;
    while (usedOpIds.has(candidate)) {
      i += 1;
      candidate = `${base}_${i}`;
    }
    usedOpIds.add(candidate);
    return candidate;
  };

  // 1. 业务 API 服务
  for (const service of services) {
    const basePath = normalizePath(service.basePath);
    const ops = service.operations || [];
    const tag = service.name || service.code;
    for (const op of ops) {
      const methodRaw = String(op.httpMethod || 'get').toLowerCase();
      if (!VALID_METHODS.has(methodRaw)) continue;
      const fullPath = toOpenApiPath(`${basePath}/${op.routePattern || ''}`);
      const opId = ensureUniqueOpId(`${service.code}_${op.operation}`);
      const opObject = buildOperationObject({
        operationId: opId,
        summary: op.label || op.operation,
        description: op.category ? `Category: ${op.category}` : undefined,
        method: methodRaw,
        parametersSchema: op.parametersSchema,
        routePattern: op.routePattern,
        requestExample: op.requestExample || op.mockParameters,
        tags: [tag],
        transportProtocols: service.transportProtocols,
        responseSchema: op.responseSchema,
        responsesSchema: op.responsesSchema
          ? resolveResponsesSchema(op.responsesSchema, resolveEntitySchema)
          : undefined,
      });
      // 兼容说明：亦可用 POST + body 传 path 参数（如 id）
      if (['delete', 'patch', 'put'].includes(methodRaw) && String(op.routePattern || '').includes(':')) {
        opObject.description = [
          opObject.description,
          '亦兼容 POST 到服务 basePath（无 path 后缀），在 JSON body 中传 path 参数（如 id）',
        ].filter(Boolean).join(' · ');
      }
      registerOperation(fullPath, methodRaw, opObject);
    }
  }

  // 2. 内置 API（请求/响应来自路由 swagger 注释）
  for (const api of builtinApis) {
    const ops = Array.isArray(api.operations) && api.operations.length
      ? api.operations
      : (api.httpMethods && api.httpMethods.length ? api.httpMethods : ['GET']).map((m) => ({
        httpMethod: m,
        routePattern: api.routePath,
      }));
    for (const op of ops) {
      const methodLower = String(op.httpMethod || 'get').toLowerCase();
      if (!VALID_METHODS.has(methodLower)) continue;
      const fullPath = toOpenApiPath(op.routePattern || api.routePath);
      const opId = ensureUniqueOpId(`builtin_${api.code}_${methodLower}`);
      const opObject = buildOperationObject({
        operationId: opId,
        summary: op.label || api.label || api.code,
        description: api.description,
        method: methodLower,
        parametersSchema: op.parametersSchema,
        routePattern: op.routePattern,
        requestExample: op.requestExample,
        tags: [api.domain ? `内置 API / ${api.domain}` : '内置 API'],
        responseSchema: op.responseSchema,
      });
      registerOperation(fullPath, methodLower, opObject);
    }
  }

  // 3. 采集 API（采集管道 ingest）
  for (const api of collectionApis) {
    const fullPath = normalizePath(api.basePath || `/api/v1/ingest/${api.routePath || ''}`);
    const opId = ensureUniqueOpId(`ingest_${api.code}_post`);
    const descParts = [
      api.description,
      api.protocolType ? `协议: ${api.protocolType}` : '',
      api.entityCode ? `目标实体: ${api.entityCode}` : '',
      api.authHint,
      api.bodyHint,
      '异常响应信息请阅读本文档的 /exceptionResponses',
    ].filter(Boolean);

    const textPlain = {
      schema: { type: 'string', description: '原始采集报文（plain text）' },
    };
    if (api.sampleData) {
      textPlain.example = api.sampleData;
    }

    const opObject = {
      tags: ['采集 API'],
      summary: api.label || api.name || api.code,
      description: descParts.join(' · '),
      operationId: opId,
      requestBody: {
        required: true,
        content: {
          'text/plain': textPlain,
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary', description: '二进制采集报文' },
          },
        },
      },
      responses: {
        200: {
          description: '数据采集成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  code: { type: 'integer', example: 200 },
                  message: { type: 'string', example: '数据采集成功' },
                  data: {
                    type: 'object',
                    properties: {
                      runId: { type: 'string', format: 'uuid' },
                      pipelineId: { type: 'string', format: 'uuid' },
                      code: { type: 'string' },
                      runType: { type: 'string', example: 'ingest' },
                      inputRaw: { type: 'string' },
                      parseOutput: { type: 'object', additionalProperties: true },
                      storeOutput: { type: 'object', additionalProperties: true },
                      durationMs: { type: 'integer' },
                      rolledBack: { type: 'boolean' },
                      status: { type: 'string', example: 'success' },
                    },
                  },
                },
              },
              ...(api.responseExample ? { example: api.responseExample } : {}),
            },
          },
        },
        default: {
          description: '异常响应（401/403/404/409/500 等），详细信息请阅读本文档根的 /exceptionResponses',
        },
      },
      'x-eadaf-api-kind': 'collection-ingest',
      'x-eadaf-pipeline-code': api.code,
    };
    if (api.targetStructure) {
      opObject['x-eadaf-target-structure'] = api.targetStructure;
    }
    if (api.responseInterface) {
      opObject['x-eadaf-response-interface'] = api.responseInterface;
    }
    registerOperation(fullPath, 'post', opObject);
  }

  // 聚合所有已用 tag，去重后生成 tags 声明
  const tagNames = Array.from(
    new Set(
      Object.values(paths).flatMap((methods) =>
        Object.values(methods).flatMap((op) => op.tags || []),
      ),
    ),
  );

  return {
    openapi: '3.0.3',
    info: {
      title: `${application.name || application.code} API`,
      description: application.description || `${application.name || application.code} 已授权可访问的 API（OpenAPI 自动生成）`,
      version: '1.0.0',
    },
    tags: tagNames.map((name) => ({ name })),
    paths,
    // 全局共享的异常响应模板（所有 API 通用），每个 operation 仅提示参见此处
    exceptionResponses,
  };
}

module.exports = {
  getPublicApiOpenApi,
  buildParametersAndBody,
  buildOperationObject,
  normalizePath,
  toOpenApiPath,
};
