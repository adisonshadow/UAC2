const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BizdataScopeDoc = sequelize.define('BizdataScopeDoc', {
  code: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
  },
  contentMarkdown: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
    field: 'content_markdown',
  },
}, {
  tableName: 'scope_docs',
  schema: 'bizdata',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

module.exports = BizdataScopeDoc;
