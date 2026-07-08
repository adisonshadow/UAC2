const { z } = require('zod');
const { getOperationMeta } = require('./operationCatalog');
const { DEFAULT_SECURITY_CONFIG } = require('./apiServiceConstants');

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000001';
const FILE_FIELD_MARKERS = /@file|@storage|objectId|storage|文件引用|文件字段|StorageObjectId|FileReference/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WRITE_OPERATIONS = new Set([
  'insertOne', 'create', 'insertMany', 'save', 'updateOne', 'updateMany',
  'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'clone',
]);

const READ_OPERATIONS = new Set([
  'find', 'findOne', 'findById', 'count', 'countDocuments', 'distinct', 'exists', 'aggregate',
]);

function resolveSecurityConfig(service) {
  return { ...DEFAULT_SECURITY_CONFIG, ...(service?.securityConfig || {}) };
}

function resolveDefinitionScript(service) {
  if (service?.definitionScript && String(service.definitionScript).trim()) {
    return String(service.definitionScript).trim();
  }
  const overrides = service?.scriptOverrides || {};
  if (overrides.__definition__ && String(overrides.__definition__).trim()) {
    return String(overrides.__definition__).trim();
  }
  return null;
}

function parseRequestParameterInterface(interfaceText) {
  const fields = {};
  const fileFields = new Set();
  const text = String(interfaceText || '').trim();
  if (!text) return { fields, fileFields };

  let pendingComment = '';
  text.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    const blockComment = line.match(/\/\*\*([\s\S]*?)\*\//);
    if (blockComment) {
      pendingComment = blockComment[1].replace(/\*/g, ' ').trim();
    }
    const lineComment = line.match(/\/\/(.+)$/);
    if (lineComment) {
      pendingComment = `${pendingComment} ${lineComment[1]}`.trim();
    }

    const propMatch = line.match(/^(\w+)(\??)\s*:\s*([^;]+);/);
    if (!propMatch) return;

    const name = propMatch[1];
    const optional = propMatch[2] === '?';
    const typePart = propMatch[3].trim();
    const commentText = `${pendingComment} ${line} ${typePart}`;
    const isFile = FILE_FIELD_MARKERS.test(commentText);
    fields[name] = {
      description: pendingComment || undefined,
      isFile,
      required: !optional,
      tsType: typePart,
    };
    if (isFile) fileFields.add(name);
    pendingComment = '';
  });

  return { fields, fileFields };
}

function collectInterfaceFileFields(service) {
  const interfaceText = service?.requestParameterInterface
    || service?.request_parameter_interface
    || '';
  return parseRequestParameterInterface(interfaceText).fileFields;
}

function mapInterfaceTypeToJsonSchema(tsType) {
  const normalized = String(tsType || '').toLowerCase();
  if (normalized.includes('number')) return { type: 'number' };
  if (normalized.includes('boolean')) return { type: 'boolean' };
  if (normalized.includes('object') || normalized.includes('record')) {
    return { type: 'object', additionalProperties: true };
  }
  if (normalized.includes('[]') || normalized.includes('array')) {
    return { type: 'array', items: { type: 'string' } };
  }
  return { type: 'string' };
}

function resolveInterfaceMergeTarget(jsonSchema) {
  const props = jsonSchema?.properties;
  if (!props) return 'root';
  if (props.body && props.body.type === 'object') return 'body';
  if (props.set && props.set.type === 'object') return 'set';
  return 'root';
}

function mergeInterfaceFieldsIntoProperties(properties, fields, requiredSet) {
  Object.entries(fields).forEach(([name, meta]) => {
    const baseSchema = meta.isFile
      ? { type: 'string', format: 'uuid', description: meta.description || 'storage objectId' }
      : { ...mapInterfaceTypeToJsonSchema(meta.tsType), ...(meta.description ? { description: meta.description } : {}) };

    if (!properties[name]) {
      properties[name] = baseSchema;
    } else {
      properties[name] = {
        ...properties[name],
        ...(meta.description ? { description: meta.description } : {}),
        ...(meta.isFile ? { format: 'uuid', type: 'string' } : {}),
      };
    }

    if (meta.required) requiredSet.add(name);
    else requiredSet.delete(name);
  });
}

