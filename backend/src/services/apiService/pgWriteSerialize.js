/**
 * node-pg 写入 json/jsonb 时的序列化。
 *
 * 背景：node-pg 会把 JS Array 编成 PostgreSQL 数组字面量 `{a,b}`，
 * 而非 JSON `[a,b]`，写入 jsonb 列会报：
 *   invalid input syntax for type json
 * 空数组还会被编成 `{}`（空 JSON 对象），语义错误。
 *
 * 对象（含数组）在写入 json/jsonb 列前必须 JSON.stringify。
 */

function fieldKeyOf(field) {
  return field?.fieldKey || field?.field_key || null;
}

function isJsonColumnField(field) {
  if (!field) return false;
  const typeorm = field.typeormConfig || field.typeorm_config || {};
  const t = String(typeorm.type || '').toLowerCase();
  return t.includes('json');
}

function findEntityField(entity, key) {
  const fields = entity?.fields || [];
  return fields.find((f) => fieldKeyOf(f) === key) || null;
}

/**
 * @param {string} fieldKey
 * @param {unknown} value
 * @param {{ fields?: unknown[] } | null} entity
 */
function serializeWriteValueForColumn(fieldKey, value, entity) {
  if (value == null) return value;
  const field = findEntityField(entity, fieldKey);
  if (!isJsonColumnField(field)) return value;
  // 已是 JSON 文本则原样交给 PG
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ fields?: unknown[] } | null} entity
 */
function serializeWriteRow(row, entity) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const out = {};
  Object.keys(row).forEach((k) => {
    out[k] = serializeWriteValueForColumn(k, row[k], entity);
  });
  return out;
}

module.exports = {
  isJsonColumnField,
  findEntityField,
  serializeWriteValueForColumn,
  serializeWriteRow,
};
