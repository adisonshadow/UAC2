function mapFieldType(typeormConfig = {}) {
  const type = (typeormConfig.type || 'string').toLowerCase();
  switch (type) {
    case 'int':
    case 'integer':
    case 'bigint':
      return 'int';
    case 'boolean':
    case 'bool':
      return 'bool';
    case 'json':
    case 'jsonb':
      return 'object';
    case 'decimal':
    case 'numeric':
      return 'decimal';
    case 'timestamp':
    case 'timestamptz':
    case 'date':
      return 'date';
    default:
      return 'string';
  }
}

function buildCollectionValidator(entity) {
  const fields = entity.fields || [];
  const properties = {};
  fields.forEach((field) => {
    const key = field.fieldKey || field.field_key;
    const cfg = field.typeormConfig || field.typeorm_config || {};
    properties[key] = { bsonType: mapFieldType(cfg) };
  });
  if (!properties.id) {
    properties.id = { bsonType: 'string' };
  }
  return {
    $jsonSchema: {
      bsonType: 'object',
      required: Object.keys(properties).filter((k) => {
        const field = fields.find((f) => (f.fieldKey || f.field_key) === k);
        const cfg = field?.typeormConfig || field?.typeorm_config || {};
        return cfg.nullable === false;
      }),
      properties
    }
  };
}

const { resolveEntityTableName } = require('../../entityTableName');

function generateEntityDDL(entity, targetSchema) {
  const collectionName = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
  const validator = JSON.stringify(buildCollectionValidator(entity), null, 2);
  const indexFields = (entity.fields || [])
    .filter((f) => {
      const cfg = f.typeormConfig || f.typeorm_config || {};
      return cfg.primary || cfg.unique || cfg.index;
    })
    .map((f) => f.fieldKey || f.field_key);

  const indexLines = indexFields.length
    ? indexFields.map((key) => `db.getCollection('${collectionName}').createIndex({ ${key}: 1 }, { unique: ${indexFields.includes(key) && (entity.fields || []).find((f) => (f.fieldKey || f.field_key) === key)?.typeormConfig?.unique ? 'true' : 'false'} });`)
    : [`db.getCollection('${collectionName}').createIndex({ id: 1 }, { unique: true });`];

  return [
    `// Collection: ${collectionName} @ ${targetSchema}`,
    `use('${targetSchema}');`,
    `db.createCollection('${collectionName}', { validator: ${validator} });`,
    ...indexLines
  ].join('\n');
}

function buildPreviewSql(entities, targetSchema) {
  const header = [`use('${targetSchema}');`, `// MongoDB 物化脚本`];
  const parts = entities.map((entity) => generateEntityDDL(entity, targetSchema));
  return [...header, ...parts].join('\n\n');
}

function splitStatements(sql) {
  return sql.split('\n\n').map((s) => s.trim()).filter(Boolean);
}

function shouldSkipStatement(stmt) {
  return stmt.startsWith('//') || stmt.startsWith('use(');
}

function parseExecutionPlan(entities, targetSchema) {
  return entities.map((entity) => {
    const collectionName = resolveEntityTableName(entity.code, entity.tableName || entity.table_name);
    return {
      database: targetSchema,
      collection: collectionName,
      validator: buildCollectionValidator(entity),
      indexes: (entity.fields || [])
        .filter((f) => {
          const cfg = f.typeormConfig || f.typeorm_config || {};
          return cfg.primary || cfg.unique || cfg.index;
        })
        .map((f) => ({
          key: f.fieldKey || f.field_key,
          unique: Boolean((f.typeormConfig || f.typeorm_config || {}).unique)
        }))
    };
  });
}

module.exports = {
  dbType: 'mongodb',
  buildPreviewSql,
  splitStatements,
  shouldSkipStatement,
  parseExecutionPlan
};
