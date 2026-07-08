const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataApiServicePermission = sequelize.define('BizdataApiServicePermission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  api_service_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  grant_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  grant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  actions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
}, {
  tableName: 'api_service_permissions',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataApiServicePermission;
