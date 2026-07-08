const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('./logger');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: config.postgresql.host,
  port: config.postgresql.port,
  database: config.postgresql.database,
  username: config.postgresql.user,
  password: config.postgresql.password,
  schema: config.postgresql.schema,
  logging: false,
  define: {
    timestamps: true,
    underscored: true
  },
  pool: {
    max: config.postgresql.max_connections,
    min: 0,
    acquire: config.postgresql.connection_timeout,
    idle: config.postgresql.idle_timeout
  }
});

sequelize.authenticate()
  .then(() => {
    logger.info('Database connected successfully');
  })
  .catch(err => {
    logger.error('Unable to connect to the database:', err);
    process.exit(-1);
  });

module.exports = sequelize;