function mergeInterfaceMetadata(jsonSchema, service) {
  const interfaceText = service?.requestParameterInterface
    || service?.request_parameter_interface
    || '';
  const { fields } = parseRequestParameterInterface(interfaceText);
  if (!jsonSchema?.properties || !Object.keys(fields).length) return jsonSchema;

  const next = {
    ...jsonSchema,
    properties: { ...jsonSchema.properties },
  };
  const targetKey = resolveInterfaceMergeTarget(next);

  if (targetKey === 'root') {
    const requiredSet = new Set(next.required || []);
    mergeInterfaceFieldsIntoProperties(next.properties, fields, requiredSet);
    if (requiredSet.size) next.required = [...requiredSet];
    return next;
  }

  const container = {
    ...next.properties[targetKey],
    properties: { ...(next.properties[targetKey].properties || {}) },
  };
  const requiredSet = new Set(container.required || []);
  mergeInterfaceFieldsIntoProperties(container.properties, fields, requiredSet);
  if (requiredSet.size) container.required = [...requiredSet];
  next.properties[targetKey] = container;

  return next;
}

function validateFileObjectIds(parameters, fileFields) {
  if (!fileFields?.size) return;

  const checkValue = (fieldName, value, pathPrefix) => {
    if (value == null || value === '') return;
    if (typeof value === 'string' && UUID_RE.test(value)) return;
    throw Object.assign(
      new Error(
        `参数 ${pathPrefix}${fieldName} 须为 storage objectId（UUID），请先通过文件存储上传接口获取，不支持 multipart/base64`,
      ),
      { status: 400 },
    );
  };

  fileFields.forEach((fieldName) => {
    if (Object.prototype.hasOwnProperty.call(parameters || {}, fieldName)) {
      checkValue(fieldName, parameters[fieldName], '');
      return;
    }
    ['body', 'set'].forEach((container) => {
      if (parameters?.[container] && Object.prototype.hasOwnProperty.call(parameters[container], fieldName)) {
        checkValue(fieldName, parameters[container][fieldName], `${container}.`);
      }
    });
  });
}

function extractSqlNamedParams(script) {
  if (!script) return [];
  const matches = script.match(/(?<!:):(\w+)/g) || [];
  const reserved = new Set(['limit', 'skip']);
  return [...new Set(matches.map((m) => m.slice(1)).filter((name) => !reserved.has(name.toLowerCase())))];
}

function filterEntityFields(fields, securityConfig) {
  const denylist = new Set((securityConfig.fieldDenylist || []).map(String));
  const allowlist = securityConfig.fieldAllowlist;
  return (fields || []).filter((field) => {
    const key = field.fieldKey || field.field_key;
    if (!key || denylist.has(key)) return false;
    if (Array.isArray(allowlist) && allowlist.length) {
      return allowlist.includes(key);
    }
    return true;
  });
}

function pgTypeToJsonSchema(field) {
  const typeorm = field.typeormConfig || field.typeorm_config || {};
  const pgType = String(typeorm.type || 'varchar').toLowerCase();
  if (['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real'].some((t) => pgType.includes(t))) {
    return { type: 'number' };
  }
  if (pgType.includes('bool')) {
    return { type: 'boolean' };
  }
  if (pgType.includes('json')) {
    return { type: 'object' };
  }
  if (pgType.includes('uuid')) {
    return { type: 'string', format: 'uuid' };
  }
  if (pgType.includes('timestamp') || pgType.includes('date')) {
    return { type: 'string', format: 'date-time' };
  }
  return { type: 'string' };
}

function mockValueForField(field) {
  const typeorm = field.typeormConfig || field.typeorm_config || {};
  const pgType = String(typeorm.type || 'varchar').toLowerCase();
  const key = field.fieldKey || field.field_key;
  if (typeorm.primary || key === 'id') {
    return SAMPLE_UUID;
  }
  if (['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real'].some((t) => pgType.includes(t))) {
    return 1;
  }
  if (pgType.includes('bool')) {
    return true;
  }
  if (pgType.includes('json')) {
    return {};
  }
  if (pgType.includes('uuid')) {
    return SAMPLE_UUID;
  }
  if (pgType.includes('timestamp') || pgType.includes('date')) {
    return new Date().toISOString();
  }
  return `sample_${key}`;
}

