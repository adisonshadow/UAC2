const { Op } = require('sequelize');
const {
  BizdataMaterializationEntity,
  BizdataMaterializationRun,
  BizdataDatabaseConnection,
} = require('../../models');
const databaseConnectionService = require('./databaseConnectionService');
const {
  withPgClient,
  quotePgIdentifier,
} = require('./materialization/connectionRunner');

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

async function findMaterializedTargets(entityId) {
  const records = await BizdataMaterializationEntity.findAll({
    where: { entity_id: entityId, ddl_applied: true },
    include: [{
      model: BizdataMaterializationRun,
      as: 'run',
      required: true,
      where: { status: 'success' },
      include: [{ model: BizdataDatabaseConnection, as: 'connection', required: true }],
    }],
    order: [['created_at', 'DESC']],
  });

  const byConnection = new Map();
  records.forEach((rec) => {
    const connId = rec.run.connection_id;
    if (!byConnection.has(connId)) {
      byConnection.set(connId, {
        connectionId: connId,
        connectionName: rec.run.connection?.name,
        dbType: rec.run.connection?.db_type,
        targetSchema: rec.run.target_schema || rec.run.connection?.target_schema,
        connection: rec.run.connection,
      });
    }
  });
  return [...byConnection.values()];
}

async function pgTableExists(client, schemaName, tableName) {
  const res = await client.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1',
    [schemaName, tableName],
  );
  return res.rowCount > 0;
}

async function renamePgTable(runtime, targetSchema, oldTableName, newTableName) {
  return withPgClient(runtime, async (client) => {
    const oldExists = await pgTableExists(client, targetSchema, oldTableName);
    if (!oldExists) {
      const newExists = await pgTableExists(client, targetSchema, newTableName);
      if (newExists) return { status: 'already_renamed' };
      return { status: 'old_missing' };
    }
    const newExists = await pgTableExists(client, targetSchema, newTableName);
    if (newExists) {
      throw new Error(`物理表「${targetSchema}.${newTableName}」已存在，无法将「${oldTableName}」重命名`);
    }
    const qualified = `${quotePgIdentifier(targetSchema)}.${quotePgIdentifier(oldTableName)}`;
    await client.query(`ALTER TABLE ${qualified} RENAME TO ${quotePgIdentifier(newTableName)}`);
    return { status: 'renamed' };
  });
}

async function renameMongoCollection(runtime, targetSchema, oldTableName, newTableName) {
  return withMongoClient(runtime, async (client) => {
    const db = client.db(targetSchema);
    const oldExists = (await db.listCollections({ name: oldTableName }).toArray()).length > 0;
    if (!oldExists) {
      const newExists = (await db.listCollections({ name: newTableName }).toArray()).length > 0;
      if (newExists) return { status: 'already_renamed' };
      return { status: 'old_missing' };
    }
    const newExists = (await db.listCollections({ name: newTableName }).toArray()).length > 0;
    if (newExists) {
      throw new Error(`集合「${targetSchema}.${newTableName}」已存在，无法将「${oldTableName}」重命名`);
    }
    await client.db('admin').command({
      renameCollection: `${targetSchema}.${oldTableName}`,
      to: `${targetSchema}.${newTableName}`,
    });
    return { status: 'renamed' };
  });
}

async function renameRedisEntityKeys(runtime, targetSchema, oldTableName, newTableName) {
  const prefix = String(targetSchema).replace(/:$/, '');
  return withRedisClient(runtime, async (client) => {
    const oldSchemaKey = `${prefix}:schema:${oldTableName}`;
    const newSchemaKey = `${prefix}:schema:${newTableName}`;
    const oldSchemaExists = await client.exists(oldSchemaKey);
    if (!oldSchemaExists) {
      const newSchemaExists = await client.exists(newSchemaKey);
      if (newSchemaExists) return { status: 'already_renamed', keysRenamed: 0 };
      return { status: 'old_missing', keysRenamed: 0 };
    }
    if (await client.exists(newSchemaKey)) {
      throw new Error(`Redis schema「${newSchemaKey}」已存在，无法重命名`);
    }

    const oldHash = await client.hGetAll(oldSchemaKey);
    await client.hSet(newSchemaKey, oldHash);
    await client.del(oldSchemaKey);

    const pattern = `${prefix}:${oldTableName}:*`;
    const keys = await scanRedisKeys(client, pattern);
    const dataKeys = keys.filter((key) => key !== oldSchemaKey);
    let keysRenamed = 0;
    for (const key of dataKeys) {
      const suffix = key.slice(`${prefix}:${oldTableName}:`.length);
      const newKey = `${prefix}:${newTableName}:${suffix}`;
      if (await client.exists(newKey)) {
        throw new Error(`Redis 键「${newKey}」已存在，无法重命名「${key}」`);
      }
      // eslint-disable-next-line no-await-in-loop
      await client.rename(key, newKey);
      keysRenamed += 1;
    }
    return { status: 'renamed', keysRenamed };
  });
}

