const { Op } = require('sequelize');
const { BizdataApiExceptionResponse } = require('../../models');

/* ========== 格式化 ========== */

function formatExceptionResponse(row) {
  if (!row) return null;
  const data = row.toJSON ? row.toJSON() : row;
  return {
    id: data.id,
    code: data.code,
    title: data.title,
    description: data.description,
    schema: data.schema,
    example: data.example,
    isEnabled: data.is_enabled,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** 文档/OpenAPI 专用：精简结构（仅启用的记录） */
function formatForDocs(row) {
  if (!row) return null;
  const data = row.toJSON ? row.toJSON() : row;
  return {
    code: data.code,
    title: data.title,
    description: data.description,
    schema: data.schema,
    example: data.example,
  };
}

/* ========== CRUD ========== */

async function listExceptionResponses({ isEnabled, page = 1, size = 100 } = {}) {
  const where = {};
  if (isEnabled !== undefined && isEnabled !== 'ALL' && isEnabled !== '') {
    where.is_enabled = Boolean(isEnabled);
  }

  const { count, rows } = await BizdataApiExceptionResponse.findAndCountAll({
    where,
    offset: (page - 1) * size,
    limit: size === -1 ? undefined : size,
    order: [['sort_order', 'ASC'], ['code', 'ASC']],
  });
  return { total: count, items: rows.map(formatExceptionResponse), page, size };
}

async function getExceptionResponseById(id) {
  const row = await BizdataApiExceptionResponse.findByPk(id);
  return row;
}

async function createExceptionResponse(body) {
  const { code, title, description, schema, example, isEnabled, sortOrder } = body;

  if (code == null || !title) {
    throw Object.assign(new Error('code、title 为必填项'), { status: 400 });
  }

  const existing = await BizdataApiExceptionResponse.findOne({ where: { code } });
  if (existing) {
    throw Object.assign(new Error(`code ${code} 已存在`), { status: 409 });
  }

  const row = await BizdataApiExceptionResponse.create({
    code,
    title,
    description: description || null,
    schema: schema || {},
    example: example || null,
    is_enabled: isEnabled !== false,
    sort_order: Number(sortOrder) || 0,
  });
  return row;
}

async function updateExceptionResponse(id, patch) {
  const row = await BizdataApiExceptionResponse.findByPk(id);
  if (!row) return null;

  // 若改 code，校验唯一性
  if (patch.code != null && patch.code !== row.code) {
    const dup = await BizdataApiExceptionResponse.findOne({ where: { code: patch.code, id: { [Op.ne]: id } } });
    if (dup) {
      throw Object.assign(new Error(`code ${patch.code} 已存在`), { status: 409 });
    }
  }

  const updates = {};
  if (patch.code != null) updates.code = patch.code;
  if (patch.title != null) updates.title = patch.title;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.schema !== undefined) updates.schema = patch.schema;
  if (patch.example !== undefined) updates.example = patch.example;
  if (patch.isEnabled !== undefined) updates.is_enabled = patch.isEnabled;
  if (patch.sortOrder !== undefined) updates.sort_order = Number(patch.sortOrder) || 0;

  await row.update(updates);
  return row;
}

async function deleteExceptionResponse(id) {
  const row = await BizdataApiExceptionResponse.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

/**
 * 文档/OpenAPI 专用：返回所有启用异常响应的精简结构。
 * 供 apis.json 生成与 API 文档页展示使用。
 */
async function listEnabledForDocs() {
  const rows = await BizdataApiExceptionResponse.findAll({
    where: { is_enabled: true },
    order: [['sort_order', 'ASC'], ['code', 'ASC']],
  });
  return rows.map(formatForDocs);
}

module.exports = {
  formatExceptionResponse,
  listExceptionResponses,
  getExceptionResponseById,
  createExceptionResponse,
  updateExceptionResponse,
  deleteExceptionResponse,
  listEnabledForDocs,
};
