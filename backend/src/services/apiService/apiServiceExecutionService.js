const apiServiceService = require('./apiServiceService');
const businessDataService = require('../businessData/businessDataService');
const databaseConnectionService = require('../businessData/databaseConnectionService');
const systemService = require('../system/systemService');
const { resolveEntityTableName } = require('../businessData/entityTableName');
const { getOperationMeta } = require('./operationCatalog');
const {
  withPgClient,
  withPgWriteTest,
  quotePgIdentifier,
} = require('../businessData/materialization/connectionRunner');
const { DEFAULT_SECURITY_CONFIG } = require('./apiServiceConstants');
const {
  validateParameters,
  buildRequestPreview,
  isOperationExecutable,
  isWriteOperation,
  resolveDefinitionScript,
  resolveHandlerScript,
  extractSqlNamedParams,
  loadEnumMapForEntity,
  resolveOptionalSqlParamNames,
  parseRequestParameterInterface,
  normalizeWriteBody,
} = require('./operationParameterSchemas');
const { executeHandlerScript, buildHandlerContext } = require('./apiServiceHandlerRuntime');
const { assertAccessAllowed } = require('./apiServicePermissionService');
const {
  buildSqlExecutionParameters,
  resolveFilterEntries,
  buildParameterizedWhere,
} = require('./filterQueryBuilder');
const { bindNamedSqlParams, sqlHasNamedParams } = require('./namedSqlBindings');
const { createHandlerSdk } = require('./handlerSdk');
const { assertHandlerScriptValid } = require('./handlerTypeCheck');
const { buildPaginationMeta, normalizeListResult } = require('./paginationMeta');

function pickDefaultOperation(enabledOperations) {
  const enabled = Array.isArray(enabledOperations) ? enabledOperations : [];
  return enabled[0] || null;
}

/**
 * 去掉 SQL 末尾的 LIMIT / OFFSET（含 :limit/:skip 或已替换数字）。
 * 网关会在外层统一分页；definition 内再写会导致双重 OFFSET、COUNT 被裁剪。
 */
function stripTrailingLimitOffset(sql) {
  let next = String(sql || '').replace(/;\s*$/, '').trimEnd();
  let prev;
  do {
    prev = next;
    next = next.replace(/\s+OFFSET\s+(?:\d+|:\w+)\s*$/i, '');
    next = next.replace(/\s+LIMIT\s+(?:\d+|:\w+)(?:\s+OFFSET\s+(?:\d+|:\w+))?\s*$/i, '');
  } while (next !== prev);
  return next.trimEnd();
}

function applyScriptParams(script, parameters, { limit, skip, optionalSqlParams } = {}) {
  const optional = optionalSqlParams instanceof Set
    ? optionalSqlParams
    : new Set(optionalSqlParams || []);
  let next = script.replace(/;\s*$/, '');
  next = next.replace(/:limit\b/gi, String(limit ?? 20));
  next = next.replace(/:skip\b/gi, String(skip ?? 0));
  extractSqlNamedParams(script).forEach((name) => {
    const pattern = new RegExp(`(?<!:):${name}\\b`, 'gi');
    const raw = parameters?.[name];
    const hasValue = raw != null && raw !== '';
    if (hasValue) {
      const replacement = typeof raw === 'number'
        ? String(raw)
        : `'${String(raw).replace(/'/g, "''")}'`;
      next = next.replace(pattern, replacement);
      return;
    }
    if (optional.has(name)) {
      // 可选参数未填：约定 SQL 写为 column = :column，替换为 column = column 跳过该条件
      next = next.replace(pattern, quotePgIdentifier(name));
    }
  });
  const remaining = extractSqlNamedParams(next);
  if (remaining.length) {
    throw Object.assign(
      new Error(`自定义 SQL 包含未填写的参数: ${remaining.map((n) => `:${n}`).join(', ')}`),
      { status: 400 },
    );
  }
  return next;
}

