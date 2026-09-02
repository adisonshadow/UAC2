const { randomUUID } = require('crypto');
const { BizdataEntity } = require('../../models');
const businessDataService = require('./businessDataService');
const databaseConnectionService = require('./databaseConnectionService');
const materializationService = require('./materializationService');
const { resolveEntityTableName } = require('./entityTableName');
const {
  withPgClient,
  withMysqlClient,
  quotePgIdentifier,
  quoteMysqlIdentifier,
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

function mapEntityFieldToColumn(field) {
  const cfg = field.typeormConfig || {};
  const col = field.columnInfo || {};
  return {
    name: field.fieldKey,
    type: col.extendType || cfg.type || 'varchar',
    nullable: cfg.nullable !== false,
    default: cfg.default ?? null,
    comment: col.label || field.fieldKey,
    primary: !!cfg.primary,
    unique: !!cfg.unique,
  };
}

async function resolveBrowseContext({ entityId, entityCode, connectionId }) {
  if (!connectionId) {
    throw new Error('connectionId 为必填项');
  }

  let entity;
  if (entityId) {
    entity = await businessDataService.getEntityById(entityId);
  } else if (entityCode) {
    const row = await BizdataEntity.findOne({ where: { code: String(entityCode).trim() } });
    entity = row ? await businessDataService.getEntityById(row.id) : null;
  }
  if (!entity) {
    throw new Error('实体不存在');
  }
  if (entity.entityKind !== 'er_table') {
    throw new Error('仅 ER 表实体支持物化表浏览');
  }

  const connRow = await databaseConnectionService.resolveConnectionRecord(connectionId);
  const runtime = databaseConnectionService.buildRuntimeConfig(connRow);

  const statusList = await materializationService.getMaterializationStatus({ connectionId });
  const status = statusList.find((s) => s.entityId === entity.id);
  if (!status || status.materializedVersion == null || status.staleStatus === 'not_materialized') {
    throw new Error(`实体「${entity.label}」尚未在该连接上物化`);
  }

  const tableName = resolveEntityTableName(entity.code, entity.tableName || status.tableName);
  const targetSchema = status.targetSchema || runtime.targetSchema || 'bizdata_mat';

  return {
    entity,
    runtime,
    status,
    tableName,
    targetSchema,
    dbType: runtime.dbType,
    connectionId,
    connectionName: status.connectionName || runtime.name,
  };
}

async function getPgTableSchema(runtime, schemaName, tableName) {
  return withPgClient(runtime, async (client) => {
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schemaName, tableName],
    );
    if (!res.rows.length) {
      throw new Error(`物理表 ${schemaName}.${tableName} 不存在或未物化`);
    }
    return res.rows.map((row) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      comment: row.character_maximum_length ? `max ${row.character_maximum_length}` : undefined,
    }));
  });
}

