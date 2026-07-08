function mapFieldType(typeormConfig = {}) {
  const type = (typeormConfig.type || 'string').toLowerCase();
  switch (type) {
    case 'int':
    case 'integer':
    case 'bigint':
      return 'integer';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'json':
    case 'jsonb':
      return 'json';
    default:
      return 'string';
  }
}

const { resolveEntityTableName } = require('../../entityTableName');

function generateEntityDDL(entity, targetSchema) {
  const entityKey = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
  const prefix = targetSchema.replace(/:$/, '');
  const keyPattern = `${prefix}:${entityKey}:{id}`;
  const hashKey = `${prefix}:schema:${entityKey}`;
  const fields = (entity.fields || []).map((f) => ({
    name: f.fieldKey || f.field_key,
    type: mapFieldType(f.typeormConfig || f.typeorm_config || {}),
    label: f.columnInfo?.label || f.fieldKey || f.field_key
  }));

  return [
    `# Entity: ${entity.label} (${entity.code})`,
    `# Key pattern: ${keyPattern}`,
    `# Schema hash: ${hashKey}`,
    `HSET ${hashKey} version ${entity.version || 1}`,
    `HSET ${hashKey} entityId ${entity.id}`,
    `HSET ${hashKey} fields '${JSON.stringify(fields)}'`,
    `# Example record:`,
    `# HSET ${keyPattern.replace('{id}', 'example-id')} ${fields.map((f) => f.name).join(' ')}`
  ].join('\n');
}

function buildPreviewSql(entities, targetSchema) {
  const header = [`# Redis 物化结构 @ prefix ${targetSchema}`, ''];
  const parts = entities.map((entity) => generateEntityDDL(entity, targetSchema));
  return [...header, ...parts].join('\n\n');
}

function splitStatements(sql) {
  return sql.split('\n\n').map((s) => s.trim()).filter(Boolean);
}

function shouldSkipStatement(stmt) {
  return stmt.startsWith('#');
}

function parseExecutionPlan(entities, targetSchema) {
  const prefix = targetSchema.replace(/:$/, '');
  return entities.map((entity) => {
    const entityKey = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
    const hashKey = `${prefix}:schema:${entityKey}`;
    const fields = (entity.fields || []).map((f) => ({
      name: f.fieldKey || f.field_key,
      type: mapFieldType(f.typeormConfig || f.typeorm_config || {})
    }));
    return {
      prefix,
      entityKey,
      hashKey,
      keyPattern: `${prefix}:${entityKey}:{id}`,
      fields,
      version: entity.version
    };
  });
}

module.exports = {
  dbType: 'redis',
  buildPreviewSql,
  splitStatements,
  shouldSkipStatement,
  parseExecutionPlan
};