function buildFromSource(service, parameters, {
  limit,
  skip,
  operation,
  entity,
  enumMap,
  /** find/count/findOne：剥离 definition 内分页，由网关外层 LIMIT/OFFSET */
  gatewayPagination = false,
} = {}) {
  const schema = service.targetSchema || 'bizdata_mat';
  let definitionScript = resolveDefinitionScript(service);
  if (definitionScript) {
    if (gatewayPagination) {
      definitionScript = stripTrailingLimitOffset(definitionScript);
    }
    const sqlParameters = buildSqlExecutionParameters(parameters, service);
    const optionalSqlParams = operation
      ? resolveOptionalSqlParamNames(service, operation, entity, enumMap)
      : new Set();
    return {
      sourceSql: applyScriptParams(definitionScript, sqlParameters, { limit, skip, optionalSqlParams }),
      fromDefinition: true,
    };
  }
  if (service.tableName) {
    const qualified = `${quotePgIdentifier(schema)}.${quotePgIdentifier(service.tableName)}`;
    return { sourceSql: qualified, fromDefinition: false };
  }
  throw Object.assign(new Error('服务未绑定物化表或 SQL 定义，无法测试'), { status: 400 });
}

function qualifiedTable(service) {
  const schema = service.targetSchema || 'bizdata_mat';
  if (!service.tableName) {
    throw Object.assign(new Error('写操作测试需要绑定实体表'), { status: 400 });
  }
  return `${quotePgIdentifier(schema)}.${quotePgIdentifier(service.tableName)}`;
}

async function loadEntity(service) {
  if (!service?.entityId) return null;
  return businessDataService.getEntityById(service.entityId);
}

async function enrichServiceTableName(service) {
  if (service?.tableName || !service?.entityId) return service;
  const entity = await loadEntity(service);
  if (!entity) return service;
  const tableName = resolveEntityTableName(entity.code, entity.table_name || entity.tableName);
  if (!tableName) return service;
  return { ...service, tableName };
}

async function getTestExecutionOptions() {
  const features = await systemService.getSystemFeatures();
  return {
    allowWriteOperations: Boolean(features.apiServiceAllowWriteOperations),
    testAutoRollback: features.apiServiceTestAutoRollback !== false,
  };
}

async function runWriteTest(runtime, fn, { testAutoRollback = true } = {}) {
  const result = await withPgWriteTest(runtime, fn, { rollback: testAutoRollback });
  if (testAutoRollback && result && typeof result === 'object' && result.rolledBack === true) {
    const { rolledBack: _rb, ...rest } = result;
    return { preview: rest, rolledBack: true };
  }
  return { preview: result, rolledBack: false };
}

async function executeFindPg(client, service, parameters, execContext = {}) {
  const limit = parameters.limit ?? 20;
  const skip = parameters.skip ?? 0;
  const { sourceSql, fromDefinition } = buildFromSource(service, parameters, {
    limit,
    skip,
    operation: execContext.operation,
    entity: execContext.entity,
    enumMap: execContext.enumMap,
    gatewayPagination: true,
  });
  const filterEntries = resolveFilterEntries(parameters, service);
  const { clause, bindings, nextIndex } = buildParameterizedWhere(filterEntries);
  const sql = fromDefinition
    ? `SELECT * FROM (${sourceSql}) AS _svc${clause} LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`
    : `SELECT * FROM ${sourceSql}${clause} LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`;
  const res = await client.query(sql, [...bindings, limit, skip]);
  const countResult = await executeCountPg(client, service, parameters, execContext);
  return {
    items: res.rows,
    pagination: buildPaginationMeta({
      total: countResult.count,
      limit,
      skip,
    }),
  };
}

async function executeCountPg(client, service, parameters, execContext = {}) {
  const { sourceSql, fromDefinition } = buildFromSource(service, parameters, {
    limit: 20,
    skip: 0,
    operation: execContext.operation,
    entity: execContext.entity,
    enumMap: execContext.enumMap,
    gatewayPagination: true,
  });
  const filterEntries = resolveFilterEntries(parameters, service);
  const { clause, bindings } = buildParameterizedWhere(filterEntries);
  const sql = fromDefinition
    ? `SELECT COUNT(*)::int AS count FROM (${sourceSql}) AS _svc${clause}`
    : `SELECT COUNT(*)::int AS count FROM ${sourceSql}${clause}`;
  const res = await client.query(sql, bindings);
  return { count: res.rows[0]?.count ?? 0 };
}

