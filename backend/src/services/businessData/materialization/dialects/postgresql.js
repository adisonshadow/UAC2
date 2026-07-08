function mapSqlType(typeormConfig = {}, columnInfo = {}) {
  const extendType = (columnInfo.extendType || '').toLowerCase();
  if (extendType === 'adb-guid-id') return 'UUID';
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
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'boolean':
    case 'bool':
      return 'BOOLEAN';
    case 'text':
      return 'TEXT';
    case 'json':
    case 'jsonb':
      return 'JSONB';
    case 'decimal':
    case 'numeric':
      return precision ? `NUMERIC(${precision}${scale != null ? `,${scale}` : ''})` : 'NUMERIC';
    case 'timestamp':
    case 'timestamptz':
      return 'TIMESTAMPTZ';
    case 'uuid':
      return 'UUID';
    case 'varchar':
    case 'string':
    default:
      return length ? `VARCHAR(${length})` : 'VARCHAR(255)';
  }
}

function generateColumnDef(field) {
  const cfg = field.typeormConfig || field.typeorm_config || {};
  const colInfo = field.columnInfo || field.column_info || {};
  const parts = [`"${field.fieldKey || field.field_key}"`, mapSqlType(cfg, colInfo)];

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

const { resolveEntityTableName } = require('../../entityTableName');

function generateEntityDDL(entity, targetSchema) {
  const tableName = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
  const fields = entity.fields || [];
  const lines = fields.length
    ? fields.map((f) => `  ${generateColumnDef(f)}`)
    : ['  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'];

  const hasPk = fields.some((f) => {
    const cfg = f.typeormConfig || f.typeorm_config || {};
    return cfg.primary;
  });
  if (!hasPk && !hasField(fields, 'id')) {
    lines.unshift('  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  }

  if (!hasField(fields, 'created_at')) {
    lines.push('  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
  }
  if (!hasField(fields, 'updated_at')) {
    lines.push('  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
  }

  return `CREATE TABLE IF NOT EXISTS "${targetSchema}"."${tableName}" (\n${lines.join(',\n')}\n);`;
}

function buildPreviewSql(entities, targetSchema) {
  const sqlParts = [`CREATE SCHEMA IF NOT EXISTS "${targetSchema}";`];
  entities.forEach((entity) => {
    sqlParts.push(generateEntityDDL(entity, targetSchema));
  });
  return sqlParts.join('\n\n');
}

function splitStatements(sql) {
  return sql.split(';').map((s) => s.trim()).filter(Boolean);
}

function shouldSkipStatement(stmt) {
  return stmt.startsWith('CREATE SCHEMA');
}

module.exports = {
  dbType: 'postgresql',
  mapSqlType,
  generateEntityDDL,
  buildPreviewSql,
  splitStatements,
  shouldSkipStatement
};
