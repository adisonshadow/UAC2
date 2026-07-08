class MaterializationTargetNotFoundError extends Error {
  constructor({ targetSchema, dbType, connectionId }) {
    const label = dbType === 'mongodb' ? '数据库' : dbType === 'redis' ? 'Key 前缀' : 'Schema';
    super(`${label}「${targetSchema}」不存在`);
    this.name = 'MaterializationTargetNotFoundError';
    this.status = 409;
    this.targetSchema = targetSchema;
    this.dbType = dbType;
    this.connectionId = connectionId;
  }
}

module.exports = { MaterializationTargetNotFoundError };