async function executeFindByIdPg(client, service, parameters) {
  const table = qualifiedTable(service);
  const res = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [parameters.id]);
  return { item: res.rows[0] || null };
}

async function executeFindOnePg(client, service, parameters, execContext = {}) {
  const filterEntries = resolveFilterEntries(parameters, service);
  const { clause, bindings } = buildParameterizedWhere(filterEntries);
  const definitionScript = resolveDefinitionScript(service);

  if (definitionScript) {
    const { sourceSql } = buildFromSource(service, parameters, {
      limit: 20,
      skip: 0,
      operation: execContext.operation,
      entity: execContext.entity,
      enumMap: execContext.enumMap,
      gatewayPagination: true,
    });
    const sql = `SELECT * FROM (${sourceSql}) AS _svc${clause} LIMIT 1`;
    const res = await client.query(sql, bindings);
    return { item: res.rows[0] || null };
  }

  const table = qualifiedTable(service);
  const sql = `SELECT * FROM ${table}${clause} LIMIT 1`;
  const res = await client.query(sql, bindings);
  return { item: res.rows[0] || null };
}

function flattenSqlParameters(parameters) {
  const body = parameters?.body && typeof parameters.body === 'object' && !Array.isArray(parameters.body)
    ? parameters.body
    : {};
  const set = parameters?.set && typeof parameters.set === 'object' && !Array.isArray(parameters.set)
    ? parameters.set
    : {};
  return { ...parameters, ...body, ...set };
}

function usesCustomWriteSql(service) {
  return Boolean(resolveDefinitionScript(service)) && !service?.tableName;
}

async function executeCustomWriteSqlPg(client, service, parameters, operation, execContext = {}) {
  const definitionScript = resolveDefinitionScript(service);
  if (!definitionScript) {
    throw Object.assign(new Error('自定义写操作 SQL 未定义'), { status: 400 });
  }
  const optionalSqlParams = resolveOptionalSqlParamNames(
    service,
    operation,
    execContext.entity,
    execContext.enumMap,
  );
  const sql = applyScriptParams(
    definitionScript,
    flattenSqlParameters(parameters),
    { optionalSqlParams },
  );
  const res = await client.query(sql);

  if (operation === 'create' || operation === 'insertOne') {
    return { item: res.rows?.[0] ?? null };
  }
  if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
    return { item: res.rows?.[0] ?? null, matched: res.rowCount };
  }
  if (operation === 'deleteOne' || operation === 'findOneAndDelete') {
    return { item: res.rows?.[0] ?? null, deleted: res.rowCount };
  }
  return { rows: res.rows, rowCount: res.rowCount };
}

async function executeCreatePg(client, service, parameters, execContext = {}) {
  const table = qualifiedTable(service);
  let body = parameters.body || {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(
      new Error('create 操作的 body 须为 JSON 对象（实体字段键值），不能是字符串或数组'),
      { status: 400 },
    );
  }
  // 防御：仅写入实体已建模字段（拒绝未建模列）
  body = normalizeWriteBody(body, execContext.entity, 'body') || body;
  const keys = Object.keys(body);
  if (!keys.length) {
    throw Object.assign(new Error('create 操作需要 body 字段'), { status: 400 });
  }
  const cols = keys.map((k) => quotePgIdentifier(k)).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) => body[k]);
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const res = await client.query(sql, values);
  return { item: res.rows[0] };
}

async function executeUpdateOnePg(client, service, parameters, execContext = {}) {
  const table = qualifiedTable(service);
  let patch = parameters.set || parameters.body || {};
  patch = normalizeWriteBody(patch, execContext.entity, parameters.set ? 'set' : 'body') || patch;
  const keys = Object.keys(patch || {});
  if (!keys.length) {
    throw Object.assign(new Error('updateOne 操作需要 set 或 body 字段'), { status: 400 });
  }
  const sets = keys.map((k, i) => `${quotePgIdentifier(k)} = $${i + 1}`).join(', ');
  const values = [...keys.map((k) => patch[k]), parameters.id];
  const sql = `UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`;
  const res = await client.query(sql, values);
  return { item: res.rows[0] || null, matched: res.rowCount };
}

