const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiModel = sequelize.define('AiModel', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  provider_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  model_id: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  display_name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  default_params: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'models',
  schema: 'aibase',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = AiModel;
