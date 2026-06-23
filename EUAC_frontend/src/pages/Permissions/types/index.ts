import { FormInstance } from 'antd';

export type ResourceType = 'MENU' | 'BUTTON' | 'API';

export type ActionType = 'read' | 'create' | 'update' | 'delete';

export interface Permission {
  permission_id: string;
  code: string;
  name?: string;
  description?: string;
  resource_type: ResourceType;
  actions: ActionType[];
  parent_id?: string;
  status?: 'ACTIVE' | 'DISABLED';
  created_at?: string;
  updated_at?: string;
  children?: Permission[];
  _searchText?: string;
}

export interface PermissionTableProps {
  resourceType: ResourceType;
  allowedActions: ActionType[];
  title: string;
}

export interface PermissionFormProps {
  resourceType: ResourceType;
  allowedActions: ActionType[];
  initialValues?: Partial<Permission>;
  onFinish: (values: any) => Promise<void> | Promise<boolean>;
  loading?: boolean;
  readonly?: boolean;
  form?: FormInstance;
} 