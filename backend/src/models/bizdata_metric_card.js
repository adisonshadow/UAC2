const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMetricCard = sequelize.define('BizdataMetricCard', {
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
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  domain_code: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  metric_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  viz_type: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  config: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'enabled',
  },
}, {
  tableName: 'metric_cards',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataMetricCard;
