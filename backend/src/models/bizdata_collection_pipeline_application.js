const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataCollectionPipelineApplication = sequelize.define('BizdataCollectionPipelineApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  pipeline_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  application_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'collection_pipeline_applications',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true,
});

module.exports = BizdataCollectionPipelineApplication;
