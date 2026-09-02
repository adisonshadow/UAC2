-- 去掉 database_connections.db_type 表级 CHECK：类型合法性由应用层维护（与方言 SUPPORTED_DB_TYPES 一致）

ALTER TABLE bizdata.database_connections
  DROP CONSTRAINT IF EXISTS database_connections_db_type_check;
