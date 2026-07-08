export interface Permission {
  permission_id: string;
  name: string;
  code: string;
}

export interface Role {
  role_id: string;
  role_name: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  parent_id?: string;
  created_at?: string;
  updated_at?: string;
  _searchText?: string;
  children?: Role[];
  permissions?: Permission[];
}

export interface RoleResponse {
  code: number;
  message: string;
  data: {
    items: Role[];
    total: number;
  };
}

export interface RoleDetailResponse {
  code: number;
  message: string;
  data: Role;
} 