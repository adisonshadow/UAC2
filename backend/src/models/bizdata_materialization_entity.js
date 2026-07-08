const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMaterializationEntity = sequelize.define('BizdataMaterializationEntity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  run_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  entity_version: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  table_name: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  ddl_applied: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'materialization_entities',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true
});

module.exports = BizdataMaterializationEntity;
