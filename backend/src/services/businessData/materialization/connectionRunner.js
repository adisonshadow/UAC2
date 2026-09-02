const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');

let mongoClientPromise;
let redisPromise;

const MYSQL_MIN_VERSION = { major: 8, minor: 0, patch: 13 };

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

function parseMysqlVersion(versionStr) {
  const m = String(versionStr || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function isMysqlVersionAtLeast(parsed, min = MYSQL_MIN_VERSION) {
  if (!parsed) return false;
  if (parsed.major !== min.major) return parsed.major > min.major;
  if (parsed.minor !== min.minor) return parsed.minor > min.minor;
  return parsed.patch >= min.patch;
}

async function assertMysqlVersion(conn) {
  const [rows] = await conn.query('SELECT VERSION() AS version');
  const version = rows?.[0]?.version;
  const parsed = parseMysqlVersion(version);
  if (!isMysqlVersionAtLeast(parsed)) {
    throw new Error(
      `MySQL 版本须 ≥ ${MYSQL_MIN_VERSION.major}.${MYSQL_MIN_VERSION.minor}.${MYSQL_MIN_VERSION.patch}（当前: ${version || '未知'}）`,
    );
  }
  return version;
}

async function withPgClient(runtime, fn) {
  const client = new PgClient({
    host: runtime.host,
    port: runtime.port,
    user: runtime.username,
    password: runtime.password,
    database: runtime.databaseName
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function withMysqlClient(runtime, fn, { database } = {}) {
  const conn = await mysql.createConnection({
    host: runtime.host,
    port: runtime.port || 3306,
    user: runtime.username,
    password: runtime.password || undefined,
    database: database !== undefined ? database : runtime.databaseName,
    multipleStatements: false,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

/** 测试专用：在事务内执行写操作；rollback=true 时成功后 ROLLBACK，否则 COMMIT 落库 */
async function withPgWriteTest(runtime, fn, { rollback = true } = {}) {
  return withPgClient(runtime, async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      if (rollback) {
        await client.query('ROLLBACK');
        return { ...result, rolledBack: true };
      }
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

/** @deprecated 使用 withPgWriteTest(runtime, fn, { rollback: true }) */
async function withPgTransaction(runtime, fn) {
  return withPgWriteTest(runtime, fn, { rollback: true });
}

async function testConnection(runtime) {
  if (runtime.dbType === 'postgresql') {
    await withPgClient(runtime, async (client) => {
      await client.query('SELECT 1');
    });
    return;
  }

  if (runtime.dbType === 'mysql') {
    await withMysqlClient(runtime, async (conn) => {
      await assertMysqlVersion(conn);
      await conn.query('SELECT 1');
    });
    return;
  }

  if (runtime.dbType === 'mongodb') {
    const { MongoClient } = await getMongoClient();
    const client = new MongoClient(buildMongoUri(runtime));
    await client.connect();
    try {
      await client.db(runtime.databaseName).command({ ping: 1 });
    } finally {
      await client.close();
    }
    return;
  }

  if (runtime.dbType === 'redis') {
    const redis = await getRedisClient();
    const client = redis.createClient({ url: buildRedisUrl(runtime) });
    await client.connect();
    try {
      await client.ping();
    } finally {
      await client.quit();
    }
    return;
  }

  throw new Error(`不支持的数据库类型: ${runtime.dbType}`);
}

function quotePgIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function quoteMysqlIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function checkPgSchemaExists(client, schemaName) {
  const res = await client.query(
    'SELECT 1 FROM information_schema.schemata WHERE schema_name = $1 LIMIT 1',
    [schemaName]
  );
  return res.rowCount > 0;
}

async function ensurePgSchema(client, schemaName) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotePgIdentifier(schemaName)}`);
}

async function checkMysqlDatabaseExists(conn, dbName) {
  const [rows] = await conn.query(
    'SELECT 1 AS ok FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1',
    [dbName],
  );
  return rows.length > 0;
}

async function ensureMysqlDatabase(conn, dbName) {
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${quoteMysqlIdentifier(dbName)}`);
}

async function checkMongoDatabaseExists(client, dbName) {
  const { databases } = await client.db().admin().listDatabases();
  return databases.some((db) => db.name === dbName);
}

async function ensureMongoDatabase(client, dbName) {
  const db = client.db(dbName);
  await db.createCollection('_materialization_init');
  await db.collection('_materialization_init').drop();
}

async function checkTargetExists(runtime, targetSchema) {
  if (runtime.dbType === 'redis') {
    return true;
  }

  if (runtime.dbType === 'postgresql') {
    return withPgClient(runtime, (client) => checkPgSchemaExists(client, targetSchema));
  }

  if (runtime.dbType === 'mysql') {
    return withMysqlClient(runtime, (conn) => checkMysqlDatabaseExists(conn, targetSchema));
  }

  if (runtime.dbType === 'mongodb') {
    const { MongoClient } = await getMongoClient();
    const client = new MongoClient(buildMongoUri(runtime));
    await client.connect();
    try {
      return checkMongoDatabaseExists(client, targetSchema);
    } finally {
      await client.close();
    }
  }

  return true;
}

async function ensureTarget(runtime, targetSchema) {
  if (runtime.dbType === 'redis') {
    return;
  }

  if (runtime.dbType === 'postgresql') {
    return withPgClient(runtime, (client) => ensurePgSchema(client, targetSchema));
  }

  if (runtime.dbType === 'mysql') {
    return withMysqlClient(runtime, async (conn) => {
      await assertMysqlVersion(conn);
      await ensureMysqlDatabase(conn, targetSchema);
    });
  }

  if (runtime.dbType === 'mongodb') {
    const { MongoClient } = await getMongoClient();
    const client = new MongoClient(buildMongoUri(runtime));
    await client.connect();
    try {
      await ensureMongoDatabase(client, targetSchema);
    } finally {
      await client.close();
    }
  }
}

async function executePostgresql(runtime, sql, dialect) {
  await withPgClient(runtime, async (client) => {
    for (const stmt of dialect.splitStatements(sql)) {
      if (dialect.shouldSkipStatement(stmt)) continue;
      await client.query(`${stmt};`);
    }
  });
}

async function executeMysql(runtime, sql, dialect) {
  await withMysqlClient(runtime, async (conn) => {
    await assertMysqlVersion(conn);
    for (const stmt of dialect.splitStatements(sql)) {
      if (dialect.shouldSkipStatement(stmt)) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await conn.query(`${stmt};`);
      } catch (err) {
        // 1060: Duplicate column name（重复物化补列）
        if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME')) {
          continue;
        }
        throw err;
      }
    }
  });
}

async function executeMongodb(runtime, entities, targetSchema, dialect) {
  const { MongoClient } = await getMongoClient();
  const client = new MongoClient(buildMongoUri(runtime));
  await client.connect();
  try {
    const db = client.db(targetSchema || runtime.databaseName);
    const plans = dialect.parseExecutionPlan(entities, targetSchema || runtime.databaseName);
    for (const plan of plans) {
      const collections = await db.listCollections({ name: plan.collection }).toArray();
      if (!collections.length) {
        await db.createCollection(plan.collection, { validator: plan.validator });
      }
      for (const index of plan.indexes) {
        await db.collection(plan.collection).createIndex(
          { [index.key]: 1 },
          { unique: index.unique, name: `idx_${index.key}` }
        );
      }
    }
  } finally {
    await client.close();
  }
}

async function executeRedis(runtime, entities, targetSchema, dialect) {
  const redis = await getRedisClient();
  const client = redis.createClient({ url: buildRedisUrl(runtime) });
  await client.connect();
  try {
    const plans = dialect.parseExecutionPlan(entities, targetSchema);
    for (const plan of plans) {
      await client.hSet(plan.hashKey, {
        entityId: plan.entityKey,
        version: String(plan.version || 1),
        keyPattern: plan.keyPattern,
        fields: JSON.stringify(plan.fields),
        materializedAt: new Date().toISOString()
      });
    }
  } finally {
    await client.quit();
  }
}

async function executeSql(runtime, sql, dialect, { entities, targetSchema } = {}) {
  if (runtime.dbType === 'postgresql') {
    await executePostgresql(runtime, sql, dialect);
    return;
  }
  if (runtime.dbType === 'mysql') {
    await executeMysql(runtime, sql, dialect);
    return;
  }
  if (runtime.dbType === 'mongodb') {
    await executeMongodb(runtime, entities, targetSchema, dialect);
    return;
  }
  if (runtime.dbType === 'redis') {
    await executeRedis(runtime, entities, targetSchema, dialect);
    return;
  }
  throw new Error(`不支持的数据库类型: ${runtime.dbType}`);
}

module.exports = {
  testConnection,
  checkTargetExists,
  ensureTarget,
  executeSql,
  withPgClient,
  withMysqlClient,
  withPgWriteTest,
  withPgTransaction,
  quotePgIdentifier,
  quoteMysqlIdentifier,
  assertMysqlVersion,
  MYSQL_MIN_VERSION,
};
