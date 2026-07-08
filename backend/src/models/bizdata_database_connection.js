const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataDatabaseConnection = sequelize.define('BizdataDatabaseConnection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  db_type: {
    type: DataTypes.STRING(32),
    allowNull: false
  },
  host: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'localhost'
  },
  port: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5432
  },
  username: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  password_enc: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  database_name: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  target_schema: {
    type: DataTypes.STRING(128),
    allowNull: false,
    defaultValue: 'bizdata_mat'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  last_test_status: {
    type: DataTypes.STRING(32),
    allowNull: true
  },
  last_tested_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'database_connections',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

module.exports = BizdataDatabaseConnection;
