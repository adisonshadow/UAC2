const { Op } = require('sequelize');
const {
  BizdataDataStandard,
  BizdataMetadataTable,
  BizdataMetadataField,
} = require('../../models');
const { formatStandard } = require('../system/systemService');

function formatDataStandard(row) {
  return formatStandard(row);
}

async function listDataStandards({ keyword, status, page = 1, size = 20 }) {
  const where = {};
  if (status) where.status = status;
  if (keyword) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${keyword}%` } },
      { code: { [Op.iLike]: `%${keyword}%` } },
      { version: { [Op.iLike]: `%${keyword}%` } },
    ];
  }

  const offset = (page - 1) * size;
  const { count, rows } = await BizdataDataStandard.findAndCountAll({
    where,
    order: [['updated_at', 'DESC']],
    limit: size,
    offset,
  });

  return {
    total: count,
    page,
    size,
    items: rows.map(formatDataStandard),
  };
}

async function getDataStandardById(id) {
  const row = await BizdataDataStandard.findByPk(id);
  return row ? formatDataStandard(row) : null;
}

async function createDataStandard(payload) {
  const name = String(payload.name || '').trim();
  const code = String(payload.code || '').trim();
  const version = String(payload.version || '').trim();
  if (!name || !code || !version) {
    const error = new Error('标准名、标准编码和版本不能为空');
    error.status = 400;
    throw error;
  }

  const row = await BizdataDataStandard.create({
    name,
    code,
    version,
    description: payload.description || null,
    status: payload.status || 'enabled',
  });
  return formatDataStandard(row);
}

async function updateDataStandard(id, payload) {
  const row = await BizdataDataStandard.findByPk(id);
  if (!row) return null;

  const updates = {};
  if (payload.name !== undefined) updates.name = String(payload.name).trim();
  if (payload.code !== undefined) updates.code = String(payload.code).trim();
  if (payload.version !== undefined) updates.version = String(payload.version).trim();
  if (payload.description !== undefined) updates.description = payload.description || null;
  if (payload.status !== undefined) updates.status = payload.status;

  await row.update(updates);
  return formatDataStandard(row);
}

async function deleteDataStandard(id) {
  const row = await BizdataDataStandard.findByPk(id);
  if (!row) return false;

  const tableRef = await BizdataMetadataTable.count({ where: { standard_id: id } });
  const fieldRef = await BizdataMetadataField.count({ where: { standard_id: id } });
  if (tableRef > 0 || fieldRef > 0) {
    const error = new Error('该数据标准已被元数据引用，无法删除');
    error.status = 400;
    throw error;
  }

  await row.destroy();
  return true;
}

module.exports = {
  listDataStandards,
  getDataStandardById,
  createDataStandard,
  updateDataStandard,
  deleteDataStandard,
};
