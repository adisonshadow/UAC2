import { ProSchemaValueEnumType } from "@ant-design/pro-components";

// 基础操作权限定义
export const ACTION_TYPES = [
  { key: 'read', text: '可见' },
  { key: 'create', text: '创建' },
  { key: 'update', text: '更新' },
  { key: 'delete', text: '删除' },
  // 预留其他操作权限
  // { key: 'import', text: '导入' },
  // { key: 'export', text: '导出' },
  // { key: 'print', text: '打印' },
  // { key: 'approve', text: '审批' },
  // { key: 'reject', text: '驳回' },
  // { key: 'cancel', text: '取消' },
  // { key: 'close', text: '关闭' },
] as const;

// 所有可用的操作权限 key 数组。 类似 ['read', 'create', 'update', 'delete']
export const ACTION_KEYS = ACTION_TYPES.map(item => item.key);

// 操作权限枚举。类似 { read: { text: '可见' }, create: { text: '创建' }, update: { text: '更新' }, delete: { text: '删除' } }
export const actionEnum: Record<string, ProSchemaValueEnumType> = Object.fromEntries(
  ACTION_TYPES.map(({ key, text }) => [key, { text }])
);

// 操作权限映射（用于显示）。类似 { read: '可见', create: '创建', update: '更新', delete: '删除' }
export const actionMap: Record<string, string> = Object.fromEntries(
  ACTION_TYPES.map(({ key, text }) => [key, text])
);

// 状态枚举（成员）
export const statusEnum: Record<string, ProSchemaValueEnumType> = {
  ACTIVE: { text: '在职', status: 'success' },
  DISABLED: { text: '离职', status: 'error' },
  LOCKED: { text: '已锁定', status: 'warning' },
  ARCHIVED: { text: '已归档', status: 'default' },
};

/** 启用 / 禁用（权限、应用等） */
export const enableDisableStatusEnum: Record<string, ProSchemaValueEnumType> = {
  ACTIVE: { text: '启用', status: 'Success' },
  DISABLED: { text: '禁用', status: 'Error' },
  ARCHIVED: { text: '已归档', status: 'Default' },
};

/** 角色状态 */
export const roleStatusEnum: Record<string, ProSchemaValueEnumType> = {
  ACTIVE: { text: '启用', status: 'Success' },
  ARCHIVED: { text: '禁用', status: 'Error' },
};

/** 布尔：启用 / 停用 */
export const booleanActiveEnum: Record<string, ProSchemaValueEnumType> = {
  true: { text: '启用', status: 'Success' },
  false: { text: '停用', status: 'Default' },
};

/** 布尔：已开启 / 未开启 */
export const booleanEnabledEnum: Record<string, ProSchemaValueEnumType> = {
  true: { text: '已开启', status: 'Success' },
  false: { text: '未开启', status: 'Default' },
};

/** API 服务发布状态 */
export const apiServiceStatusEnum: Record<string, ProSchemaValueEnumType> = {
  draft: { text: '未发布', status: 'Processing' },
  published: { text: '已发布', status: 'Success' },
};

/** 存储 Bucket 状态 */
export const storageBucketStatusEnum: Record<string, ProSchemaValueEnumType> = {
  ACTIVE: { text: '启用', status: 'Success' },
  DISABLED: { text: '停用', status: 'Default' },
};

/** 数据库连接测试状态 */
export const dbConnectionTestStatusEnum: Record<string, ProSchemaValueEnumType> = {
  success: { text: '可用', status: 'Success' },
  failed: { text: '失败', status: 'Error' },
};

/** 数据库连接未测试 */
export const dbConnectionUntestedEnum: Record<string, ProSchemaValueEnumType> = {
  pending: { text: '未测试', status: 'Default' },
};

/** 物化运行状态（兼容大小写） */
export const materializationRunStatusEnum: Record<string, ProSchemaValueEnumType> = {
  success: { text: '成功', status: 'Success' },
  succeeded: { text: '成功', status: 'Success' },
  failed: { text: '失败', status: 'Error' },
  failure: { text: '失败', status: 'Error' },
  running: { text: '运行中', status: 'Processing' },
  pending: { text: '等待中', status: 'Default' },
};

// 性别枚举
export const genderEnum: Record<string, ProSchemaValueEnumType> = {
  MALE: { text: '男' },
  FEMALE: { text: '女' },
};
