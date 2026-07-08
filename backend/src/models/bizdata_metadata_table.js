const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMetadataTable = sequelize.define('BizdataMetadataTable', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  target_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  target_id: {
    type: DataTypes.UUID,
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
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'enabled',
  },
}, {
  tableName: 'metadata_tables',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataMetadataTable;
