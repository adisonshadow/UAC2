function defaultTableNameFromCode(code) {
  return String(code || '').trim().replace(/:/g, '_');
}

function resolveEntityTableName(code, tableName) {
  const trimmed = tableName != null ? String(tableName).trim() : '';
  return trimmed || defaultTableNameFromCode(code);
}

module.exports = {
  defaultTableNameFromCode,
  resolveEntityTableName,
};
