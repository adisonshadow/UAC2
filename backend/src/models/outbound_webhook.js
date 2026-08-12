const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 外部 API 提交配置
 * 当绑定的业务 API 请求成功后，触发本配置：运行处置脚本转换数据 → HTTP 调用外部 API
 */
const OutboundWebhook = sequelize.define('OutboundWebhook', {
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
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft',
  },
  trigger_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'api_hook',
  },
  trigger_api_service_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  trigger_api_service_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  target_url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  http_method: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'POST',
  },
  auth_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'none',
  },
  auth_send_mode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  auth_key_name: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  auth_secret_enc: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  request_structure: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  request_example: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  transform_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mock_data: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  response_config: {
    type: DataTypes.JSONB,
    allowNull: true,
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
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'outbound_webhooks',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = OutboundWebhook;
