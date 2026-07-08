const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModelIoTag = sequelize.define('ModelIoTag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  model_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  direction: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  modality: {
    type: DataTypes.STRING(50),
    allowNull: false
  }
}, {
  tableName: 'model_io_tags',
  schema: 'aibase',
  timestamps: false,
  underscored: true
});

module.exports = ModelIoTag;
