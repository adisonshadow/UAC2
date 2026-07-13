/**
 * 将应用的公开 API 目录（getPublicApiCatalog 结果）转换为 OpenAPI 3.0 JSON。
 *
 * 用途：供 AI / 第三方工具直接 GET 机器可读的接口契约，
 * 替代抓取 api-docs HTML 页面（更快、更准、不依赖渲染）。
 *
 * 覆盖范围：
 * - 业务 API 服务（services[].operations[]）
 * - 内置 API（builtinApis[]）
 *
 * 路径合并规则：业务 API 用 basePath + routePattern；内置 API 用 routePath。
 * 若同一 path + method 出现多次（不同 service），用 service code 做后缀去重，
 * 避免覆盖。
 */
const { getPublicApiCatalog } = require('./applicationApiCatalogService');

const VALID_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']);

/** 把任意路径规范化为以 / 开头、无多余斜杠的形式 */
function normalizePath(path) {
  const p = String(path || '').trim();
  if (!p) return '/';
  return `/${p.split('/').filter(Boolean).join('/')}`;
}

/**
 * 将 JSON Schema（运行时参数 schema）映射为 OpenAPI requestBody / parameters。
 * 这里做保守映射：若 schema 看起来描述对象 body，则作为 requestBody；
 * 其余字段尽量按 properties 降级为 query/form 参数，无法判断时仅记录描述。
 */
function buildParametersAndBody(parametersSchema) {
  const result = { parameters: [], requestBody: undefined };
  if (!parametersSchema || typeof parametersSchema !== 'object') return result;

  const schema = parametersSchema;
  const type = schema.type || (schema.properties ? 'object' : undefined);

  // 对象 schema：视为请求体（POST/PUT/PATCH 常见形态）
  if (type === 'object' && schema.properties) {
    result.requestBody = {
      required: true,
      content: {
        'application/json': { schema },
      },
    };
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

function buildOperationObject({ operationId, summary, description, method, parametersSchema, tags }) {
  const { parameters, requestBody } = buildParametersAndBody(parametersSchema);
  const op = {
    tags: tags || [],
    summary: summary || '',
    ...(description ? { description } : {}),
    operationId,
    responses: {
      200: {
        description: '成功响应',
        content: { 'application/json': { schema: { type: 'object' } } },
      },
    },
  };
  if (parameters.length) op.parameters = parameters;
  if (requestBody) op.requestBody = requestBody;
  return op;
}

/**
 * 生成 OpenAPI 3.0 文档。
 * @param {string} applicationKey 应用 code 或 application_id
 * @returns {Promise<object>} OpenAPI 3.0 JSON 对象
 */
async function getPublicApiOpenApi(applicationKey) {
  const catalog = await getPublicApiCatalog(applicationKey);
  const { application, services = [], builtinApis = [] } = catalog;

  const paths = {};
  // 记录 (path, method) 去重，已占用时给 operationId 加后缀
  const usedOpIds = new Set();
  const usedPathMethods = new Set();

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
      const fullPath = normalizePath(`${basePath}/${op.routePattern || ''}`);
      const opId = ensureUniqueOpId(`${service.code}_${op.operation}`);
      const opObject = buildOperationObject({
        operationId: opId,
        summary: op.label || op.operation,
        description: op.category ? `Category: ${op.category}` : undefined,
        method: methodRaw,
        parametersSchema: op.parametersSchema,
        tags: [tag],
      });
      registerOperation(fullPath, methodRaw, opObject);
    }
  }

  // 2. 内置 API
  for (const api of builtinApis) {
    const fullPath = normalizePath(api.routePath);
    const methods = (api.httpMethods && api.httpMethods.length) ? api.httpMethods : ['GET'];
    for (const m of methods) {
      const methodLower = String(m).toLowerCase();
      if (!VALID_METHODS.has(methodLower)) continue;
      const opId = ensureUniqueOpId(`builtin_${api.code}_${methodLower}`);
      const opObject = buildOperationObject({
        operationId: opId,
        summary: api.label || api.code,
        description: api.description,
        method: methodLower,
        parametersSchema: undefined,
        tags: [api.domain ? `内置 API / ${api.domain}` : '内置 API'],
      });
      registerOperation(fullPath, methodLower, opObject);
    }
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
  };
}

module.exports = {
  getPublicApiOpenApi,
};
