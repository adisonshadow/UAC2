const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataEnum = sequelize.define('BizdataEnum', {
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
  enum_info: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  values: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  items: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'enums',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = BizdataEnum;