function buildEntityBodySchema(fields) {
  const properties = {};
  const required = [];
  fields.forEach((field) => {
    const key = field.fieldKey || field.field_key;
    if (!key || key === 'id') return;
    const schema = pgTypeToJsonSchema(field);
    const typeorm = field.typeormConfig || field.typeorm_config || {};
    properties[key] = {
      ...schema,
      description: field.columnInfo?.label || field.column_info?.label || key,
    };
    if (typeorm.nullable === false) {
      required.push(key);
    }
  });
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}

function buildEntityBodyZod(fields) {
  const shape = {};
  fields.forEach((field) => {
    const key = field.fieldKey || field.field_key;
    if (!key || key === 'id') return;
    const typeorm = field.typeormConfig || field.typeorm_config || {};
    const pgType = String(typeorm.type || 'varchar').toLowerCase();
    let schema;
    if (['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real'].some((t) => pgType.includes(t))) {
      schema = z.number();
    } else if (pgType.includes('bool')) {
      schema = z.boolean();
    } else if (pgType.includes('json')) {
      schema = z.record(z.unknown());
    } else {
      schema = z.string();
    }
    if (typeorm.nullable !== false) {
      schema = schema.optional();
    }
    shape[key] = schema;
  });
  return z.object(shape).passthrough();
}

function buildSqlParamSchemas(script) {
  const names = extractSqlNamedParams(script);
  const properties = {};
  names.forEach((name) => {
    properties[name] = { type: 'string', description: `SQL 命名参数 :${name}` };
  });
  return properties;
}

function buildSqlParamZod(script) {
  const names = extractSqlNamedParams(script);
  const shape = {};
  names.forEach((name) => {
    shape[name] = z.union([z.string(), z.number(), z.boolean()]).optional();
  });
  return z.object(shape).passthrough();
}

function buildBaseSchemas(service, operation, entity) {
  const securityConfig = resolveSecurityConfig(service);
  const meta = getOperationMeta(operation);
  const script = resolveDefinitionScript(service);
  const fields = filterEntityFields(entity?.fields, securityConfig);
  const maxLimit = Number(securityConfig.maxLimit) || 100;
  const defaultLimit = Math.min(Number(securityConfig.defaultLimit) || 20, maxLimit);

  const sqlProps = buildSqlParamSchemas(script);
  const sqlZod = buildSqlParamZod(script);
  const bodyJson = buildEntityBodySchema(fields);
  const bodyZod = buildEntityBodyZod(fields);

  let jsonSchema = { type: 'object', properties: {} };
  let zodSchema = z.object({}).passthrough();

  if (operation === 'find') {
    jsonSchema = {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: maxLimit, default: defaultLimit },
        skip: { type: 'integer', minimum: 0, default: 0 },
        filter: { type: 'object', additionalProperties: true, description: '查询过滤条件' },
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      limit: z.coerce.number().int().min(1).max(maxLimit).optional(),
      skip: z.coerce.number().int().min(0).optional(),
      filter: z.record(z.unknown()).optional(),
    }).merge(sqlZod);
  } else if (operation === 'count' || operation === 'countDocuments') {
    jsonSchema = {
      type: 'object',
      properties: {
        filter: { type: 'object', additionalProperties: true },
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      filter: z.record(z.unknown()).optional(),
    }).merge(sqlZod);
  } else if (operation === 'findOne' || operation === 'exists') {
    jsonSchema = {
      type: 'object',
      properties: {
        filter: { type: 'object', additionalProperties: true },
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      filter: z.record(z.unknown()).optional(),
    }).merge(sqlZod);
  } else if (operation === 'findById' || operation === 'deleteOne' || operation === 'save' || operation === 'replaceOne') {
    jsonSchema = {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid', description: '资源 ID（路径参数）' },
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      id: z.string().min(1),
    }).merge(sqlZod);
    if (operation === 'save' || operation === 'replaceOne') {
      jsonSchema.properties.body = bodyJson;
      zodSchema = zodSchema.extend({ body: bodyZod.optional() });
    }
  } else if (operation === 'create' || operation === 'insertOne') {
    jsonSchema = {
      type: 'object',
      properties: {
        body: bodyJson,
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      body: bodyZod.optional(),
    }).merge(sqlZod);
  } else if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
    jsonSchema = {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        body: bodyJson,
        set: bodyJson,
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      id: z.string().min(1),
      body: bodyZod.optional(),
      set: bodyZod.optional(),
    }).merge(sqlZod);
  } else if (operation === 'aggregate') {
    jsonSchema = {
      type: 'object',
      properties: {
        pipeline: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
          description: '聚合管道阶段',
        },
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      pipeline: z.array(z.record(z.unknown())).optional(),
    }).merge(sqlZod);
  } else if (operation === 'distinct') {
    jsonSchema = {
      type: 'object',
      required: ['field'],
      properties: {
        field: { type: 'string' },
        filter: { type: 'object', additionalProperties: true },
        ...sqlProps,
      },
    };
    zodSchema = z.object({
      field: z.string().min(1),
      filter: z.record(z.unknown()).optional(),
    }).merge(sqlZod);
  } else {
    jsonSchema = {
      type: 'object',
      properties: { ...sqlProps },
    };
    zodSchema = sqlZod;
  }

  jsonSchema = mergeInterfaceMetadata(jsonSchema, service);

  return { jsonSchema, zodSchema, meta, securityConfig, fields, script, defaultLimit };
}

