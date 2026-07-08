const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataEntity = sequelize.define('BizdataEntity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  label: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  entity_kind: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'er_table'
  },
  table_name: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'enabled'
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  entity_info: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  json_schema: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  layout: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'entities',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = BizdataEntity;