async function getMysqlTableSchema(runtime, schemaName, tableName) {
  return withMysqlClient(runtime, async (conn) => {
    const [rows] = await conn.query(
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position`,
      [schemaName, tableName],
    );
    if (!rows.length) {
      throw new Error(`物理表 ${schemaName}.${tableName} 不存在或未物化`);
    }
    return rows.map((row) => ({
      name: row.COLUMN_NAME || row.column_name,
      type: row.DATA_TYPE || row.data_type,
      nullable: String(row.IS_NULLABLE || row.is_nullable).toUpperCase() === 'YES',
      default: row.COLUMN_DEFAULT ?? row.column_default,
      comment: (row.CHARACTER_MAXIMUM_LENGTH || row.character_maximum_length)
        ? `max ${row.CHARACTER_MAXIMUM_LENGTH || row.character_maximum_length}`
        : undefined,
    }));
  });
}

async function getMongoTableSchema(ctx) {
  const { entity, runtime, targetSchema, tableName } = ctx;
  const columns = (entity.fields || []).map(mapEntityFieldToColumn);
  let indexes = [];
  await withMongoClient(runtime, async (client) => {
    const db = client.db(targetSchema);
    const collections = await db.listCollections({ name: tableName }).toArray();
    if (!collections.length) {
      throw new Error(`集合 ${targetSchema}.${tableName} 不存在或未物化`);
    }
    indexes = await db.collection(tableName).indexes();
  });
  return columns.map((col) => ({
    ...col,
    comment: col.comment || (indexes.some((idx) => idx.key?.[col.name]) ? '已建索引' : undefined),
  }));
}

async function getRedisTableSchema(ctx) {
  const { runtime, targetSchema, tableName } = ctx;
  const prefix = String(targetSchema).replace(/:$/, '');
  const hashKey = `${prefix}:schema:${tableName}`;
  return withRedisClient(runtime, async (client) => {
    const fieldsJson = await client.hGet(hashKey, 'fields');
    if (!fieldsJson) {
      throw new Error(`Redis schema ${hashKey} 不存在或未物化`);
    }
    let fields = [];
    try {
      fields = JSON.parse(fieldsJson);
    } catch {
      fields = [];
    }
    return fields.map((f) => ({
      name: f.name,
      type: f.type || 'string',
      nullable: true,
      default: null,
      comment: f.label || f.name,
    }));
  });
}

async function getTableSchema({ entityId, entityCode, connectionId }) {
  const ctx = await resolveBrowseContext({ entityId, entityCode, connectionId });
  let columns = [];
  if (ctx.dbType === 'postgresql') {
    columns = await getPgTableSchema(ctx.runtime, ctx.targetSchema, ctx.tableName);
  } else if (ctx.dbType === 'mysql') {
    columns = await getMysqlTableSchema(ctx.runtime, ctx.targetSchema, ctx.tableName);
  } else if (ctx.dbType === 'mongodb') {
    columns = await getMongoTableSchema(ctx);
  } else if (ctx.dbType === 'redis') {
    columns = await getRedisTableSchema(ctx);
  } else {
    throw new Error(`不支持的数据库类型: ${ctx.dbType}`);
  }

  return {
    entityId: ctx.entity.id,
    entityCode: ctx.entity.code,
    entityLabel: ctx.entity.label,
    connectionId: ctx.connectionId,
    connectionName: ctx.connectionName,
    dbType: ctx.dbType,
    targetSchema: ctx.targetSchema,
    tableName: ctx.tableName,
    columns,
  };
}

async function queryPgRows(runtime, schemaName, tableName, page, size) {
  const offset = (page - 1) * size;
  const schemaQ = quotePgIdentifier(schemaName);
  const tableQ = quotePgIdentifier(tableName);
  const qualified = `${schemaQ}.${tableQ}`;
  return withPgClient(runtime, async (client) => {
    const countRes = await client.query(`SELECT COUNT(*)::int AS total FROM ${qualified}`);
    const total = countRes.rows[0]?.total || 0;
    const dataRes = await client.query(`SELECT * FROM ${qualified} LIMIT $1 OFFSET $2`, [size, offset]);
    return { items: dataRes.rows, total, page, size };
  });
}

async function queryMysqlRows(runtime, schemaName, tableName, page, size) {
  const offset = (page - 1) * size;
  const qualified = `${quoteMysqlIdentifier(schemaName)}.${quoteMysqlIdentifier(tableName)}`;
  return withMysqlClient(runtime, async (conn) => {
    const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM ${qualified}`);
    const total = Number(countRows[0]?.total || 0);
    const [dataRows] = await conn.query(`SELECT * FROM ${qualified} LIMIT ? OFFSET ?`, [size, offset]);
    return { items: dataRows, total, page, size };
  });
}

