const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataEntityField = sequelize.define('BizdataEntityField', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  field_key: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  column_info: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  typeorm_config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'entity_fields',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = BizdataEntityField;
