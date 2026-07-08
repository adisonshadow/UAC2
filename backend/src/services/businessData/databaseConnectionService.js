const { Op } = require('sequelize');
const config = require('../../config');
const { BizdataDatabaseConnection, BizdataMaterializationRun } = require('../../models');
const { encryptApiKey, decryptApiKey } = require('../../utils/encryption');

function formatConnection(row, { includePasswordSet = true } = {}) {
  const d = row.toJSON ? row.toJSON() : row;
  return {
    id: d.id,
    name: d.name,
    dbType: d.db_type,
    host: d.host,
    port: d.port,
    username: d.username,
    passwordSet: includePasswordSet ? Boolean(d.password_enc) : undefined,
    databaseName: d.database_name,
    targetSchema: d.target_schema,
    isDefault: d.is_default,
    lastTestStatus: d.last_test_status,
    lastTestedAt: d.last_tested_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
}

function getDefaultPort(dbType) {
  if (dbType === 'mongodb') return 27017;
  if (dbType === 'redis') return 6379;
  return 5432;
}

async function resolveConnectionRecord(connectionId) {
  if (connectionId) {
    const conn = await BizdataDatabaseConnection.findByPk(connectionId);
    if (!conn) throw new Error('数据库连接不存在');
    return conn;
  }
  const defaultConn = await BizdataDatabaseConnection.findOne({ where: { is_default: true } });
  if (defaultConn) return defaultConn;
  throw new Error('未配置默认数据库连接');
}

function buildRuntimeConfig(connRow) {
  const d = connRow.toJSON ? connRow.toJSON() : connRow;
  let password = d.password_enc ? decryptApiKey(d.password_enc) : null;

  if (d.is_default && d.db_type === 'postgresql' && !password) {
    password = config.postgresql.password;
  }

  return {
    id: d.id,
    name: d.name,
    dbType: d.db_type,
    host: d.host,
    port: d.port,
    username: d.username,
    password,
    databaseName: d.database_name,
    targetSchema: d.target_schema,
    isDefault: d.is_default
  };
}

async function listConnections() {
  const rows = await BizdataDatabaseConnection.findAll({ order: [['is_default', 'DESC'], ['name', 'ASC']] });
  return rows.map((row) => formatConnection(row));
}

async function getConnectionById(id) {
  const row = await BizdataDatabaseConnection.findByPk(id);
  if (!row) return null;
  return formatConnection(row);
}

async function createConnection(payload) {
  const dbType = payload.dbType || payload.db_type;
  if (!['postgresql', 'mongodb', 'redis'].includes(dbType)) {
    throw new Error('dbType 仅支持 postgresql、mongodb 或 redis');
  }

  if (payload.isDefault) {
    await BizdataDatabaseConnection.update({ is_default: false }, { where: { is_default: true } });
  }

  const row = await BizdataDatabaseConnection.create({
    name: payload.name,
    db_type: dbType,
    host: payload.host || 'localhost',
    port: payload.port || getDefaultPort(dbType),
    username: payload.username,
    password_enc: payload.password ? encryptApiKey(payload.password) : null,
    database_name: payload.databaseName || payload.database_name,
    target_schema: payload.targetSchema || payload.target_schema || 'bizdata_mat',
    is_default: !!payload.isDefault
  });

  return formatConnection(row);
}

async function updateConnection(id, payload) {
  const row = await BizdataDatabaseConnection.findByPk(id);
  if (!row) return null;

  if (payload.isDefault) {
    await BizdataDatabaseConnection.update(
      { is_default: false },
      { where: { is_default: true, id: { [Op.ne]: id } } }
    );
  }

  const updates = {};
  if (payload.name != null) updates.name = payload.name;
  if (payload.dbType != null || payload.db_type != null) updates.db_type = payload.dbType || payload.db_type;
  if (payload.host != null) updates.host = payload.host;
  if (payload.port != null) updates.port = payload.port;
  if (payload.username != null) updates.username = payload.username;
  if (payload.password) updates.password_enc = encryptApiKey(payload.password);
  if (payload.databaseName != null || payload.database_name != null) {
    updates.database_name = payload.databaseName || payload.database_name;
  }
  if (payload.targetSchema != null || payload.target_schema != null) {
    updates.target_schema = payload.targetSchema || payload.target_schema;
  }
  if (payload.isDefault != null) updates.is_default = !!payload.isDefault;

  await row.update(updates);
  return formatConnection(row);
}

async function deleteConnection(id) {
  const row = await BizdataDatabaseConnection.findByPk(id);
  if (!row) return false;
  if (row.is_default) {
    throw new Error('不能删除默认数据库连接');
  }
  const used = await BizdataMaterializationRun.count({ where: { connection_id: id } });
  if (used > 0) {
    throw new Error('该连接已被物化历史引用，无法删除');
  }
  await row.destroy();
  return true;
}

async function testConnectionById(id) {
  const row = await BizdataDatabaseConnection.findByPk(id);
  if (!row) throw new Error('数据库连接不存在');
  const runtime = buildRuntimeConfig(row);
  const { testConnection } = require('./materialization/connectionRunner');
  try {
    await testConnection(runtime);
    await row.update({ last_test_status: 'success', last_tested_at: new Date() });
    return { success: true, message: '连接成功' };
  } catch (err) {
    await row.update({ last_test_status: 'failed', last_tested_at: new Date() });
    throw err;
  }
}

module.exports = {
  formatConnection,
  listConnections,
  getConnectionById,
  createConnection,
  updateConnection,
  deleteConnection,
  testConnectionById,
  resolveConnectionRecord,
  buildRuntimeConfig,
  getDefaultPort
};
