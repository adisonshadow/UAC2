const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataMetricValue = sequelize.define('BizdataMetricValue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  metric_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  run_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  value: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  dimension_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: '',
  },
  computed_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'metric_values',
  schema: 'bizdata',
  timestamps: false,
  underscored: true,
});

module.exports = BizdataMetricValue;
