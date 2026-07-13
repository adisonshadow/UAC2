const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 外部 API 提交执行历史
 */
const OutboundWebhookRun = sequelize.define('OutboundWebhookRun', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  webhook_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  run_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  trigger_data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  transformed_body: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  response_status: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  response_body: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'success',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'outbound_webhook_runs',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true,
});

module.exports = OutboundWebhookRun;
