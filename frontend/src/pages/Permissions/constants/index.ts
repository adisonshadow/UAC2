import { ResourceType, ActionType } from '../types';

export const RESOURCE_TYPES: Record<ResourceType, { label: string; actions: ActionType[] }> = {
  MENU: {
    label: '菜单权限',
    actions: ['read'],
  },
  BUTTON: {
    label: '按钮权限',
    actions: ['read'],
  },
  API: {
    label: 'API权限',
    actions: ['read', 'create', 'update', 'delete'],
  },
};

export const ACTION_LABELS: Record<ActionType, string> = {
  read: '读取',
  create: '创建',
  update: '更新',
  delete: '删除',
}; 