const {
  findMaterializedTargets,
} = require('./materializedTableRenameService');
const databaseConnectionService = require('./databaseConnectionService');
const {
  withPgClient,
  withMysqlClient,
  quotePgIdentifier,
  quoteMysqlIdentifier,
} = require('./materialization/connectionRunner');
const { resolveEntityTableName } = require('./entityTableName');

let mongoClientPromise;
let redisPromise;

async function getMongoClient() {
  if (!mongoClientPromise) {
    mongoClientPromise = import('mongodb');
  }
  return mongoClientPromise;
}

async function getRedisClient() {
  if (!redisPromise) {
    redisPromise = import('redis');
  }
  return redisPromise;
}

function buildMongoUri(runtime) {
  const auth = runtime.username
    ? `${encodeURIComponent(runtime.username)}:${encodeURIComponent(runtime.password || '')}@`
    : '';
  return `mongodb://${auth}${runtime.host}:${runtime.port}/${runtime.databaseName}?authSource=admin`;
}

function buildRedisUrl(runtime) {
  const auth = runtime.password
    ? `${encodeURIComponent(runtime.username || 'default')}:${encodeURIComponent(runtime.password)}@`
    : '';
  return `redis://${auth}${runtime.host}:${runtime.port}/${runtime.databaseName || '0'}`;
}

async function withMongoClient(runtime, fn) {
  const { MongoClient } = await getMongoClient();
  const client = new MongoClient(buildMongoUri(runtime));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function withRedisClient(runtime, fn) {
  const redis = await getRedisClient();
  const client = redis.createClient({ url: buildRedisUrl(runtime) });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

async function scanRedisKeys(client, pattern, count = 200) {
  const keys = [];
  let cursor = 0;
  do {
    // eslint-disable-next-line no-await-in-loop
    const reply = await client.scan(cursor, { MATCH: pattern, COUNT: count });
    cursor = Number(reply.cursor);
    keys.push(...reply.keys);
  } while (cursor !== 0);
  return keys;
}

async function pgTableExists(client, schemaName, tableName) {
  const res = await client.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1',
    [schemaName, tableName],
  );
  return res.rowCount > 0;
}

async function dropPgTable(runtime, targetSchema, tableName) {
  return withPgClient(runtime, async (client) => {
    const exists = await pgTableExists(client, targetSchema, tableName);
    if (!exists) return { status: 'missing' };
    const qualified = `${quotePgIdentifier(targetSchema)}.${quotePgIdentifier(tableName)}`;
    await client.query(`DROP TABLE IF EXISTS ${qualified} CASCADE`);
    return { status: 'dropped' };
  });
}

async function mysqlTableExists(conn, schemaName, tableName) {
  const [rows] = await conn.query(
    'SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1',
    [schemaName, tableName],
  );
  return rows.length > 0;
}

async function dropMysqlTable(runtime, targetSchema, tableName) {
  return withMysqlClient(runtime, async (conn) => {
    const exists = await mysqlTableExists(conn, targetSchema, tableName);
    if (!exists) return { status: 'missing' };
    const qualified = `${quoteMysqlIdentifier(targetSchema)}.${quoteMysqlIdentifier(tableName)}`;
    await conn.query(`DROP TABLE IF EXISTS ${qualified}`);
    return { status: 'dropped' };
  });
}

async function dropMongoCollection(runtime, targetSchema, tableName) {
  return withMongoClient(runtime, async (client) => {
    const db = client.db(targetSchema);
    const exists = (await db.listCollections({ name: tableName }).toArray()).length > 0;
    if (!exists) return { status: 'missing' };
    await db.collection(tableName).drop();
    return { status: 'dropped' };
  });
}

async function dropRedisEntityKeys(runtime, targetSchema, tableName) {
  const prefix = String(targetSchema).replace(/:$/, '');
  return withRedisClient(runtime, async (client) => {
    const schemaKey = `${prefix}:schema:${tableName}`;
    const pattern = `${prefix}:${tableName}:*`;
    const keys = await scanRedisKeys(client, pattern);
    const allKeys = [...new Set([schemaKey, ...keys])];
    let keysDeleted = 0;
    for (const key of allKeys) {
      // eslint-disable-next-line no-await-in-loop
      const n = await client.del(key);
      keysDeleted += n;
    }
    if (keysDeleted === 0) return { status: 'missing', keysDeleted: 0 };
    return { status: 'dropped', keysDeleted };
  });
}

async function dropOnTarget(target, tableName) {
  const runtime = databaseConnectionService.buildRuntimeConfig(target.connection);
  const schema = target.targetSchema || runtime.targetSchema;
  if (!schema) {
    throw new Error(`连接「${target.connectionName || target.connectionId}」未配置 targetSchema`);
  }

  let result;
  if (runtime.dbType === 'postgresql') {
    result = await dropPgTable(runtime, schema, tableName);
  } else if (runtime.dbType === 'mysql') {
    result = await dropMysqlTable(runtime, schema, tableName);
  } else if (runtime.dbType === 'mongodb') {
    result = await dropMongoCollection(runtime, schema, tableName);
  } else if (runtime.dbType === 'redis') {
    result = await dropRedisEntityKeys(runtime, schema, tableName);
  } else {
    throw new Error(`不支持的数据库类型: ${runtime.dbType}`);
  }

  return {
    connectionId: target.connectionId,
    connectionName: target.connectionName,
    dbType: runtime.dbType,
    targetSchema: schema,
    tableName,
    ...result,
  };
}

/**
 * 收集实体已物化物理表目标（不含执行 DROP）。
 * @returns {Promise<Array<{ entityId, entityCode, connectionId, connectionName, dbType, targetSchema, tableName }>>}
 */
async function collectPhysicalDropTargets(entities) {
  const results = [];
  for (const entity of entities) {
    const tableName = resolveEntityTableName(entity.code, entity.table_name || entity.tableName);
    if (!tableName) continue;
    // eslint-disable-next-line no-await-in-loop
    const targets = await findMaterializedTargets(entity.id);
    for (const target of targets) {
      results.push({
        entityId: entity.id,
        entityCode: entity.code,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        dbType: target.dbType,
        targetSchema: target.targetSchema,
        tableName,
        connection: target.connection,
      });
    }
  }
  return results;
}

/**
 * Best-effort DROP 物理表/集合。单项失败不中断，结果写入 items。
 */
async function dropMaterializedPhysicalTables(dropTargets) {
  const items = [];
  for (const target of dropTargets || []) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const item = await dropOnTarget(
        {
          connectionId: target.connectionId,
          connectionName: target.connectionName,
          connection: target.connection,
          targetSchema: target.targetSchema,
        },
        target.tableName,
      );
      items.push({
        entityId: target.entityId,
        entityCode: target.entityCode,
        ...item,
        ok: true,
      });
    } catch (err) {
      items.push({
        entityId: target.entityId,
        entityCode: target.entityCode,
        connectionId: target.connectionId,
        connectionName: target.connectionName,
        dbType: target.dbType,
        targetSchema: target.targetSchema,
        tableName: target.tableName,
        status: 'error',
        ok: false,
        error: err.message || String(err),
      });
    }
  }
  return { items };
}

module.exports = {
  dropOnTarget,
  collectPhysicalDropTargets,
  dropMaterializedPhysicalTables,
};
