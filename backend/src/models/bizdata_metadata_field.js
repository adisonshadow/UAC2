const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMetadataField = sequelize.define('BizdataMetadataField', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  metadata_table_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  field_key: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  metadata_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  standard_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  business_meaning: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sensitivity_level: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  alias: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  data_type: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  validation_rule: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  enum_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'metadata_fields',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataMetadataField;
