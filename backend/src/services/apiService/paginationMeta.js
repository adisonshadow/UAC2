/**
 * 业务数据 API 列表分页元数据（find 等）。
 * 约定：data = { items, pagination: { total, page, pageSize, totalPages, hasNext } }
 */

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/**
 * @param {{ total?: unknown, limit?: unknown, skip?: unknown, page?: unknown, pageSize?: unknown, size?: unknown }} input
 */
function buildPaginationMeta(input = {}) {
  const pageSizeRaw = input.pageSize ?? input.size ?? input.limit;
  const pageSize = Math.max(1, toPositiveInt(pageSizeRaw, 10) || 10);

  let page;
  if (input.page != null && input.page !== '') {
    page = Math.max(1, toPositiveInt(input.page, 1) || 1);
  } else {
    const skip = Math.max(0, toPositiveInt(input.skip, 0) || 0);
    page = Math.floor(skip / pageSize) + 1;
  }

  const total = Math.max(0, toPositiveInt(input.total, 0) || 0);
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
  };
}

/**
 * 将旧式 { items, total } / { items, count } 或已有 pagination 统一为标准结构。
 * 非列表结果原样返回。
 *
 * @param {unknown} result
 * @param {{ limit?: unknown, skip?: unknown, page?: unknown, pageSize?: unknown, size?: unknown }} [parameters]
 */
function normalizeListResult(result, parameters = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
  const obj = result;
  if (!Array.isArray(obj.items)) return result;

  const existing = obj.pagination && typeof obj.pagination === 'object' && !Array.isArray(obj.pagination)
    ? obj.pagination
    : null;

  const total = existing?.total ?? obj.total ?? obj.count ?? obj.items.length;
  const pagination = buildPaginationMeta({
    total,
    limit: parameters.limit,
    skip: parameters.skip,
    page: existing?.page ?? parameters.page,
    pageSize: existing?.pageSize ?? parameters.pageSize ?? parameters.size ?? parameters.limit,
    size: parameters.size,
  });

  const { total: _t, count: _c, pagination: _p, ...rest } = obj;
  return {
    ...rest,
    items: obj.items,
    pagination,
  };
}

module.exports = {
  buildPaginationMeta,
  normalizeListResult,
};
