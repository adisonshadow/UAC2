const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataApiService = sequelize.define('BizdataApiService', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  route_path: {
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft',
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  entity_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  connection_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  table_name: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  definition_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  scope_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  script_mode: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'sql',
  },
  handler_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  request_parameter_interface: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  target_schema: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: 'bizdata_mat',
  },
  base_path: {
    type: DataTypes.STRING(256),
    allowNull: true,
  },
  enabled_operations: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  transport_protocols: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: ['http'],
  },
  security_config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  script_overrides: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'api_services',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataApiService;
