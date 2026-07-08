const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataCollectionPipelineRun = sequelize.define('BizdataCollectionPipelineRun', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  pipeline_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  run_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  input_raw: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  parse_output: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  store_output: {
    type: DataTypes.JSONB,
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
  executed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  source_application_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'collection_pipeline_runs',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true,
});

module.exports = BizdataCollectionPipelineRun;