async function executeDeleteOnePg(client, service, parameters) {
  const table = qualifiedTable(service);
  const res = await client.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [parameters.id]);
  return { item: res.rows[0] || null, deleted: res.rowCount };
}

async function executeOperation(client, service, operation, parameters, execContext = {}) {
  const ctx = { ...execContext, operation };
  if (usesCustomWriteSql(service) && isWriteOperation(operation)) {
    return executeCustomWriteSqlPg(client, service, parameters, operation, ctx);
  }

  if (operation === 'find') {
    return executeFindPg(client, service, parameters, ctx);
  }
  if (operation === 'count' || operation === 'countDocuments') {
    return executeCountPg(client, service, parameters, ctx);
  }
  if (operation === 'findById') {
    return executeFindByIdPg(client, service, parameters);
  }
  if (operation === 'findOne' || operation === 'exists') {
    return executeFindOnePg(client, service, parameters, ctx);
  }
  if (operation === 'create' || operation === 'insertOne') {
    return executeCreatePg(client, service, parameters, ctx);
  }
  if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
    return executeUpdateOnePg(client, service, parameters, ctx);
  }
  if (operation === 'deleteOne' || operation === 'findOneAndDelete') {
    return executeDeleteOnePg(client, service, parameters);
  }
  throw Object.assign(new Error(`暂不支持测试 operation: ${operation}`), { status: 400 });
}

function buildRequestMeta(service, operation, parameters) {
  const meta = getOperationMeta(operation);
  const preview = buildRequestPreview(service, operation, parameters);
  return {
    operation,
    httpMethod: preview.method || meta?.httpMethod || 'GET',
    url: preview.url,
    query: preview.query,
    body: preview.body,
    pathParams: preview.pathParams,
  };
}

function resolveHandlerOptionalParamNames(service) {
  const interfaceText = service?.requestParameterInterface
    || service?.request_parameter_interface
    || '';
  const { fields } = parseRequestParameterInterface(interfaceText);
  const optional = new Set();
  Object.entries(fields).forEach(([name, meta]) => {
    if (meta?.required === false) optional.add(name);
  });
  // 未在 interface 声明的命名参数一律按可选（缺省绑 NULL）
  return optional;
}

/**
 * queryPg 语义：
 * 1) queryPg(sql, [v1, v2]) — 位置参数；sql 勿混用 :name
 * 2) queryPg(sql, { nearest_only: true }) — 命名绑定
 * 3) queryPg(sql) 或 queryPg(sql, []) 且含 :name — 自动用 parameters
 */
function resolveQueryPgBindings(sql, bindings, parameters, optionalNames) {
  const hasNamed = sqlHasNamedParams(sql);
  const isArray = Array.isArray(bindings);
  const isObject = bindings != null
    && typeof bindings === 'object'
    && !Array.isArray(bindings);

  if (isArray && bindings.length > 0) {
    if (hasNamed) {
      throw Object.assign(
        new Error('queryPg 使用位置参数数组时，SQL 不应再含 :name 命名参数；请改用 $1 或传入对象绑定'),
        { status: 400 },
      );
    }
    return { sql, bindings };
  }

  if (isObject || hasNamed) {
    const values = isObject ? { ...(parameters || {}), ...bindings } : (parameters || {});
    return bindNamedSqlParams(sql, values, {
      optionalNames,
      allowMissingAsNull: true,
    });
  }

  return { sql, bindings: isArray ? bindings : [] };
}

async function executeTypeScriptHandler(runtime, service, operation, parameters, client = null) {
  const handlerScript = resolveHandlerScript(service);
  const optionalNames = resolveHandlerOptionalParamNames(service);

  // 内部弃用兜底：旧 Handler 仍可用 queryPg；新代码应使用 db SDK
  const queryPg = async (sql, bindings = []) => {
    const resolved = resolveQueryPgBindings(sql, bindings, parameters, optionalNames);
    if (client) {
      const res = await client.query(resolved.sql, resolved.bindings);
      return res.rows;
    }
    return withPgClient(runtime, async (pgClient) => {
      const res = await pgClient.query(resolved.sql, resolved.bindings);
      return res.rows;
    });
  };

  const { db } = createHandlerSdk({ service, client, runtime });

  const ctx = buildHandlerContext({
    service,
    operation,
    parameters,
    queryPg,
    db,
    user: { bypassAccessControl: true },
    bypassAccessControl: true,
  });

  return executeHandlerScript(handlerScript, ctx, {
    params: ctx.params,
    db,
  });
}

