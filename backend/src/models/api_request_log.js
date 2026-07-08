const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApiRequestLog = sequelize.define('ApiRequestLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  trace_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  error_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_request_logs',
  schema: 'aibase',
  timestamps: false,
  underscored: true
});

module.exports = ApiRequestLog;
