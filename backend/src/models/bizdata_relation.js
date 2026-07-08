const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataRelation = sequelize.define('BizdataRelation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  inverse_name: {
    type: DataTypes.STRING(128),
    allowNull: true
  },
  from_entity_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  to_entity_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  join_table: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'relations',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = BizdataRelation;