async function queryMongoRows(runtime, targetSchema, tableName, page, size) {
  const offset = (page - 1) * size;
  return withMongoClient(runtime, async (client) => {
    const collection = client.db(targetSchema).collection(tableName);
    const total = await collection.countDocuments();
    const cursor = collection.find({}).skip(offset).limit(size);
    const docs = await cursor.toArray();
    const items = docs.map((doc) => {
      const row = { ...doc };
      if (row._id != null) row._id = String(row._id);
      return row;
    });
    return { items, total, page, size };
  });
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

async function queryRedisRows(runtime, targetSchema, tableName, page, size) {
  const prefix = String(targetSchema).replace(/:$/, '');
  const pattern = `${prefix}:${tableName}:*`;
  return withRedisClient(runtime, async (client) => {
    const allKeys = await scanRedisKeys(client, pattern);
    const dataKeys = allKeys.filter((k) => !k.endsWith(':schema') && !k.includes(':schema:'));
    const total = dataKeys.length;
    const slice = dataKeys.slice((page - 1) * size, page * size);
    const items = [];
    for (const key of slice) {
      const type = await client.type(key);
      if (type === 'hash') {
        const hash = await client.hGetAll(key);
        items.push({ _key: key, ...hash });
      } else {
        const value = await client.get(key);
        items.push({ _key: key, value });
      }
    }
    return { items, total, page, size };
  });
}

async function queryTableRows({ entityId, entityCode, connectionId, page = 1, size = 20 }) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(Math.max(parseInt(size, 10) || 20, 1), 200);
  const ctx = await resolveBrowseContext({ entityId, entityCode, connectionId });

  let result;
  if (ctx.dbType === 'postgresql') {
    result = await queryPgRows(ctx.runtime, ctx.targetSchema, ctx.tableName, safePage, safeSize);
  } else if (ctx.dbType === 'mysql') {
    result = await queryMysqlRows(ctx.runtime, ctx.targetSchema, ctx.tableName, safePage, safeSize);
  } else if (ctx.dbType === 'mongodb') {
    result = await queryMongoRows(ctx.runtime, ctx.targetSchema, ctx.tableName, safePage, safeSize);
  } else if (ctx.dbType === 'redis') {
    result = await queryRedisRows(ctx.runtime, ctx.targetSchema, ctx.tableName, safePage, safeSize);
  } else {
    throw new Error(`不支持的数据库类型: ${ctx.dbType}`);
  }

  return {
    ...result,
    entityId: ctx.entity.id,
    entityCode: ctx.entity.code,
    entityLabel: ctx.entity.label,
    connectionId: ctx.connectionId,
    connectionName: ctx.connectionName,
    dbType: ctx.dbType,
    targetSchema: ctx.targetSchema,
    tableName: ctx.tableName,
  };
}

function normalizeRowKeys(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('rows 每项必须是对象');
  }
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => k !== '_key' && k !== '_id'),
  );
}

function validateRowsAgainstColumns(rows, columns, tableLabel) {
  const allowed = new Set(columns.map((c) => c.name));
  const requiredWithoutDefault = columns.filter(
    (c) => !c.nullable && c.default == null && c.name !== 'id',
  );
  const columnList = [...allowed].join(', ');
  const errors = [];

  rows.forEach((raw, index) => {
    const row = normalizeRowKeys(raw);
    const unknown = Object.keys(row).filter((k) => !allowed.has(k));
    if (unknown.length) {
      errors.push(
        `第 ${index + 1} 行含未知字段: ${unknown.join(', ')}。`
        + ` 允许的列: ${columnList}。请先调用 bizdata_browse_materialized_schema 获取准确列名。`,
      );
    }
    const missing = requiredWithoutDefault
      .filter((c) => row[c.name] == null || row[c.name] === '')
      .map((c) => c.name);
    if (missing.length) {
      errors.push(`第 ${index + 1} 行缺少必填字段: ${missing.join(', ')}`);
    }
  });

  if (errors.length) {
    throw new Error(`${tableLabel} MOCK 数据校验失败:\n${errors.join('\n')}`);
  }
}

async function insertPgRows(runtime, schemaName, tableName, rows) {
  if (!rows.length) return { inserted: 0, ids: [] };
  return withPgClient(runtime, async (client) => {
    const schemaQ = quotePgIdentifier(schemaName);
    const tableQ = quotePgIdentifier(tableName);
    const qualified = `${schemaQ}.${tableQ}`;
    const ids = [];
    for (const raw of rows) {
      const row = normalizeRowKeys(raw);
      if (!row.id) row.id = randomUUID();
      const keys = Object.keys(row);
      const cols = keys.map((k) => quotePgIdentifier(k)).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map((k) => row[k]);
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO ${qualified} (${cols}) VALUES (${placeholders})`,
        values,
      );
      ids.push(row.id);
    }
    return { inserted: rows.length, ids };
  });
}

async function insertMysqlRows(runtime, schemaName, tableName, rows) {
  if (!rows.length) return { inserted: 0, ids: [] };
  const qualified = `${quoteMysqlIdentifier(schemaName)}.${quoteMysqlIdentifier(tableName)}`;
  return withMysqlClient(runtime, async (conn) => {
    const ids = [];
    for (const raw of rows) {
      const row = normalizeRowKeys(raw);
      if (!row.id) row.id = randomUUID();
      const keys = Object.keys(row);
      const cols = keys.map((k) => quoteMysqlIdentifier(k)).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map((k) => row[k]);
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO ${qualified} (${cols}) VALUES (${placeholders})`,
        values,
      );
      ids.push(row.id);
    }
    return { inserted: rows.length, ids };
  });
}

