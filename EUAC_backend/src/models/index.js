const sequelize = require('../config/database');

// 导入所有模型定义
const User = require('./user');
const Department = require('./department');
const Role = require('./role');
const Permission = require('./permission');
const UserRole = require('./user_role');
const RolePermission = require('./role_permission');
const DataPermissionRule = require('./data_permission_rule');
const OperationLog = require('./operation_log');
const RefreshToken = require('./refreshToken');
const DepartmentClosure = require('./department_closure');
const DepartmentHistory = require('./department_history');
const LoginAttempt = require('./loginAttempt');
const Captcha = require('./captcha');
const PasswordReset = require('./passwordReset');
const Application = require('./application');
const Provider = require('./provider');
const AiModel = require('./ai_model');
const ModelCapability = require('./model_capability');
const ModelIoTag = require('./model_io_tag');
const ApiRequestLog = require('./api_request_log');
const Scope = require('./scope');
const Tool = require('./tool');
const Skill = require('./skill');
const SkillTool = require('./skill_tool');
const BizdataEntity = require('./bizdata_entity');
const BizdataEntityField = require('./bizdata_entity_field');
const BizdataEnum = require('./bizdata_enum');
const BizdataRelation = require('./bizdata_relation');
const BizdataMaterializationRun = require('./bizdata_materialization_run');
const BizdataMaterializationEntity = require('./bizdata_materialization_entity');
const BizdataSetting = require('./bizdata_setting');

// 设置模型关联关系
User.belongsTo(Department, { foreignKey: 'department_id' });
Department.hasMany(User, { foreignKey: 'department_id' });

User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id' });

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id' });

Role.hasMany(DataPermissionRule, { foreignKey: 'role_id' });
DataPermissionRule.belongsTo(Role, { foreignKey: 'role_id' });

User.hasMany(OperationLog, { foreignKey: 'user_id' });
OperationLog.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

Department.hasMany(DepartmentClosure, { foreignKey: 'ancestor_id', as: 'ancestors' });
Department.hasMany(DepartmentClosure, { foreignKey: 'descendant_id', as: 'descendants' });

User.hasMany(LoginAttempt, { foreignKey: 'user_id' });
LoginAttempt.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(PasswordReset, { foreignKey: 'user_id' });
PasswordReset.belongsTo(User, { foreignKey: 'user_id' });

Provider.hasMany(AiModel, { foreignKey: 'provider_id', as: 'models' });
AiModel.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

AiModel.hasMany(ModelCapability, { foreignKey: 'model_id', as: 'capabilities' });
ModelCapability.belongsTo(AiModel, { foreignKey: 'model_id', as: 'model' });

AiModel.hasMany(ModelIoTag, { foreignKey: 'model_id', as: 'ioTags' });
ModelIoTag.belongsTo(AiModel, { foreignKey: 'model_id', as: 'model' });

Scope.hasMany(Tool, { foreignKey: 'scope_id', as: 'tools' });
Tool.belongsTo(Scope, { foreignKey: 'scope_id', as: 'scope' });

Scope.hasMany(Skill, { foreignKey: 'scope_id', as: 'skills' });
Skill.belongsTo(Scope, { foreignKey: 'scope_id', as: 'scope' });

Skill.belongsToMany(Tool, { through: SkillTool, foreignKey: 'skill_id', otherKey: 'tool_id', as: 'tools' });
Tool.belongsToMany(Skill, { through: SkillTool, foreignKey: 'tool_id', otherKey: 'skill_id', as: 'skills' });
SkillTool.belongsTo(Skill, { foreignKey: 'skill_id', as: 'skill' });
SkillTool.belongsTo(Tool, { foreignKey: 'tool_id', as: 'tool' });

BizdataEntity.hasMany(BizdataEntityField, { foreignKey: 'entity_id', as: 'fields' });
BizdataEntityField.belongsTo(BizdataEntity, { foreignKey: 'entity_id', as: 'entity' });

BizdataEntity.hasMany(BizdataRelation, { foreignKey: 'from_entity_id', as: 'outgoingRelations' });
BizdataEntity.hasMany(BizdataRelation, { foreignKey: 'to_entity_id', as: 'incomingRelations' });
BizdataRelation.belongsTo(BizdataEntity, { foreignKey: 'from_entity_id', as: 'fromEntity' });
BizdataRelation.belongsTo(BizdataEntity, { foreignKey: 'to_entity_id', as: 'toEntity' });

BizdataMaterializationRun.hasMany(BizdataMaterializationEntity, { foreignKey: 'run_id', as: 'entities' });
BizdataMaterializationEntity.belongsTo(BizdataMaterializationRun, { foreignKey: 'run_id', as: 'run' });
BizdataMaterializationEntity.belongsTo(BizdataEntity, { foreignKey: 'entity_id', as: 'entity' });
BizdataEntity.hasMany(BizdataMaterializationEntity, { foreignKey: 'entity_id', as: 'materializations' });

module.exports = {
  sequelize,
  User,
  Department,
  Role,
  Permission,
  UserRole,
  RolePermission,
  DataPermissionRule,
  OperationLog,
  RefreshToken,
  DepartmentClosure,
  DepartmentHistory,
  LoginAttempt,
  Captcha,
  PasswordReset,
  Application,
  Provider,
  AiModel,
  ModelCapability,
  ModelIoTag,
  ApiRequestLog,
  Scope,
  Tool,
  Skill,
  SkillTool,
  BizdataEntity,
  BizdataEntityField,
  BizdataEnum,
  BizdataRelation,
  BizdataMaterializationRun,
  BizdataMaterializationEntity,
  BizdataSetting
}; 