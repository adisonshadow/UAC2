const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataApiServiceOperation = sequelize.define('BizdataApiServiceOperation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  api_service_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  operation: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  http_method: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },
  route_pattern: {
    type: DataTypes.STRING(128),
    allowNull: false,
    defaultValue: '',
  },
  parameters_schema: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  generated_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'api_service_operations',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataApiServiceOperation;