async function insertMongoRows(runtime, targetSchema, tableName, rows) {
  if (!rows.length) return { inserted: 0, ids: [] };
  return withMongoClient(runtime, async (client) => {
    const collection = client.db(targetSchema).collection(tableName);
    const docs = rows.map((raw) => {
      const row = normalizeRowKeys(raw);
      if (!row.id) row.id = randomUUID();
      return row;
    });
    const result = await collection.insertMany(docs);
    return { inserted: result.insertedCount, ids: docs.map((d) => d.id) };
  });
}

async function insertRedisRows(runtime, targetSchema, tableName, rows) {
  if (!rows.length) return { inserted: 0, ids: [] };
  const prefix = String(targetSchema).replace(/:$/, '');
  return withRedisClient(runtime, async (client) => {
    const ids = [];
    for (const raw of rows) {
      const row = normalizeRowKeys(raw);
      const id = row.id || randomUUID();
      const key = `${prefix}:${tableName}:${id}`;
      const payload = { ...row, id };
      delete payload._key;
      const stringPayload = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, v == null ? '' : String(v)]),
      );
      // eslint-disable-next-line no-await-in-loop
      await client.hSet(key, stringPayload);
      ids.push(id);
    }
    return { inserted: rows.length, ids };
  });
}

async function insertMockData({ entityId, entityCode, connectionId, rows = [], rowCount }) {
  const ctx = await resolveBrowseContext({ entityId, entityCode, connectionId });
  let dataRows = Array.isArray(rows) ? rows : [];
  if (!dataRows.length && rowCount) {
    throw new Error('请提供 rows 数组；rowCount 仅作参考，须由 AI 生成具体行数据后传入 rows');
  }
  if (!dataRows.length) {
    throw new Error('rows 不能为空');
  }
  if (dataRows.length > 100) {
    throw new Error('单次最多插入 100 条 MOCK 数据');
  }

  let columns = [];
  if (ctx.dbType === 'postgresql') {
    columns = await getPgTableSchema(ctx.runtime, ctx.targetSchema, ctx.tableName);
  } else if (ctx.dbType === 'mysql') {
    columns = await getMysqlTableSchema(ctx.runtime, ctx.targetSchema, ctx.tableName);
  } else if (ctx.dbType === 'mongodb') {
    columns = (ctx.entity.fields || []).map(mapEntityFieldToColumn);
  } else if (ctx.dbType === 'redis') {
    const schema = await getRedisTableSchema(ctx);
    columns = schema;
  }
  const tableLabel = `${ctx.entity.code} (${ctx.targetSchema}.${ctx.tableName})`;
  validateRowsAgainstColumns(dataRows, columns, tableLabel);

  let result;
  if (ctx.dbType === 'postgresql') {
    result = await insertPgRows(ctx.runtime, ctx.targetSchema, ctx.tableName, dataRows);
  } else if (ctx.dbType === 'mysql') {
    result = await insertMysqlRows(ctx.runtime, ctx.targetSchema, ctx.tableName, dataRows);
  } else if (ctx.dbType === 'mongodb') {
    result = await insertMongoRows(ctx.runtime, ctx.targetSchema, ctx.tableName, dataRows);
  } else if (ctx.dbType === 'redis') {
    result = await insertRedisRows(ctx.runtime, ctx.targetSchema, ctx.tableName, dataRows);
  } else {
    throw new Error(`不支持的数据库类型: ${ctx.dbType}`);
  }

  return {
    ...result,
    entityId: ctx.entity.id,
    entityCode: ctx.entity.code,
    entityLabel: ctx.entity.label,
    connectionId: ctx.connectionId,
    connectionName: ctx.connectionName,
    dbType: ctx.dbType,
    targetSchema: ctx.targetSchema,
    tableName: ctx.tableName,
  };
}

module.exports = {
  getTableSchema,
  queryTableRows,
  insertMockData,
  resolveBrowseContext,
};