function buildMockParameters(service, operation, entity) {
  const { jsonSchema, zodSchema, fields, script, defaultLimit, securityConfig } = buildBaseSchemas(service, operation, entity);
  void jsonSchema;
  void zodSchema;

  const mock = {};
  if (operation === 'find') {
    mock.limit = defaultLimit;
    mock.skip = 0;
  }

  extractSqlNamedParams(script).forEach((name) => {
    mock[name] = `sample_${name}`;
  });

  if (['findById', 'deleteOne', 'updateOne', 'save', 'replaceOne', 'findOneAndUpdate'].includes(operation)) {
    mock.id = SAMPLE_UUID;
  }

  if (['create', 'insertOne', 'updateOne', 'save', 'replaceOne', 'findOneAndUpdate'].includes(operation)) {
    const body = {};
    filterEntityFields(fields, securityConfig).forEach((field) => {
      const key = field.fieldKey || field.field_key;
      if (!key || key === 'id') return;
      body[key] = mockValueForField(field);
    });
    if (Object.keys(body).length) {
      mock.body = body;
      if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
        mock.set = { ...body };
      }
    }
  }

  if (operation === 'aggregate') {
    mock.pipeline = [{ $match: {} }, { $limit: 10 }];
  }

  if (operation === 'distinct') {
    const firstField = filterEntityFields(fields, securityConfig)[0];
    mock.field = firstField?.fieldKey || firstField?.field_key || 'id';
  }

  return mock;
}

