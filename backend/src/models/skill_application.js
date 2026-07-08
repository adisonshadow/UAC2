const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SkillApplication = sequelize.define('SkillApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  skill_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  application_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'skill_applications',
  schema: 'aibase',
  timestamps: false,
  underscored: true,
});

module.exports = SkillApplication;
