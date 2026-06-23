const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Application extends Model {}

Application.init({
  application_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: '应用ID'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '应用名称'
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '应用编码'
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'ACTIVE',
    validate: {
      isIn: [['ACTIVE', 'DISABLED']]
    },
    comment: '应用状态'
  },
  sso_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否启用SSO'
  },
  sso_config: {
    type: DataTypes.JSONB,
    comment: 'SSO配置信息'
  },
  api_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否启用API服务'
  },
  api_connect_config: {
    type: DataTypes.JSONB,
    comment: 'API连接配置'
  },
  api_data_scope: {
    type: DataTypes.JSONB,
    comment: 'API数据权限范围'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '应用描述'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  },
  deleted_at: {
    type: DataTypes.DATE,
    comment: '删除时间'
  }
}, {
  sequelize,
  modelName: 'Application',
  tableName: 'applications',
  schema: 'uac',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
});

module.exports = Application; 