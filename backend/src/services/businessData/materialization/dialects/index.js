const postgresql = require('./postgresql');
const mysql = require('./mysql');
const mongodb = require('./mongodb');
const redis = require('./redis');

const DIALECTS = {
  postgresql,
  mysql,
  mongodb,
  redis
};

const SUPPORTED_DB_TYPES = Object.keys(DIALECTS);

function getDialect(dbType) {
  const dialect = DIALECTS[dbType];
  if (!dialect) {
    throw new Error(`不支持的数据库类型: ${dbType}，仅支持 ${SUPPORTED_DB_TYPES.join('、')}`);
  }
  return dialect;
}

module.exports = { getDialect, DIALECTS, SUPPORTED_DB_TYPES };
