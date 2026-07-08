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
} = require('./operationParameterSchemas');
const { executeHandlerScript, buildHandlerContext } = require('./apiServiceHandlerRuntime');
const { assertAccessAllowed } = require('./apiServicePermissionService');

function pickDefaultOperation(enabledOperations) {
  const enabled = Array.isArray(enabledOperations) ? enabledOperations : [];
  return enabled[0] || null;
}

function applyScriptParams(script, parameters, { limit, skip } = {}) {
  let next = script.replace(/;\s*$/, '');
  next = next.replace(/:limit\b/gi, String(limit ?? 20));
  next = next.replace(/:skip\b/gi, String(skip ?? 0));
  extractSqlNamedParams(script).forEach((name) => {
    if (parameters?.[name] != null) {
      const pattern = new RegExp(`(?<!:):${name}\\b`, 'gi');
      const value = parameters[name];
      const replacement = typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
      next = next.replace(pattern, replacement);
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

function buildFromSource(service, parameters, { limit, skip } = {}) {
  const schema = service.targetSchema || 'bizdata_mat';
  const definitionScript = resolveDefinitionScript(service);
  if (definitionScript) {
    return {
      sourceSql: applyScriptParams(definitionScript, parameters, { limit, skip }),
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

async function executeFindPg(client, service, parameters) {
  const limit = parameters.limit ?? 20;
  const skip = parameters.skip ?? 0;
  const { sourceSql, fromDefinition } = buildFromSource(service, parameters, { limit, skip });
  const sql = fromDefinition
    ? `SELECT * FROM (${sourceSql}) AS _svc LIMIT $1 OFFSET $2`
    : `SELECT * FROM ${sourceSql} LIMIT $1 OFFSET $2`;
  const res = await client.query(sql, [limit, skip]);
  return { items: res.rows, count: res.rowCount };
}

async function executeCountPg(client, service, parameters) {
  const { sourceSql, fromDefinition } = buildFromSource(service, parameters, { limit: 20, skip: 0 });
  const sql = fromDefinition
    ? `SELECT COUNT(*)::int AS count FROM (${sourceSql}) AS _svc`
    : `SELECT COUNT(*)::int AS count FROM ${sourceSql}`;
  const res = await client.query(sql);
  return { count: res.rows[0]?.count ?? 0 };
}

async function executeFindByIdPg(client, service, parameters) {
  const table = qualifiedTable(service);
  const res = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [parameters.id]);
  return { item: res.rows[0] || null };
}

async function executeFindOnePg(client, service, parameters) {
  const table = qualifiedTable(service);
  const res = await client.query(`SELECT * FROM ${table} LIMIT 1`);
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

async function executeCustomWriteSqlPg(client, service, parameters, operation) {
  const definitionScript = resolveDefinitionScript(service);
  if (!definitionScript) {
    throw Object.assign(new Error('自定义写操作 SQL 未定义'), { status: 400 });
  }
  const sql = applyScriptParams(definitionScript, flattenSqlParameters(parameters));
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

async function executeCreatePg(client, service, parameters) {
  const table = qualifiedTable(service);
  const body = parameters.body || {};
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

async function executeUpdateOnePg(client, service, parameters) {
  const table = qualifiedTable(service);
  const patch = parameters.set || parameters.body || {};
  const keys = Object.keys(patch);
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

async function executeOperation(client, service, operation, parameters) {
  if (usesCustomWriteSql(service) && isWriteOperation(operation)) {
    return executeCustomWriteSqlPg(client, service, parameters, operation);
  }

  if (operation === 'find') {
    return executeFindPg(client, service, parameters);
  }
  if (operation === 'count' || operation === 'countDocuments') {
    return executeCountPg(client, service, parameters);
  }
  if (operation === 'findById') {
    return executeFindByIdPg(client, service, parameters);
  }
  if (operation === 'findOne' || operation === 'exists') {
    return executeFindOnePg(client, service, parameters);
  }
  if (operation === 'create' || operation === 'insertOne') {
    return executeCreatePg(client, service, parameters);
  }
  if (operation === 'updateOne' || operation === 'findOneAndUpdate') {
    return executeUpdateOnePg(client, service, parameters);
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

async function executeTypeScriptHandler(runtime, service, operation, parameters, client = null) {
  const handlerScript = resolveHandlerScript(service);
  const queryPg = async (sql, bindings = []) => {
    if (client) {
      const res = await client.query(sql, bindings);
      return res.rows;
    }
    return withPgClient(runtime, async (pgClient) => {
      const res = await pgClient.query(sql, bindings);
      return res.rows;
    });
  };

  const ctx = buildHandlerContext({
    service,
    operation,
    parameters,
    queryPg,
    user: { bypassAccessControl: true },
    bypassAccessControl: true,
  });

  return executeHandlerScript(handlerScript, ctx);
}

async function testService(serviceId, {
  operation,
  parameters,
  bypassAccessControl = true,
  authContext = null,
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

  const entity = await loadEntity(serviceForTest);
  const validated = validateParameters(serviceForTest, op, parameters || {}, entity);
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
    const run = async (client) => executeOperation(client, serviceForTest, op, validated);

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
};