async function testService(serviceId, {
  operation,
  parameters,
  bypassAccessControl = true,
  authContext = null,
  enforceHandlerTypeCheck = false,
} = {}) {
  const service = await apiServiceService.getServiceById(serviceId, {
    includeOperations: true,
    includePermissions: true,
  });
  if (!service) return null;

  const executionOptions = await getTestExecutionOptions();
  const serviceForTest = await enrichServiceTableName(service);

  assertAccessAllowed(serviceForTest, authContext, { bypass: bypassAccessControl !== false });

  const enabledOps = serviceForTest.enabledOperations || [];
  const op = operation || pickDefaultOperation(enabledOps);

  if (!op) {
    throw Object.assign(new Error('该服务未启用任何 operation'), { status: 400 });
  }
  if (!enabledOps.includes(op)) {
    throw Object.assign(new Error(`operation "${op}" 未在该服务中启用`), { status: 400 });
  }

  if (enforceHandlerTypeCheck && serviceForTest.scriptMode === 'typescript') {
    assertHandlerScriptValid(resolveHandlerScript(serviceForTest), {
      requestParameterInterface: serviceForTest.requestParameterInterface,
    });
  }

  const entity = await loadEntity(serviceForTest);
  const enumMap = await loadEnumMapForEntity(entity, serviceForTest);
  const validated = validateParameters(serviceForTest, op, parameters || {}, entity, enumMap);
  const requestPreview = buildRequestPreview(serviceForTest, op, validated, entity);
  const execCheck = isOperationExecutable(serviceForTest, op, executionOptions);

  const conn = await databaseConnectionService.resolveConnectionRecord(serviceForTest.connectionId);
  const runtime = databaseConnectionService.buildRuntimeConfig(conn);
  if (runtime.dbType !== 'postgresql') {
    throw Object.assign(
      new Error(`暂不支持 ${runtime.dbType} 连接类型的测试请求`),
      { status: 501 },
    );
  }

  const start = Date.now();
  const requestMeta = buildRequestMeta(serviceForTest, op, validated);

  if (!execCheck.executable) {
    return {
      serviceId: serviceForTest.id,
      code: serviceForTest.code,
      ...requestMeta,
      parameters: validated,
      requestPreview,
      durationMs: Date.now() - start,
      executable: false,
      executableReason: execCheck.reason,
      preview: null,
    };
  }

  let preview;
  let rolledBack = false;

  if (serviceForTest.scriptMode === 'typescript') {
    if (isWriteOperation(op)) {
      const { preview: writePreview, rolledBack: writeRolledBack } = await runWriteTest(
        runtime,
        async (client) => executeTypeScriptHandler(runtime, serviceForTest, op, validated, client),
        { testAutoRollback: executionOptions.testAutoRollback },
      );
      preview = writePreview;
      rolledBack = writeRolledBack;
    } else {
      preview = await executeTypeScriptHandler(runtime, serviceForTest, op, validated);
    }
  } else {
    const run = async (client) => executeOperation(client, serviceForTest, op, validated, {
      entity,
      enumMap,
    });

    if (isWriteOperation(op)) {
      const { preview: writePreview, rolledBack: writeRolledBack } = await runWriteTest(
        runtime,
        run,
        { testAutoRollback: executionOptions.testAutoRollback },
      );
      preview = writePreview;
      rolledBack = writeRolledBack;
    } else {
      preview = await withPgClient(runtime, run);
    }
  }

  preview = normalizeListResult(preview, validated);

  return {
    serviceId: serviceForTest.id,
    code: serviceForTest.code,
    ...requestMeta,
    parameters: validated,
    requestPreview,
    durationMs: Date.now() - start,
    executable: true,
    rolledBack,
    preview,
  };
}

module.exports = {
  pickDefaultOperation,
  testService,
  stripTrailingLimitOffset,
};
