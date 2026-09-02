const apiServiceService = require('./apiServiceService');
const businessDataService = require('../businessData/businessDataService');
const databaseConnectionService = require('../businessData/databaseConnectionService');
const systemService = require('../system/systemService');
const { resolveEntityTableName } = require('../businessData/entityTableName');
const { getOperationMeta } = require('./operationCatalog');
const {
  assertSqlDbType,
  quoteIdent,
  qualifiedTable: dialectQualifiedTable,
  countExpr,
  adaptSqlIdentifiers,
  withSqlClient,
  withSqlWriteTest,
  insertThenSelect,
  updateThenSelect,
  selectThenDelete,
  assertNoReturningForMysql,
} = require('./sqlDialect');
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
const { serializeWriteRow } = require('./pgWriteSerialize');

function pickDefaultOperation(enabledOperations) {
  const enabled = Array.isArray(enabledOperations) ? enabledOperations : [];
  return enabled[0] || null;
}

function clientDbType(client, execContext = {}) {
  return client?.dbType || execContext.dbType || 'postgresql';
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

function applyScriptParams(script, parameters, { limit, skip, optionalSqlParams, dbType = 'postgresql' } = {}) {
  const optional = optionalSqlParams instanceof Set
    ? optionalSqlParams
    : new Set(optionalSqlParams || []);
  let next = script.replace(/;\s*$/, '');
  next = adaptSqlIdentifiers(next, dbType);
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
      next = next.replace(pattern, quoteIdent(name, dbType));
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
  dbType = 'postgresql',
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
      sourceSql: applyScriptParams(definitionScript, sqlParameters, {
        limit,
        skip,
        optionalSqlParams,
        dbType,
      }),
      fromDefinition: true,
    };
  }
  if (service.tableName) {
    return {
      sourceSql: dialectQualifiedTable(schema, service.tableName, dbType),
      fromDefinition: false,
    };
  }
  throw Object.assign(new Error('服务未绑定物化表或 SQL 定义，无法测试'), { status: 400 });
}

function qualifiedTable(service, dbType = 'postgresql') {
  const schema = service.targetSchema || 'bizdata_mat';
  if (!service.tableName) {
    throw Object.assign(new Error('写操作测试需要绑定实体表'), { status: 400 });
  }
  return dialectQualifiedTable(schema, service.tableName, dbType);
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
  const result = await withSqlWriteTest(runtime, fn, { rollback: testAutoRollback });
  if (testAutoRollback && result && typeof result === 'object' && result.rolledBack === true) {
    const { rolledBack: _rb, ...rest } = result;
    return { preview: rest, rolledBack: true };
  }
  return { preview: result, rolledBack: false };
}

async function executeFind(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const limit = parameters.limit ?? 20;
  const skip = parameters.skip ?? 0;
  const { sourceSql, fromDefinition } = buildFromSource(service, parameters, {
    limit,
    skip,
    operation: execContext.operation,
    entity: execContext.entity,
    enumMap: execContext.enumMap,
    dbType,
    gatewayPagination: true,
  });
  const filterEntries = resolveFilterEntries(parameters, service);
  const { clause, bindings, nextIndex } = buildParameterizedWhere(filterEntries, { dbType });
  // 子查询闭合 `)` 必须另起一行，否则会落到 definition 末尾 `--` 注释同行被吃掉
  const nested = fromDefinition ? `(${sourceSql}\n)` : sourceSql;
  const sql = fromDefinition
    ? `SELECT * FROM ${nested} AS _svc${clause} LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`
    : `SELECT * FROM ${nested}${clause} LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`;
  const res = await client.query(sql, [...bindings, limit, skip]);
  const countResult = await executeCount(client, service, parameters, execContext);
  return {
    items: res.rows,
    pagination: buildPaginationMeta({
      total: countResult.count,
      limit,
      skip,
    }),
  };
}

async function executeCount(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const { sourceSql, fromDefinition } = buildFromSource(service, parameters, {
    limit: 20,
    skip: 0,
    operation: execContext.operation,
    entity: execContext.entity,
    enumMap: execContext.enumMap,
    dbType,
    gatewayPagination: true,
  });
  const filterEntries = resolveFilterEntries(parameters, service);
  const { clause, bindings } = buildParameterizedWhere(filterEntries, { dbType });
  const countSelect = `${countExpr(dbType)} AS count`;
  const nested = fromDefinition ? `(${sourceSql}\n)` : sourceSql;
  const sql = fromDefinition
    ? `SELECT ${countSelect} FROM ${nested} AS _svc${clause}`
    : `SELECT ${countSelect} FROM ${nested}${clause}`;
  const res = await client.query(sql, bindings);
  return { count: Number(res.rows[0]?.count ?? 0) };
}

