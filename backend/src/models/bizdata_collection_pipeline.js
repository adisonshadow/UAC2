const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataCollectionPipeline = sequelize.define('BizdataCollectionPipeline', {
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
  route_path: {
    type: DataTypes.STRING(512),
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
  protocol_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'serial',
  },
  restrict_sources: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  sample_data: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  target_structure: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  parse_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  store_script: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  entity_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  connection_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  table_name: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  target_schema: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: 'bizdata_mat',
  },
  base_path: {
    type: DataTypes.STRING(256),
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
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'collection_pipelines',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataCollectionPipeline;
