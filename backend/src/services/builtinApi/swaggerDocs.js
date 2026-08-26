/**
 * 从路由 @swagger 注释生成的 OpenAPI spec 中，提取内置 API 的请求/响应文档。
 * catalog.js 仍是身份清单；请求/响应以 swagger 为单一事实源。
 */
const QUERY_ONLY_METHODS = new Set(['get', 'head', 'delete']);

let cachedSpec;

function getSwaggerSpec() {
  if (!cachedSpec) {
    cachedSpec = require('../../config/swagger');
  }
  return cachedSpec;
}

function toOpenApiPath(routePath) {
  return `/${String(routePath || '')
    .split('/')
    .filter(Boolean)
    .join('/')
    .replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
}

function toExpressPath(openApiPath) {
  return String(openApiPath || '').replace(/\{([^}]+)\}/g, ':$1');
}

function mergeAllOf(schema, spec, seen) {
  const parts = Array.isArray(schema.allOf) ? schema.allOf : [];
  const merged = {
    type: 'object',
    properties: {},
    required: [],
  };
  if (schema.nullable) merged.nullable = true;
  if (schema.description) merged.description = schema.description;
  parts.forEach((part) => {
    const resolved = deref(part, spec, new Set(seen));
    if (!resolved || typeof resolved !== 'object') return;
    Object.assign(merged.properties, resolved.properties || {});
    if (Array.isArray(resolved.required)) merged.required.push(...resolved.required);
    if (resolved.description && !merged.description) merged.description = resolved.description;
  });
  if (schema.properties) Object.assign(merged.properties, schema.properties);
  if (!merged.required.length) delete merged.required;
  return merged;
}

function deref(node, spec, seen = new Set()) {
  if (!node || typeof node !== 'object') return node;
  const ref = node.$ref;
  if (ref && typeof ref === 'string' && ref.startsWith('#/')) {
    if (seen.has(ref)) return { type: 'object', description: `circular ${ref}` };
    seen.add(ref);
    let cur = spec;
    for (const part of ref.slice(2).split('/')) {
      cur = cur?.[part];
    }
    if (!cur || typeof cur !== 'object') return { type: 'object' };
    return deref(cur, spec, seen);
  }
  if (Array.isArray(node.allOf) && node.allOf.length) {
    return mergeAllOf(node, spec, seen);
  }
  return node;
}

function paramToSchema(param, spec) {
  const p = deref(param, spec) || {};
  const schema = p.schema
    ? { ...deref(p.schema, spec) }
    : {
        ...(p.type ? { type: p.type } : {}),
        ...(p.format ? { format: p.format } : {}),
        ...(p.enum ? { enum: p.enum } : {}),
        ...(p.items ? { items: p.items } : {}),
      };
  if (p.description && !schema.description) schema.description = p.description;
  if (p.example !== undefined && schema.example === undefined) schema.example = p.example;
  return schema;
}

function schemaToExample(schema, spec, stack = new Set()) {
  const s = deref(schema, spec);
  if (!s || typeof s !== 'object') return undefined;
  if (s.example !== undefined) return s.example;
  if (s.examples && typeof s.examples === 'object') {
    const first = Object.values(s.examples)[0];
    if (first && typeof first === 'object' && first.value !== undefined) return first.value;
    if (first !== undefined) return first;
  }
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  if (s.default !== undefined) return s.default;

  const ref = schema && schema.$ref;
  if (ref) {
    if (stack.has(ref)) return {};
    stack.add(ref);
  }

  const type = String(s.type || (s.properties ? 'object' : '')).toLowerCase();
  if (type === 'array') {
    const item = schemaToExample(s.items, spec, stack);
    return item === undefined ? [] : [item];
  }
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'string') {
    if (s.format === 'uuid') return '00000000-0000-4000-8000-000000000001';
    if (s.format === 'date-time') return '2024-01-01T00:00:00.000Z';
    if (s.format === 'email') return 'user@example.com';
    if (s.format === 'binary') return '<binary>';
    return 'string';
  }
  if (type === 'object' || s.properties) {
    const obj = {};
    Object.entries(s.properties || {}).forEach(([key, prop]) => {
      obj[key] = schemaToExample(prop, spec, stack);
    });
    return obj;
  }
  return undefined;
}

function sanitizeTypeName(name) {
  const raw = String(name || 'Anonymous').replace(/[^A-Za-z0-9_]/g, '_') || 'Anonymous';
  return /^[A-Za-z_]/.test(raw) ? raw : `T_${raw}`;
}

function tsTypeOf(schema, spec, ctx) {
  const s = deref(schema, spec);
  if (!s || typeof s !== 'object') return 'unknown';
  if (schema && schema.$ref) {
    const name = sanitizeTypeName(schema.$ref.split('/').pop());
    ensureNamed(schema.$ref, spec, ctx);
    return name;
  }
  if (Array.isArray(s.enum) && s.enum.length) {
    return s.enum.map((v) => JSON.stringify(v)).join(' | ');
  }
  if (Array.isArray(s.anyOf) && s.anyOf.length) {
    return s.anyOf.map((item) => tsTypeOf(item, spec, ctx)).join(' | ');
  }
  const type = String(s.type || (s.properties ? 'object' : 'unknown')).toLowerCase();
  if (type === 'array') {
    const inner = tsTypeOf(s.items || { type: 'unknown' }, spec, ctx);
    const needsParen = /[|&]/.test(inner);
    return `${needsParen ? `(${inner})` : inner}[]`;
  }
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'string') return 'string';
  if (type === 'object' || s.properties) {
    if (!s.properties) return 'Record<string, unknown>';
    const inner = objectFieldsToTs(s, spec, ctx);
    return `{\n${inner}\n}`;
  }
  return 'unknown';
}

function objectFieldsToTs(schema, spec, ctx) {
  const s = deref(schema, spec) || {};
  const required = new Set(Array.isArray(s.required) ? s.required.map(String) : []);
  const lines = [];
  Object.entries(s.properties || {}).forEach(([key, prop]) => {
    const p = deref(prop, spec) || {};
    const optional = required.has(key) ? '' : '?';
    const safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key);
    if (p.description) lines.push(`  /** ${String(p.description).replace(/\*\//g, '* /')} */`);
    lines.push(`  ${safeKey}${optional}: ${tsTypeOf(prop, spec, ctx)};`);
  });
  return lines.join('\n') || '  [key: string]: unknown;';
}

function ensureNamed(ref, spec, ctx) {
  const name = sanitizeTypeName(ref.split('/').pop());
  if (ctx.named.has(name) || ctx.building.has(name)) return name;
  ctx.building.add(name);
  const resolved = deref({ $ref: ref }, spec);
  ctx.named.set(name, `interface ${name} {\n${objectFieldsToTs(resolved, spec, ctx)}\n}`);
  ctx.building.delete(name);
  return name;
}

function schemaToInterfaceText(schema, rootName, spec) {
  if (!schema || typeof schema !== 'object') return '';
  const ctx = { named: new Map(), building: new Set() };
  let rootType = 'unknown';
  if (schema.$ref) {
    rootType = ensureNamed(schema.$ref, spec, ctx);
  } else if (schema.properties || schema.type === 'object') {
    ctx.named.set(rootName, `interface ${rootName} {\n${objectFieldsToTs(schema, spec, ctx)}\n}`);
    rootType = rootName;
  } else {
    rootType = tsTypeOf(schema, spec, ctx);
    if (rootType !== rootName) {
      ctx.named.set(rootName, `type ${rootName} = ${rootType};`);
      rootType = rootName;
    }
  }
  const extras = [...ctx.named.entries()]
    .filter(([name]) => name !== rootName)
    .map(([, text]) => text);
  const rootText = ctx.named.get(rootName) || `type ${rootName} = ${rootType};`;
  return [rootText, ...extras].filter(Boolean).join('\n\n');
}

function pickJsonContent(content) {
  if (!content || typeof content !== 'object') return { contentType: '', media: null };
  if (content['application/json']) return { contentType: 'application/json', media: content['application/json'] };
  const first = Object.entries(content)[0];
  return first ? { contentType: first[0], media: first[1] } : { contentType: '', media: null };
}

function parametersToObjectSchema(parameters, spec, kinds) {
  const properties = {};
  const required = [];
  (parameters || []).forEach((raw) => {
    const p = deref(raw, spec) || {};
    if (!kinds.has(p.in) || !p.name) return;
    properties[p.name] = paramToSchema(p, spec);
    if (p.required) required.push(p.name);
  });
  if (!Object.keys(properties).length) return null;
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

function findSwaggerOperation(spec, routePath, method) {
  const lower = String(method || 'get').toLowerCase();
  const openPath = toOpenApiPath(routePath);
  const candidates = [openPath];
  if (!/\{[^}]+\}\s*$/.test(openPath)) {
    candidates.push(`${openPath}/{id}`);
  }
  for (const path of candidates) {
    const op = spec.paths?.[path]?.[lower];
    if (op) return { path, operation: op };
  }
  return null;
}

function pickSuccessResponse(responses = {}) {
  const keys = Object.keys(responses);
  const preferred = ['200', '201', '204'].find((code) => responses[code]);
  if (preferred) return { status: preferred, response: responses[preferred] };
  const first2xx = keys.find((code) => /^2\d\d$/.test(code));
  if (first2xx) return { status: first2xx, response: responses[first2xx] };
  return { status: '', response: null };
}

const DEFAULT_ENVELOPE_SCHEMA = {
  type: 'object',
  properties: {
    code: { type: 'integer', example: 200 },
    message: { type: 'string', example: 'success' },
    data: { description: '业务数据' },
  },
};

function buildOperationDocs(item, method, spec) {
  const found = findSwaggerOperation(spec, item.routePath, method);
  const httpMethod = String(method || 'GET').toUpperCase();
  const matchedPath = found?.path || toOpenApiPath(item.routePath);
  const routePattern = toExpressPath(matchedPath);
  const op = found?.operation || {};

  const allParams = Array.isArray(op.parameters) ? op.parameters : [];
  const pathQuerySchema = parametersToObjectSchema(allParams, spec, new Set(['path', 'query']));
  const headerParams = allParams
    .map((raw) => deref(raw, spec) || {})
    .filter((p) => p.in === 'header' && p.name);

  const requestBody = deref(op.requestBody, spec);
  const { contentType, media } = pickJsonContent(requestBody?.content);
  const bodySchema = media?.schema ? deref(media.schema, spec) : null;
  const bodyExample = media?.example !== undefined
    ? media.example
    : schemaToExample(bodySchema, spec);

  const isQuery = QUERY_ONLY_METHODS.has(httpMethod.toLowerCase());
  const parametersSchema = isQuery
    ? pathQuerySchema
    : pathQuerySchema || (bodySchema && bodySchema.properties ? bodySchema : null);
  let requestExample = isQuery
    ? schemaToExample(pathQuerySchema, spec)
    : (bodyExample && typeof bodyExample === 'object' && !Array.isArray(bodyExample)
      ? bodyExample
      : schemaToExample(pathQuerySchema, spec));
  if (requestExample && typeof requestExample === 'object' && !Object.keys(requestExample).length) {
    requestExample = undefined;
  }

  const interfaceParts = [];
  if (headerParams.length) {
    const headerLines = headerParams.map((p) => {
      const optional = p.required ? '' : '?';
      const desc = p.description ? `  /** ${p.description} */\n` : '';
      return `${desc}  ${JSON.stringify(p.name)}${optional}: string;`;
    });
    interfaceParts.push(`interface RequestHeaders {\n${headerLines.join('\n')}\n}`);
  }
  if (contentType && contentType !== 'application/json') {
    interfaceParts.push(`/** Content-Type: ${contentType} */`);
  }
  if (bodySchema) {
    interfaceParts.push(schemaToInterfaceText(bodySchema, 'RequestBody', spec));
  } else if (pathQuerySchema) {
    interfaceParts.push(schemaToInterfaceText(pathQuerySchema, 'RequestQuery', spec));
  }
  const requestParameterInterface = interfaceParts.filter(Boolean).join('\n\n');

  const { status, response: rawSuccess } = pickSuccessResponse(op.responses);
  const success = deref(rawSuccess, spec) || {};
  const { contentType: successContentType, media: successMedia } = pickJsonContent(success.content);
  const hasHeaderOnly = Boolean(success.headers && Object.keys(success.headers).length)
    && !successMedia?.schema;
  const responseSchema = successMedia?.schema
    ? deref(successMedia.schema, spec)
    : (!hasHeaderOnly && status && status !== '204' ? DEFAULT_ENVELOPE_SCHEMA : null);
  const responseExample = successMedia?.example !== undefined
    ? successMedia.example
    : schemaToExample(responseSchema, spec);
  const headerDoc = success.headers
    ? Object.entries(success.headers).map(([name, raw]) => {
      const h = deref(raw, spec) || {};
      return `  ${JSON.stringify(name)}?: string;${h.description ? ` // ${h.description}` : ''}`;
    }).join('\n')
    : '';
  let responseInterface = responseSchema
    ? schemaToInterfaceText(responseSchema, 'Response', spec)
    : (success.description ? `/** ${success.description} */` : '');
  if (successContentType && successContentType !== 'application/json') {
    responseInterface = [`/** Content-Type: ${successContentType} */`, responseInterface].filter(Boolean).join('\n');
  }
  if (headerDoc) {
    responseInterface = [`interface ResponseHeaders {\n${headerDoc}\n}`, responseInterface].filter(Boolean).join('\n\n');
  }

  const responsesSchema = {};
  Object.entries(op.responses || {}).forEach(([code, raw]) => {
    const resolved = deref(raw, spec) || {};
    responsesSchema[code] = {
      description: resolved.description || '',
      content: resolved.content || undefined,
    };
  });

  return {
    operation: httpMethod.toLowerCase(),
    httpMethod,
    routePattern,
    label: op.summary || httpMethod,
    parametersSchema: parametersSchema || undefined,
    requestExample: requestExample || undefined,
    requestParameterInterface: requestParameterInterface || undefined,
    responseInterface: responseInterface || undefined,
    responseSchema: responseSchema || undefined,
    responseExample: responseExample || undefined,
    responsesSchema: Object.keys(responsesSchema).length ? responsesSchema : undefined,
  };
}

function jsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function enrichBuiltinApiWithSwagger(item) {
  const spec = getSwaggerSpec();
  const methods = (item.httpMethods && item.httpMethods.length) ? item.httpMethods : ['GET'];
  return {
    ...item,
    operations: methods.map((method) => {
      const op = buildOperationDocs(item, method, spec);
      return jsonClone(op) || {
        operation: op.operation,
        httpMethod: op.httpMethod,
        routePattern: op.routePattern,
        label: op.label,
        requestParameterInterface: op.requestParameterInterface,
        responseInterface: op.responseInterface,
      };
    }),
  };
}

module.exports = {
  enrichBuiltinApiWithSwagger,
  toOpenApiPath,
  getSwaggerSpec,
};
