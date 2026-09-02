const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AutomationHook = sequelize.define('AutomationHook', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  // draft | enabled | disabled | auto_disabled | deleted（软删）
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
  event_type: { type: DataTypes.STRING(64), allowNull: false },
  event_filter: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  condition_expr: { type: DataTypes.TEXT, allowNull: true },
  // http_request | internal_api | script
  action_type: { type: DataTypes.STRING(32), allowNull: false },
  action_config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  failure_policy: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  consecutive_failures: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  created_by: { type: DataTypes.STRING(64), allowNull: true },
  updated_by: { type: DataTypes.STRING(64), allowNull: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'hooks',
  schema: 'automation',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  paranoid: false,
});

module.exports = AutomationHook;
