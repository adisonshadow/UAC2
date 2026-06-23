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

// 状态枚举
export const statusEnum: Record<string, ProSchemaValueEnumType> = {
  ACTIVE: { text: '在职', status: 'success' },
  DISABLED: { text: '离职', status: 'error' },
  LOCKED: { text: '已锁定', status: 'warning' },
  ARCHIVED: { text: '已归档', status: 'default' },
};

// 性别枚举
export const genderEnum: Record<string, ProSchemaValueEnumType> = {
  MALE: { text: '男' },
  FEMALE: { text: '女' },
};