function validateParameters(service, operation, parameters, entity) {
  const { zodSchema } = buildBaseSchemas(service, operation, entity);
  const parsed = zodSchema.safeParse(parameters || {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const err = new Error(`参数校验失败: ${issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ')}`);
    err.status = 400;
    err.validationErrors = issues;
    throw err;
  }
  validateFileObjectIds(parsed.data, collectInterfaceFileFields(service));
  return parsed.data;
}

function getParameterSchema(service, operation, entity) {
  const { jsonSchema, zodSchema } = buildBaseSchemas(service, operation, entity);
  return { jsonSchema, zodSchema };
}

function isWriteOperation(operation) {
  return WRITE_OPERATIONS.has(operation);
}

function isReadOperation(operation) {
  return READ_OPERATIONS.has(operation);
}

function resolveHandlerScript(service) {
  if (service?.handlerScript && String(service.handlerScript).trim()) {
    return String(service.handlerScript).trim();
  }
  const overrides = service?.scriptOverrides || {};
  if (overrides.__handler__ && String(overrides.__handler__).trim()) {
    return String(overrides.__handler__).trim();
  }
  return null;
}

function isOperationExecutable(service, operation, options = {}) {
  const allowWriteOperations = Boolean(options.allowWriteOperations);
  if (service?.scriptMode === 'typescript') {
    const handler = resolveHandlerScript(service);
    if (!handler) {
      return { executable: false, reason: 'TypeScript Handler 脚本为空' };
    }
    return { executable: true };
  }

  const script = resolveDefinitionScript(service);
  const hasTable = Boolean(service?.tableName);
  const hasScript = Boolean(script);

  if (!hasTable && !hasScript) {
    return { executable: false, reason: '服务未绑定物化表或 SQL 定义' };
  }

  if (isWriteOperation(operation)) {
    if (hasScript && !hasTable) {
      if (!allowWriteOperations) {
        return {
          executable: false,
          reason: '自定义 SQL 服务的写操作测试暂不支持自动执行，可先校验参数结构',
        };
      }
      return { executable: true };
    }
    if (!hasTable) {
      return { executable: false, reason: '写操作测试需要绑定实体表' };
    }
    return { executable: true };
  }

  if (operation === 'aggregate') {
    return { executable: false, reason: 'aggregate 测试执行暂未实现，可先校验参数结构' };
  }

  return { executable: true };
}

function buildRequestPreview(service, operation, parameters, entity) {
  const meta = getOperationMeta(operation);
  const basePath = service.basePath || `/api/v1/data/${service.routePath}`;
  const routePattern = meta?.routePattern || '';
  const pathParams = {};
  let url = `${basePath}${routePattern}`;

  if (routePattern.includes(':id') && parameters?.id) {
    pathParams.id = parameters.id;
    url = url.replace(':id', encodeURIComponent(String(parameters.id)));
  }
  if (routePattern.includes(':field') && parameters?.field) {
    pathParams.field = parameters.field;
    url = url.replace(':field', encodeURIComponent(String(parameters.field)));
  }

  const query = {};
  const body = parameters?.body || parameters?.set || undefined;

  if (operation === 'find') {
    if (parameters?.limit != null) query.limit = parameters.limit;
    if (parameters?.skip != null) query.skip = parameters.skip;
  }

  extractSqlNamedParams(resolveDefinitionScript(service)).forEach((name) => {
    if (parameters?.[name] != null) {
      query[name] = parameters[name];
    }
  });

  return {
    method: meta?.httpMethod || 'GET',
    url,
    pathParams,
    query: Object.keys(query).length ? query : undefined,
    body,
  };
}

function pascalCase(value) {
  return String(value || 'Record')
    .split(/[_\s:-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function pgTypeToTsType(field) {
  const typeorm = field.typeormConfig || field.typeorm_config || {};
  const pgType = String(typeorm.type || 'varchar').toLowerCase();
  if (['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real'].some((t) => pgType.includes(t))) {
    return 'number';
  }
  if (pgType.includes('bool')) return 'boolean';
  if (pgType.includes('json')) return 'Record<string, unknown>';
  if (pgType.includes('uuid')) return 'string';
  if (pgType.includes('timestamp') || pgType.includes('date')) return 'string';
  return 'string';
}

function buildEntityRecordSchema(fields) {
  const properties = {};
  const required = [];
  (fields || []).forEach((field) => {
    const key = field.fieldKey || field.field_key;
    if (!key) return;
    const schema = pgTypeToJsonSchema(field);
    const typeorm = field.typeormConfig || field.typeorm_config || {};
    properties[key] = {
      ...schema,
      description: field.columnInfo?.label || field.column_info?.label || key,
    };
    if (typeorm.primary || key === 'id' || typeorm.nullable === false) {
      required.push(key);
    }
  });
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}

function buildEntityRecordInterface(entity, securityConfig, interfaceName) {
  const fields = filterEntityFields(entity?.fields, securityConfig);
  if (!fields.length) return '';

  const lines = [`interface ${interfaceName} {`];
  fields.forEach((field) => {
    const key = field.fieldKey || field.field_key;
    if (!key) return;
    const typeorm = field.typeormConfig || field.typeorm_config || {};
    const label = field.columnInfo?.label || field.column_info?.label || key;
    const optional = typeorm.primary || key === 'id' || typeorm.nullable === false ? '' : '?';
    lines.push(`  /** ${label} */`);
    lines.push(`  ${key}${optional}: ${pgTypeToTsType(field)};`);
  });
  lines.push('}');
  return lines.join('\n');
}

function parsePrimaryInterfaceName(interfaceText) {
  const match = String(interfaceText || '').trim().match(/interface\s+(\w+)/);
  return match?.[1] || null;
}

function getResponseDescriptor(service, operation, entity) {
  const securityConfig = resolveSecurityConfig(service);
  const fields = filterEntityFields(entity?.fields, securityConfig);
  const recordSchema = buildEntityRecordSchema(fields);
  const recordName = `${pascalCase(entity?.code || service?.entityCode || 'Entity')}Record`;
  const recordInterface = buildEntityRecordInterface(entity, securityConfig, recordName);
  const requestInterfaceText = service?.requestParameterInterface
    || service?.request_parameter_interface
    || '';
  const requestInterfaceName = parsePrimaryInterfaceName(requestInterfaceText);
  const hasEntityFields = fields.length > 0;
  const looseRecordSchema = { type: 'object', additionalProperties: true };
  const itemRecordType = hasEntityFields
    ? recordName
    : (requestInterfaceName ? `(${requestInterfaceName} & { id: string })` : 'Record<string, unknown>');
  const itemRecordSchema = hasEntityFields ? recordSchema : looseRecordSchema;

  let responseSchema;
  let responseWrapper;

  if (operation === 'find') {
    responseSchema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: itemRecordSchema },
        count: { type: 'integer' },
      },
      required: ['items', 'count'],
    };
    responseWrapper = `interface Response {\n  items: ${itemRecordType}[];\n  count: number;\n}`;
  } else if (operation === 'count' || operation === 'countDocuments') {
    responseSchema = {
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    };
    responseWrapper = 'interface Response {\n  count: number;\n}';
  } else if (operation === 'distinct') {
    responseSchema = {
      type: 'object',
      properties: {
        values: { type: 'array', items: { type: 'string' } },
      },
      required: ['values'],
    };
    responseWrapper = 'interface Response {\n  values: string[];\n}';
  } else if (operation === 'deleteOne' || operation === 'findOneAndDelete') {
    responseSchema = {
      type: 'object',
      properties: {
        item: { ...itemRecordSchema, nullable: true },
        deleted: { type: 'integer' },
      },
    };
    responseWrapper = `interface Response {\n  item: ${itemRecordType} | null;\n  deleted: number;\n}`;
  } else if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
    responseSchema = {
      type: 'object',
      properties: {
        item: { ...itemRecordSchema, nullable: true },
        matched: { type: 'integer' },
      },
    };
    responseWrapper = `interface Response {\n  item: ${itemRecordType} | null;\n  matched: number;\n}`;
  } else if (['create', 'insertOne', 'findById', 'findOne', 'save', 'replaceOne'].includes(operation)) {
    responseSchema = {
      type: 'object',
      properties: {
        item: { ...itemRecordSchema, nullable: true },
      },
      required: ['item'],
    };
    responseWrapper = `interface Response {\n  item: ${itemRecordType} | null;\n}`;
  } else if (operation === 'aggregate') {
    responseSchema = {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
      required: ['items'],
    };
    responseWrapper = 'interface Response {\n  items: Record<string, unknown>[];\n}';
  } else {
    responseSchema = {
      type: 'object',
      additionalProperties: true,
    };
    responseWrapper = 'interface Response {\n  [key: string]: unknown;\n}';
  }

  const responseInterface = recordInterface
    ? `${recordInterface}\n\n${responseWrapper}`
    : (requestInterfaceText.trim()
      ? `${requestInterfaceText.trim()}\n\n${responseWrapper}`
      : responseWrapper);

  return { responseInterface, responseSchema };
}

module.exports = {
  SAMPLE_UUID,
  extractSqlNamedParams,
  getParameterSchema,
  getResponseDescriptor,
  validateParameters,
  buildMockParameters,
  buildRequestPreview,
  isWriteOperation,
  isReadOperation,
  isOperationExecutable,
  resolveDefinitionScript,
  resolveHandlerScript,
  parseRequestParameterInterface,
};
