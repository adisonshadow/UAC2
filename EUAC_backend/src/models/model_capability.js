const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModelCapability = sequelize.define('ModelCapability', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  model_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  capability: {
    type: DataTypes.STRING(50),
    allowNull: false
  }
}, {
  tableName: 'model_capabilities',
  schema: 'aibase',
  timestamps: false,
  underscored: true
});

module.exports = ModelCapability;
