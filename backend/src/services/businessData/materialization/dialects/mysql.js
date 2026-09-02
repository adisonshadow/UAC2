const { resolveEntityTableName } = require('../../entityTableName');

function quoteIdent(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function mapSqlType(typeormConfig = {}, columnInfo = {}) {
  const extendType = (columnInfo.extendType || '').toLowerCase();
  if (extendType === 'adb-guid-id') return 'CHAR(36)';
  if (extendType === 'adb-snowflake-id' || extendType === 'adb-auto-increment-id') return 'BIGINT';
  if (extendType === 'adb-enum') return 'VARCHAR(64)';
  if (extendType === 'adb-media') return 'VARCHAR(512)';

  const type = (typeormConfig.type || 'varchar').toLowerCase();
  const length = typeormConfig.length;
  const precision = typeormConfig.precision;
  const scale = typeormConfig.scale;

  switch (type) {
    case 'int':
    case 'integer':
      return 'INT';
    case 'bigint':
      return 'BIGINT';
    case 'boolean':
    case 'bool':
      return 'TINYINT(1)';
    case 'text':
      return 'TEXT';
    case 'json':
    case 'jsonb':
      return 'JSON';
    case 'decimal':
    case 'numeric':
      return precision ? `DECIMAL(${precision}${scale != null ? `,${scale}` : ''})` : 'DECIMAL(18,2)';
    case 'timestamp':
    case 'timestamptz':
      return 'DATETIME(3)';
    case 'uuid':
      return 'CHAR(36)';
    case 'varchar':
    case 'string':
    default:
      return length ? `VARCHAR(${length})` : 'VARCHAR(255)';
  }
}

function generateColumnDef(field) {
  const cfg = field.typeormConfig || field.typeorm_config || {};
  const colInfo = field.columnInfo || field.column_info || {};
  const parts = [`${quoteIdent(field.fieldKey || field.field_key)}`, mapSqlType(cfg, colInfo)];

  if (cfg.primary || colInfo.extendType?.includes('id')) {
    parts.push('PRIMARY KEY');
  }
  if (cfg.unique) parts.push('UNIQUE');
  if (cfg.nullable === false) parts.push('NOT NULL');
  if (cfg.default !== undefined && cfg.default !== null) {
    const def = typeof cfg.default === 'string' ? `'${cfg.default.replace(/'/g, "''")}'` : cfg.default;
    parts.push(`DEFAULT ${def}`);
  }
  return parts.join(' ');
}

function getFieldKey(field) {
  return field.fieldKey || field.field_key;
}

function hasField(fields, key) {
  return fields.some((f) => getFieldKey(f) === key);
}

function generateEntityDDL(entity, targetSchema) {
  const tableName = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
  const fields = entity.fields || [];
  const lines = fields.length
    ? fields.map((f) => `  ${generateColumnDef(f)}`)
    : ['  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID())'];

  const hasPk = fields.some((f) => {
    const cfg = f.typeormConfig || f.typeorm_config || {};
    return cfg.primary;
  });
  if (!hasPk && !hasField(fields, 'id')) {
    lines.unshift('  `id` CHAR(36) PRIMARY KEY DEFAULT (UUID())');
  }

  if (!hasField(fields, 'created_at')) {
    lines.push('  `created_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)');
  }
  if (!hasField(fields, 'updated_at')) {
    lines.push('  `updated_at` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)');
  }

  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} (\n${lines.join(',\n')}\n);`;
}

function generateAddMissingColumnsSql(entity, targetSchema) {
  const tableName = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
  const fields = entity.fields || [];
  return fields
    .map((f) => {
      const cfg = f.typeormConfig || f.typeorm_config || {};
      const colInfo = f.columnInfo || f.column_info || {};
      const type = mapSqlType(cfg, colInfo);
      // MySQL 无 ADD COLUMN IF NOT EXISTS；执行层忽略重复列错误
      return `ALTER TABLE ${quoteIdent(targetSchema)}.${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(getFieldKey(f))} ${type};`;
    })
    .join('\n');
}

function buildPreviewSql(entities, targetSchema) {
  const sqlParts = [`CREATE DATABASE IF NOT EXISTS ${quoteIdent(targetSchema)};`];
  entities.forEach((entity) => {
    sqlParts.push(generateEntityDDL(entity, targetSchema));
    const alters = generateAddMissingColumnsSql(entity, targetSchema);
    if (alters) sqlParts.push(alters);
  });
  return sqlParts.join('\n\n');
}

function splitStatements(sql) {
  return sql.split(';').map((s) => s.trim()).filter(Boolean);
}

function shouldSkipStatement(stmt) {
  return /^CREATE\s+DATABASE/i.test(stmt);
}

module.exports = {
  dbType: 'mysql',
  mapSqlType,
  generateEntityDDL,
  generateAddMissingColumnsSql,
  buildPreviewSql,
  splitStatements,
  shouldSkipStatement,
  quoteIdent,
};
