const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AutomationHookRun = sequelize.define('AutomationHookRun', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  run_group_id: { type: DataTypes.UUID, allowNull: false },
  hook_id: { type: DataTypes.UUID, allowNull: false },
  hook_version: { type: DataTypes.INTEGER, allowNull: false },
  event_id: { type: DataTypes.UUID, allowNull: false },
  event_type: { type: DataTypes.STRING(64), allowNull: false },
  event_depth: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // event | test | replay | schedule
  trigger_source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'event' },
  payload: { type: DataTypes.JSONB, allowNull: false },
  action_config_snapshot: { type: DataTypes.JSONB, allowNull: true },
  // success | failed | timeout | skipped | suppressed
  status: { type: DataTypes.STRING(32), allowNull: false },
  attempt: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  duration_ms: { type: DataTypes.INTEGER, allowNull: true },
  error: { type: DataTypes.TEXT, allowNull: true },
  output: { type: DataTypes.JSONB, allowNull: true },
  logs: { type: DataTypes.JSONB, allowNull: true },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  finished_at: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'hook_runs',
  schema: 'automation',
  timestamps: false,
  underscored: true,
});

module.exports = AutomationHookRun;
