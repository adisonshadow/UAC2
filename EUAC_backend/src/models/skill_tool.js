const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SkillTool = sequelize.define('SkillTool', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  skill_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  tool_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'skill_tools',
  schema: 'aibase',
  timestamps: false,
  underscored: true
});

module.exports = SkillTool;