async function renameOnTarget(target, oldTableName, newTableName, { allowMissingOld = false } = {}) {
  const runtime = databaseConnectionService.buildRuntimeConfig(target.connection);
  const schema = target.targetSchema || runtime.targetSchema;
  if (!schema) {
    throw new Error(`连接「${target.connectionName || target.connectionId}」未配置 targetSchema`);
  }

  let result;
  if (runtime.dbType === 'postgresql') {
    result = await renamePgTable(runtime, schema, oldTableName, newTableName);
  } else if (runtime.dbType === 'mongodb') {
    result = await renameMongoCollection(runtime, schema, oldTableName, newTableName);
  } else if (runtime.dbType === 'redis') {
    result = await renameRedisEntityKeys(runtime, schema, oldTableName, newTableName);
  } else {
    throw new Error(`不支持的数据库类型: ${runtime.dbType}`);
  }

  if (result.status === 'old_missing' && !allowMissingOld) {
    throw new Error(
      `连接「${target.connectionName || target.connectionId}」上未找到物理表/集合「${schema}.${oldTableName}」，`
      + '请确认已物化或手动处理后再修改表名',
    );
  }

  return {
    connectionId: target.connectionId,
    connectionName: target.connectionName,
    dbType: runtime.dbType,
    targetSchema: schema,
    oldTableName,
    newTableName,
    ...result,
  };
}

/**
 * 实体表名变更时，在各已物化连接上重命名物理表/集合/Redis 键。
 * 须在元数据事务提交前调用；失败时由 rollbackMaterializedPhysicalRenames 回滚。
 */
async function renameMaterializedPhysicalTables({ entityId, oldTableName, newTableName }) {
  const oldName = String(oldTableName || '').trim();
  const newName = String(newTableName || '').trim();
  if (!oldName || !newName || oldName === newName) {
    return { renamed: [], skipped: true };
  }

  const targets = await findMaterializedTargets(entityId);
  if (!targets.length) {
    return { renamed: [], skipped: true, reason: 'not_materialized' };
  }

  const renamed = [];
  for (const target of targets) {
    // eslint-disable-next-line no-await-in-loop
    const item = await renameOnTarget(target, oldName, newName);
    if (item.status === 'renamed' || item.status === 'already_renamed') {
      renamed.push(item);
    }
  }
  return { renamed, skipped: false };
}

async function rollbackMaterializedPhysicalRenames(renameResult) {
  const items = renameResult?.renamed || [];
  for (const item of items) {
    if (item.status !== 'renamed') continue;
    const target = {
      connectionId: item.connectionId,
      connectionName: item.connectionName,
      connection: await BizdataDatabaseConnection.findByPk(item.connectionId),
      targetSchema: item.targetSchema,
    };
    if (!target.connection) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await renameOnTarget(target, item.newTableName, item.oldTableName, { allowMissingOld: true });
    } catch (err) {
      // 回滚失败仅记录，避免掩盖原始错误
      // eslint-disable-next-line no-console
      console.error(
        `[materializedTableRename] 回滚失败 ${item.targetSchema}.${item.newTableName} -> ${item.oldTableName}:`,
        err.message,
      );
    }
  }
}

module.exports = {
  findMaterializedTargets,
  renameMaterializedPhysicalTables,
  rollbackMaterializedPhysicalRenames,
};
