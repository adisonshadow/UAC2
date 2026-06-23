const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMaterializationRun = sequelize.define('BizdataMaterializationRun', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  target_schema: {
    type: DataTypes.STRING(128),
    allowNull: false,
    defaultValue: 'bizdata_mat'
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'pending'
  },
  sql_preview: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  generated_code: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  executed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'materialization_runs',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = BizdataMaterializationRun;
