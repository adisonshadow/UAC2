import { ACTION_TYPES } from "@/enums";

export type ActionType = typeof ACTION_TYPES[number]['key'];

export interface MenuPermission {
  permission_id: string;
  code: string;
  description?: string;
  resource_type: 'MENU';
  actions: ActionType[];
  status?: 'ACTIVE' | 'DISABLED';
  created_at: string;
  updated_at?: string;
  children?: MenuPermission[];
  _searchText?: string;
}

export interface PermissionResponse {
  permission_id?: string;
  code?: string;
  description?: string;
  resource_type?: string;
  actions?: string[];
  status?: 'ACTIVE' | 'DISABLED';
  created_at?: string;
  updated_at?: string;
  parent_id?: string;
}

export {}; 