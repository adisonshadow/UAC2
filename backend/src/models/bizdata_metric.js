const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMetric = sequelize.define('BizdataMetric', {
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
  label: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metric_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  connection_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  query_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  formula_config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  compute_mode: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'scheduled',
  },
  schedule_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'manual',
  },
  schedule_config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  unit: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  scope_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'enabled',
  },
  last_computed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_value: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
}, {
  tableName: 'metrics',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataMetric;
