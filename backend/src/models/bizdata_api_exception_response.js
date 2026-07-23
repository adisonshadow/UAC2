const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataApiExceptionResponse = sequelize.define('BizdataApiExceptionResponse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: 'HTTP 状态码（401/403/404/409/500...）',
  },
  title: {
    type: DataTypes.STRING(128),
    allowNull: false,
    comment: '简短标题（如「未授权」「用户不存在」）',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '详细说明',
  },
  schema: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    comment: '响应体 JSON Schema',
  },
  example: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: '响应示例',
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '是否启用（禁用则不出现在文档中）',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '排序',
  },
}, {
  tableName: 'api_exception_responses',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataApiExceptionResponse;