async function executeFindById(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const table = qualifiedTable(service, dbType);
  const res = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [parameters.id]);
  return { item: res.rows[0] || null };
}

async function executeFindOne(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const filterEntries = resolveFilterEntries(parameters, service);
  const { clause, bindings } = buildParameterizedWhere(filterEntries, { dbType });
  const definitionScript = resolveDefinitionScript(service);

  if (definitionScript) {
    const { sourceSql } = buildFromSource(service, parameters, {
      limit: 20,
      skip: 0,
      operation: execContext.operation,
      entity: execContext.entity,
      enumMap: execContext.enumMap,
      dbType,
      gatewayPagination: true,
    });
    const sql = `SELECT * FROM (${sourceSql}\n) AS _svc${clause} LIMIT 1`;
    const res = await client.query(sql, bindings);
    return { item: res.rows[0] || null };
  }

  const table = qualifiedTable(service, dbType);
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

async function executeCustomWriteSql(client, service, parameters, operation, execContext = {}) {
  const dbType = clientDbType(client, execContext);
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
    { optionalSqlParams, dbType },
  );
  assertNoReturningForMysql(sql, dbType);
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

async function executeCreate(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const table = qualifiedTable(service, dbType);
  let body = parameters.body || {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(
      new Error('create 操作的 body 须为 JSON 对象（实体字段键值），不能是字符串或数组'),
      { status: 400 },
    );
  }
  // 契约：仅写入实体已建模字段（拒绝未建模列）
  body = normalizeWriteBody(body, execContext.entity, 'body') || body;
  body = serializeWriteRow(body, execContext.entity);
  const keys = Object.keys(body);
  if (!keys.length) {
    throw Object.assign(new Error('create 操作需要 body 字段'), { status: 400 });
  }
  const { item } = await insertThenSelect(client, table, body);
  return { item };
}

async function executeUpdateOne(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const table = qualifiedTable(service, dbType);
  let patch = parameters.set || parameters.body || {};
  patch = normalizeWriteBody(patch, execContext.entity, parameters.set ? 'set' : 'body') || patch;
  patch = serializeWriteRow(patch, execContext.entity);
  const keys = Object.keys(patch || {});
  if (!keys.length) {
    throw Object.assign(new Error('updateOne 操作需要 set 或 body 字段'), { status: 400 });
  }
  const setBindings = keys.map((k) => patch[k]);
  const setSql = keys.map((k, i) => `${quoteIdent(k, dbType)} = $${i + 1}`).join(', ');
  const whereClause = ` WHERE ${quoteIdent('id', dbType)} = $${keys.length + 1}`;
  const { item, matched, before } = await updateThenSelect(client, table, {
    setSql,
    setBindings,
    whereClause,
    whereBindings: [parameters.id],
  });
  return { item, matched, before };
}

async function executeDeleteOne(client, service, parameters, execContext = {}) {
  const dbType = clientDbType(client, execContext);
  const table = qualifiedTable(service, dbType);
  const whereClause = ` WHERE ${quoteIdent('id', dbType)} = $1`;
  const { item, deleted, before } = await selectThenDelete(client, table, {
    whereClause,
    whereBindings: [parameters.id],
  });
  return { item, deleted, before };
}

async function executeOperation(client, service, operation, parameters, execContext = {}) {
  const ctx = { ...execContext, operation, dbType: clientDbType(client, execContext) };
  if (usesCustomWriteSql(service) && isWriteOperation(operation)) {
    return executeCustomWriteSql(client, service, parameters, operation, ctx);
  }

  if (operation === 'find') {
    return executeFind(client, service, parameters, ctx);
  }
  if (operation === 'count' || operation === 'countDocuments') {
    return executeCount(client, service, parameters, ctx);
  }
  if (operation === 'findById') {
    return executeFindById(client, service, parameters, ctx);
  }
  if (operation === 'findOne' || operation === 'exists') {
    return executeFindOne(client, service, parameters, ctx);
  }
  if (operation === 'create' || operation === 'insertOne') {
    return executeCreate(client, service, parameters, ctx);
  }
  if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
    return executeUpdateOne(client, service, parameters, ctx);
  }
  if (operation === 'deleteOne' || operation === 'findOneAndDelete') {
    return executeDeleteOne(client, service, parameters, ctx);
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
    return withSqlClient(runtime, async (sqlClient) => {
      const res = await sqlClient.query(resolved.sql, resolved.bindings);
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

/** 网关实体写 operation → 记录事件种类（自定义写 SQL / TS Handler 不在此列，不发记录事件） */
const GATEWAY_WRITE_RECORD_KINDS = {
  create: 'created',
  insertOne: 'created',
  updateOne: 'updated',
  findOneAndUpdate: 'updated',
  deleteOne: 'deleted',
  findOneAndDelete: 'deleted',
};

function diffChangedFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];
  keys.forEach((k) => {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) changed.push(k);
  });
  return changed;
}

/** 从网关实体写结果提取 before/after（供 bizdata.record.* 事件负载使用） */
function buildWriteInfo(operation, rawPreview) {
  const kind = GATEWAY_WRITE_RECORD_KINDS[operation];
  if (!kind || !rawPreview || typeof rawPreview !== 'object') return null;
  if (kind === 'created') {
    return { kind, before: null, after: rawPreview.item ?? null, changedFields: null };
  }
  if (kind === 'updated') {
    const before = rawPreview.before ?? null;
    const after = rawPreview.item ?? null;
    return {
      kind,
      before,
      after,
      changedFields: before && after ? diffChangedFields(before, after) : null,
    };
  }
  return { kind, before: rawPreview.before ?? rawPreview.item ?? null, after: null, changedFields: null };
}

/**
 * 服务执行共享核心。
 * writeMode:
 *  - 'test'   写操作按系统特性 apiServiceTestAutoRollback 决定回滚（Admin 测试台 / AI 测试）
 *  - 'commit' 写操作永不回滚、真实 COMMIT（生产 Data API / 钩子 internal_api 动作）
 */
async function runServiceOperation(serviceId, {
  operation,
  parameters,
  bypassAccessControl = true,
  authContext = null,
  enforceHandlerTypeCheck = false,
  writeMode = 'test',
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
  assertSqlDbType(runtime);

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

  const testAutoRollback = writeMode === 'commit' ? false : executionOptions.testAutoRollback;

  let preview;
  let rolledBack = false;
  let rawWritePreview = null;
  const execContext = { entity, enumMap, dbType: runtime.dbType };
  const isGatewayEntityWrite = serviceForTest.scriptMode !== 'typescript'
    && !usesCustomWriteSql(serviceForTest)
    && Boolean(GATEWAY_WRITE_RECORD_KINDS[op]);

  if (serviceForTest.scriptMode === 'typescript') {
    if (isWriteOperation(op)) {
      const { preview: writePreview, rolledBack: writeRolledBack } = await runWriteTest(
        runtime,
        async (client) => executeTypeScriptHandler(runtime, serviceForTest, op, validated, client),
        { testAutoRollback },
      );
      preview = writePreview;
      rolledBack = writeRolledBack;
    } else {
      preview = await executeTypeScriptHandler(runtime, serviceForTest, op, validated);
    }
  } else {
    const run = async (client) => executeOperation(client, serviceForTest, op, validated, execContext);

    if (isWriteOperation(op)) {
      const { preview: writePreview, rolledBack: writeRolledBack } = await runWriteTest(
        runtime,
        run,
        { testAutoRollback },
      );
      preview = writePreview;
      rolledBack = writeRolledBack;
      if (isGatewayEntityWrite) rawWritePreview = preview;
    } else {
      preview = await withSqlClient(runtime, run);
    }
  }

  preview = normalizeListResult(preview, validated);

  const result = {
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

  if (writeMode === 'commit') {
    result.entityCode = serviceForTest.entityCode
      || entity?.code
      || null;
    result.operation = op;
    // 网关实体写才有 write 信息（自定义写 SQL / TS Handler 不发 bizdata.record.*）
    result.write = isGatewayEntityWrite ? buildWriteInfo(op, rawWritePreview) : null;
  }

  return result;
}

/** Admin 测试台 / AI 测试：写操作按系统特性默认回滚 */
async function testService(serviceId, opts = {}) {
  return runServiceOperation(serviceId, { ...opts, writeMode: 'test' });
}

/**
 * 生产执行：已发布 Data API 与钩子 internal_api 动作专用。
 * 写操作永不回滚（真实 COMMIT）；返回值附执行元信息（entityCode / operation / write）供事件层使用。
 */
async function executePublished(serviceId, opts = {}) {
  return runServiceOperation(serviceId, { ...opts, writeMode: 'commit' });
}

module.exports = {
  pickDefaultOperation,
  testService,
  executePublished,
  stripTrailingLimitOffset,
};
